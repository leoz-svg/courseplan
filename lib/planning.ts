export type RuleNode = {op:'subject';code:string;timing:'prior'|'concurrent'} | {op:'all'|'any';children:RuleNode[]} | {op:'manual';text:string} | {op:'credits';minimum:number};
export type CatalogCourse = {dataset_id:string;code:string;title:string;credit_points:number|null;faculty:string|null;study_level?:string|null;source_url:string;access_conditions_url?:string|null;requirements_status:string;rules:{kind:string;expression:RuleNode;raw_text:string;source_url:string;review_status:string}[];offerings:{session:string;location:string;indicative:boolean}[]};
export type Term={id:string;year:number;season:'Autumn'|'Spring'|'Summer';courseCodes:string[]};
export type PlanningMeta={title:string;mode:'stage'|'degree';targetCredits:number;ruleVersion:string;generatedAt:string;modified:boolean;waivedCodes:string[];priorCreditsSnapshot:number;waiverGroups?:Record<string,string>};
export type StudyPlan={version:2;id:string;name:string;datasetId:string;completed:string[];terms:Term[];planningMeta?:PlanningMeta};
export type ConditionState='met'|'unmet'|'unknown';
export type Issue={code:string;termId:string;severity:'error'|'warning';message:string};
export const DATASET='uts-2024-computing-snapshot';
export const STORAGE_KEY='courseplan-workspace-v2';
export const termName=(t:Term)=>`${t.year} ${t.season}`;
export function emptyPlan(datasetId=DATASET,startYear=2024):StudyPlan{return {version:2,id:'local-main',name:'我的计算机课程路径',datasetId,completed:[],terms:[{id:'t1',year:startYear,season:'Autumn',courseCodes:[]},{id:'t2',year:startYear,season:'Spring',courseCodes:[]},{id:'t3',year:startYear+1,season:'Autumn',courseCodes:[]}]};}
export function demoPlan():StudyPlan{const p=emptyPlan();p.name='示例 · 从编程到游戏开发';p.terms[0].courseCodes=['41039'];p.terms[1].courseCodes=['48024'];p.terms[2].courseCodes=['31251','31263'];return p;}
export function evaluateRule(node:RuleNode,prior:Set<string>,concurrent:Set<string>,cp:number):ConditionState{
 if(node.op==='subject')return prior.has(node.code)||(node.timing==='concurrent'&&concurrent.has(node.code))?'met':'unmet';
 if(node.op==='manual')return 'unknown';if(node.op==='credits')return cp>=node.minimum?'met':'unmet';
 const values=node.children.map(n=>evaluateRule(n,prior,concurrent,cp));
 return node.op==='any'?(values.includes('met')?'met':values.includes('unknown')?'unknown':'unmet'):(values.includes('unmet')?'unmet':values.includes('unknown')?'unknown':'met');
}
export function ruleReferences(node:RuleNode):{code:string;timing:string}[]{return node.op==='subject'?[{code:node.code,timing:node.timing}]:'children' in node?node.children.flatMap(ruleReferences):[];}
export function describeRule(node:RuleNode):string{if(node.op==='subject')return node.code+(node.timing==='concurrent'?'（可共修）':'');if(node.op==='manual')return '需人工核验：'+node.text;if(node.op==='credits')return `至少完成 ${node.minimum} CP`;return !node.children.length?'未列出学术先修课程':'('+node.children.map(describeRule).join(node.op==='any'?' 或 ':' 且 ')+')';}
export function courseEligibility(course:CatalogCourse,plan:StudyPlan,targetId:string,catalog:CatalogCourse[]):ConditionState{
 const index=plan.terms.findIndex(t=>t.id===targetId);if(index<0)return 'unknown';
 const prior=new Set([...plan.completed,...(plan.planningMeta?.waivedCodes??[]),...plan.terms.slice(0,index).flatMap(t=>t.courseCodes)]),concurrent=new Set(plan.terms[index].courseCodes);
 const cp=catalog.filter(c=>prior.has(c.code)).reduce((sum,c)=>sum+(c.credit_points??0),0),rules=course.rules.filter(r=>r.kind==='academic');
 if(!rules.length)return 'unknown';const values=rules.map(r=>evaluateRule(r.expression,prior,concurrent,cp));return values.includes('unmet')?'unmet':values.includes('unknown')?'unknown':'met';
}
export function validatePlan(plan:StudyPlan,catalog:CatalogCourse[]):Issue[]{
 const issues:Issue[]=[],byCode=new Map(catalog.map(c=>[c.code,c]));
 for(const term of plan.terms){const cp=term.courseCodes.reduce((sum,code)=>sum+(byCode.get(code)?.credit_points??0),0);
  if(cp>24)issues.push({code:'',termId:term.id,severity:'warning',message:`${termName(term)} 已安排 ${cp} CP，超过参考上限 24 CP。`});
  for(const code of term.courseCodes){const c=byCode.get(code);if(!c)continue;const state=courseEligibility(c,plan,term.id,catalog);
   if(state==='unmet')issues.push({code,termId:term.id,severity:'error',message:`${code} 在 ${termName(term)} 尚未满足已录入的先修条件。`});
   if(state==='unknown')issues.push({code,termId:term.id,severity:'warning',message:`${code} 的学术条件尚未完整确认，请核对官方来源。`});
   if(c.rules.some(r=>r.kind==='exclusion'))issues.push({code,termId:term.id,severity:'warning',message:`${code} 有互斥条件，尚未自动判定，请查看课程详情。`});
   if(c.offerings.length&&!c.offerings.some(o=>o.session.toLowerCase().startsWith(term.season.toLowerCase())))issues.push({code,termId:term.id,severity:'warning',message:`${code} 已采集的开课信息未包含 ${term.season}；实际安排需核实。`});
  }
 }return issues;
}
export function placeCourse(plan:StudyPlan,code:string,target:string):StudyPlan{
 if(plan.planningMeta?.waivedCodes.includes(code))return plan;
 if(target!=='completed'&&target!=='catalog'&&!plan.terms.some(t=>t.id===target))return plan;
 return {...plan,completed:target==='completed'?[...plan.completed.filter(c=>c!==code),code]:plan.completed.filter(c=>c!==code),terms:plan.terms.map(t=>({...t,courseCodes:[...t.courseCodes.filter(c=>c!==code),...(t.id===target?[code]:[])]}))};
}
export function restorePlan(value:unknown,catalog:CatalogCourse[],expectedDataset=catalog[0]?.dataset_id??DATASET):StudyPlan{
 if(!value||typeof value!=='object')throw new Error('计划文件格式不正确');const p=value as StudyPlan;
 if(p.version!==2||p.datasetId!==expectedDataset)throw new Error('需要本版本、同一数据集的计划。旧模拟课程编号可能代表不同课程，不能自动迁移。');
 if(!Array.isArray(p.terms)||!p.terms.length||p.terms.length>30||!Array.isArray(p.completed)||typeof p.name!=='string'||!p.name.trim())throw new Error('计划缺少必要字段');
 const codes=new Set(catalog.map(c=>c.code)),seen=new Set<string>(),ids=new Set<string>();
 const check=(code:string)=>{if(!codes.has(code)||seen.has(code))throw new Error(`课程 ${code} 不在当前目录中或重复出现`);seen.add(code);return code;};
 const completed=p.completed.map(check),terms=p.terms.map(t=>{if(typeof t.id!=='string'||ids.has(t.id)||!Number.isInteger(t.year)||t.year<2000||t.year>2100||!['Autumn','Spring','Summer'].includes(t.season)||!Array.isArray(t.courseCodes))throw new Error('学期格式不正确');ids.add(t.id);return {id:t.id,year:t.year,season:t.season,courseCodes:t.courseCodes.map(check)};});
 const order={Autumn:0,Spring:1,Summer:2};for(let i=1;i<terms.length;i++)if(terms[i].year*3+order[terms[i].season]<=terms[i-1].year*3+order[terms[i-1].season])throw new Error('学期必须按时间顺序排列');
 let planningMeta:PlanningMeta|undefined;
 if(p.planningMeta){const m=p.planningMeta;
  if((m.mode!=='stage'&&m.mode!=='degree')||typeof m.title!=='string'||m.title.length>100||typeof m.ruleVersion!=='string'||m.ruleVersion.length>100||!Number.isInteger(m.targetCredits)||m.targetCredits<1||m.targetCredits>600||!Number.isInteger(m.priorCreditsSnapshot)||m.priorCreditsSnapshot<0||m.priorCreditsSnapshot>600||typeof m.generatedAt!=='string'||m.generatedAt.length>40||!Number.isFinite(Date.parse(m.generatedAt))||!Array.isArray(m.waivedCodes))throw new Error('路径方案元数据格式不正确');
  const waivedCodes=m.waivedCodes.map(check);const waiverCP=catalog.filter(c=>waivedCodes.includes(c.code)).reduce((sum,c)=>sum+(c.credit_points??0),0);if(waivedCodes.length&&waiverCP!==m.priorCreditsSnapshot)throw new Error('认可学分与课程映射不一致');
  const waiverGroups:Record<string,string>={};if(m.waiverGroups){for(const [code,group] of Object.entries(m.waiverGroups)){if(!waivedCodes.includes(code)||!['core','studies','electives','td'].includes(group))throw new Error('认可模块不正确');waiverGroups[code]=group;}}
  planningMeta={waiverGroups,title:m.title,mode:m.mode,targetCredits:m.targetCredits,ruleVersion:m.ruleVersion,generatedAt:m.generatedAt,modified:!!m.modified,waivedCodes,priorCreditsSnapshot:m.priorCreditsSnapshot};
 }
 return {version:2,id:typeof p.id==='string'?p.id:'imported',name:p.name.slice(0,100),datasetId:expectedDataset,completed,terms,...(planningMeta?{planningMeta}:{})};
}

export function semesterChoices(plan:StudyPlan,startYear=2024,endYear=2030):Term[]{
 const terms=[...plan.terms];for(let year=startYear;year<=endYear;year++)for(const season of ['Autumn','Spring'] as const){if(!terms.some(t=>t.year===year&&t.season===season))terms.push({id:`term-${year}-${season.toLowerCase()}`,year,season,courseCodes:[]});}
 const order={Autumn:0,Spring:1,Summer:2};return terms.sort((a,b)=>a.year-b.year||order[a.season]-order[b.season]);
}
export function includeSemester(plan:StudyPlan,term:Term):StudyPlan{
 if(plan.terms.some(t=>t.id===term.id))return plan;if(plan.terms.length>=30)throw new Error('当前最多支持 30 个学期，请使用已有学期');
 const order={Autumn:0,Spring:1,Summer:2};return {...plan,terms:[...plan.terms,{...term,courseCodes:[]}].sort((a,b)=>a.year-b.year||order[a.season]-order[b.season])};
}
