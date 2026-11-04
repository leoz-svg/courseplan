import type {CatalogCourse, StudyPlan} from './planning';
import type {LearningProfile} from './profile';
import type {PathwayOptions, PathwayResult} from './pathways';

export type AgentCourse={code:string;title:string;credits:number|null;eligibility:'met'|'unmet'|'unknown';rules:string[];url:string};
export type AgentTrace={tool:string;status:'ok'|'error';summary:string};
export type AgentDraft={id:string;options:PathwayOptions};
export type AgentHandoff={id:string;result:PathwayResult;options:PathwayOptions;contextKey:string};
export type AgentReply={sessionId:string;text:string;mode:'model-tools'|'solver'|'unavailable';traces:AgentTrace[];courses:AgentCourse[];draft?:AgentDraft;handoff?:AgentHandoff};

// Excludes names, email and student ID. Exact plan/profile changes invalidate drafts and results.
export function agentContextKey(plan:StudyPlan,profile:LearningProfile,target:string){
 return JSON.stringify({plan,programId:profile.programId,entryYear:profile.entryYear,targetCredits:profile.targetCredits,priorCredits:profile.priorCredits,target});
}
export function defaultAgentOptions(plan:StudyPlan,profile:LearningProfile):PathwayOptions{
 const first=plan.terms.find(t=>t.courseCodes.length)??plan.terms[0];
 return {mode:'stage',targetCredits:profile.targetCredits,maxPerTerm:24,startYear:Math.max(2024,Math.min(2030,first.year)),startSeason:first.season==='Spring'?'Spring':'Autumn',strictOfferings:false,keepExisting:true,interest:'',excludedCodes:[],requiredCodes:[],waivedCodes:[...(plan.planningMeta?.waivedCodes??[])],waiverGroups:{...plan.planningMeta?.waiverGroups},acceptProvisional:false};
}
// Explicit numerical limits and preservation requests take precedence over model interpretation.
export function explicitAgentPatch(text:string,achievedCredits:number):Partial<PathwayOptions>{
 const patch:Partial<PathwayOptions>={};
 const total=text.match(/(?:累计(?:学分)?目标|总(?:学分)?目标|目标(?:学分)?)(?:\s*(?:改成|改为|为|是|到|[:：]))?\s*(\d+)\s*(?:CP|学分)?/i);
 const remaining=text.match(/(?:还差|还需(?:要)?(?:完成)?|剩余(?:需完成)?)\s*(\d+)\s*(?:CP|学分)/i);
 const load=text.match(/每(?:个)?学期[^，。；\n]{0,12}?(?:最多|不超过|上限(?:改成|改为|为|是)?|限制(?:为)?)\s*(\d+)\s*(?:CP|学分)?/i);
 if(total)patch.targetCredits=Number(total[1]);else if(remaining)patch.targetCredits=achievedCredits+Number(remaining[1]);
 if(load)patch.maxPerTerm=Number(load[1]);
 const keep=/(?:保留|保持|不调整|不改变)(?:现有|已有|当前)?(?:的)?(?:学期)?安排/g;
 const release=/(?:允许|可以|可|不保留|无需保留|不要保留|取消保留)(?:调整|重新安排|修改)?(?:现有|已有|当前)?(?:的)?(?:学期)?安排/g;
 const releases=[...text.matchAll(release)];
 const matches=[...text.matchAll(keep)].filter(m=>!releases.some(r=>m.index>=r.index&&m.index<r.index+r[0].length)).map(m=>({index:m.index,value:true})).concat(releases.map(m=>({index:m.index,value:false})));
 matches.sort((a,b)=>a.index-b.index);if(matches.length)patch.keepExisting=matches.at(-1)!.value;
 return patch;
}
export function patchAgentOptions(base:PathwayOptions,value:unknown,catalog:CatalogCourse[]):PathwayOptions{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('规划条件应为对象');
 const patch={...value} as Record<string,unknown>,allowed=['targetCredits','maxPerTerm','startYear','startSeason','strictOfferings','keepExisting','interest','requiredCodes','excludedCodes'];
 for(const key of Object.keys(patch))if(!allowed.includes(key)){
  // Small local models sometimes echo the entire options object. Ignore only unchanged immutable fields.
  if(['mode','waivedCodes','waiverGroups','acceptProvisional'].includes(key)&&JSON.stringify(patch[key])===JSON.stringify(base[key as keyof PathwayOptions]))delete patch[key];
  else throw new Error(`不支持修改 ${key}；已修与认可课程只能由用户在原界面修改`);
 }
 const next={...base,...patch} as PathwayOptions;
 for(const [key,min,max] of [['targetCredits',1,600],['maxPerTerm',6,36],['startYear',2024,2030]] as const)if(!Number.isInteger(next[key])||next[key]<min||next[key]>max)throw new Error(`${key} 超出允许范围`);
 if(!['Autumn','Spring'].includes(next.startSeason)||typeof next.keepExisting!=='boolean'||typeof next.strictOfferings!=='boolean'||typeof next.interest!=='string'||next.interest.length>300)throw new Error('规划条件格式不正确');
 const codes=new Set(catalog.map(c=>c.code));
 for(const key of ['requiredCodes','excludedCodes'] as const){if(!Array.isArray(next[key])||next[key].length>100||next[key].some(c=>typeof c!=='string'||!codes.has(c)))throw new Error('课程编号必须来自当前专业目录');next[key]=[...new Set(next[key])];}
 if(next.requiredCodes.some(c=>next.excludedCodes.includes(c)))throw new Error('同一课程不能同时必选和排除，请确认取舍');
 return next;
}
