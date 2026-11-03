import type {StudyPlan,CatalogCourse,Term} from './planning';
export type PathwayOptions={mode:'stage'|'degree';targetCredits:number;maxPerTerm:number;startYear:number;startSeason:'Autumn'|'Spring';strictOfferings:boolean;keepExisting:boolean;interest:string;excludedCodes:string[];requiredCodes:string[];waivedCodes:string[];waiverGroups:Record<string,string>;acceptProvisional:boolean;preferenceScores?:Record<string,number>};
export type PathwayProposal={id:string;style:string;title:string;solverStatus:string;optimal:boolean;targetCredits:number;achievedCredits:number;newCredits:number;finalCredits:number;finish:Term|null;semesterCount:number;peakCredits:number;terms:Term[];waivedCodes:string[];waiverGroups:Record<string,string>;allocations:Record<string,string[]>;warnings:string[];assumptionCodes:string[];interestMatches:string[];auditPassed:boolean};
export type PathwayResult={status:string;messages:string[];proposals:PathwayProposal[];searchStatuses?:string[];elapsedSeconds?:number;programId?:string;ruleVersion?:string;catalogCount?:number;sources?:string[]};
export function validatePathwayOptions(value:unknown,catalog:CatalogCourse[]):PathwayOptions{
 if(!value||typeof value!=='object')throw new Error('请填写路径条件');const o=value as PathwayOptions;
 if(o.mode!=='stage'&&o.mode!=='degree')throw new Error('请选择规划模式');
 for(const [key,min,max] of [['targetCredits',1,600],['maxPerTerm',6,36],['startYear',2024,2030]] as const)if(!Number.isInteger(o[key])||o[key]<min||o[key]>max)throw new Error(`${key} 超出允许范围`);
 if(o.startSeason!=='Autumn'&&o.startSeason!=='Spring')throw new Error('起始学期不正确');
 if(typeof o.strictOfferings!=='boolean'||typeof o.keepExisting!=='boolean'||typeof o.acceptProvisional!=='boolean')throw new Error('规划选项格式不正确');
 if(typeof o.interest!=='string'||o.interest.length>300)throw new Error('兴趣描述最多 300 字');
 const codes=new Set(catalog.map(c=>c.code));const list=(values:unknown)=>{if(!Array.isArray(values)||values.length>100||values.some(c=>typeof c!=='string'||!codes.has(c)))throw new Error('课程编号不属于当前 Program 目录');return [...new Set(values as string[])];};
 const excludedCodes=list(o.excludedCodes),requiredCodes=list(o.requiredCodes),waivedCodes=list(o.waivedCodes);
 if(!o.waiverGroups||typeof o.waiverGroups!=='object'||Array.isArray(o.waiverGroups))throw new Error('认可模块格式不正确');
 const waiverGroups:Record<string,string>={};for(const [code,group] of Object.entries(o.waiverGroups)){if(!waivedCodes.includes(code)||!['core','studies','electives','td'].includes(group))throw new Error('认可模块不正确');waiverGroups[code]=group;}
 return {...o,excludedCodes,requiredCodes,waivedCodes,waiverGroups,preferenceScores:undefined};
}
export function proposalToPlan(proposal:PathwayProposal,base:StudyPlan,mode:'stage'|'degree',ruleVersion:string,priorCredits:number):StudyPlan{
 return {version:2,id:crypto.randomUUID(),name:`${proposal.title} · ${proposal.targetCredits} CP`,datasetId:base.datasetId,completed:[...base.completed],terms:proposal.terms.length?proposal.terms.map(t=>({...t,courseCodes:[...t.courseCodes]})):base.terms.map(t=>({...t,courseCodes:[]})),planningMeta:{title:proposal.title,mode,targetCredits:proposal.targetCredits,ruleVersion,generatedAt:new Date().toISOString(),modified:false,waivedCodes:[...proposal.waivedCodes],waiverGroups:proposal.waiverGroups,priorCreditsSnapshot:priorCredits}};
}
