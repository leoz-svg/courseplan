import type {CatalogCourse,ConditionState} from './planning';
export type Evidence={id:string;text:string;url:string};
export type Candidate={course:CatalogCourse;evidence:Evidence[];matchedTerms:string[];score:number};
export type GroundedRecommendation={code:string;title:string;reason:string;eligibility:ConditionState;evidence:Evidence[]};
export function groundedReason(course:CatalogCourse):string{return `根据课程标题「${course.title}」，模型将其选为与兴趣相关的候选。`;}
const aliases:Record<string,string[]>={'摄影':['photography','photo'],'动画':['animation','motion'],'影像':['image','video','motion'],'交互':['interaction','experience'],'可持续':['sustainability','sustainable','futuring'],'创意编程':['creative','code'],'艺术':['design','visual'],'视觉':['visual'],'字体':['typography'],'排版':['typography'],'商科':['business','accounting','finance'],'会计':['accounting'],'金融':['finance'],'营销':['marketing'],'经济':['economics'],'统计':['statistics'],'游戏':['game','graphics'],'数据':['data','database','algorithms'],'编程':['programming'],'网络':['network','web'],'设计':['design'],'图像':['image','graphics'],'软件':['system','programming','requirements'],'人工智能':['image','pattern','data'],'机器学习':['pattern','data'],'game':['game','graphics'],'coding':['programming'],'ai':['image','pattern','data']};
const stop=new Set(['i','want','to','learn','the','a','an','and','in','about','interested','am','would','like','courses','course','for','me']);
export function retrieveCourses(query:string,catalog:CatalogCourse[],excluded:string[],limit=5):Candidate[]{
 const q=query.toLowerCase().trim(),tokens=(q.match(/[a-z0-9]+/g)??[]).filter(t=>!stop.has(t));
 const terms=[...new Set([...tokens,...Object.entries(aliases).filter(([key])=>/[\u3400-\u9fff]/.test(key)?q.includes(key):tokens.includes(key)).flatMap(([,values])=>values)])];
 if(!terms.length)return [];
 return catalog.filter(c=>!excluded.includes(c.code)).map(course=>{
  const title=course.title.toLowerCase(),matchedTerms=terms.filter(t=>title.includes(t)||course.code===t);
  const evidence:Evidence[]=[{id:`${course.code}:title`,text:`${course.code} ${course.title}; ${course.credit_points??'unknown'} CP; handbook year 2024.`,url:course.source_url},...course.rules.filter(r=>r.kind==='academic').map((r,i)=>({id:`${course.code}:academic:${i}`,text:r.raw_text.slice(0,1500),url:r.source_url}))];
  return {course,evidence,matchedTerms,score:matchedTerms.length};
 }).filter(c=>c.score>0).sort((a,b)=>b.score-a.score||a.course.code.localeCompare(b.course.code)).slice(0,limit);
}
export function validateGeneratedItems(value:unknown,candidates:Candidate[]):{candidate:Candidate;reason:string;evidence:Evidence[]}[]{
 if(!value||typeof value!=='object'||!Array.isArray((value as {items?:unknown}).items))return [];
 const seen=new Set<string>();const output:{candidate:Candidate;reason:string;evidence:Evidence[]}[]=[];
 for(const item of (value as {items:unknown[]}).items){
  if(!item||typeof item!=='object')continue;const row=item as Record<string,unknown>;
  const candidate=candidates.find(c=>c.course.code===row.course_code);if(!candidate||seen.has(candidate.course.code)||typeof row.reason!=='string'||!row.reason.trim()||row.reason!==groundedReason(candidate.course)||!Array.isArray(row.evidence_ids)||!row.evidence_ids.length)continue;
  if(row.evidence_ids.some(id=>typeof id!=='string'||!candidate.evidence.some(e=>e.id===id)))continue;
  seen.add(candidate.course.code);output.push({candidate,reason:row.reason,evidence:candidate.evidence.filter(e=>(row.evidence_ids as unknown[]).includes(e.id))});
 }
 return output.slice(0,3);
}
