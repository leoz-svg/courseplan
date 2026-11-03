import type {CatalogCourse} from './planning';
export type VectorDocument={code:string;text:string};
export function vectorDocuments(catalog:CatalogCourse[]):VectorDocument[]{
 return [...catalog].sort((a,b)=>a.code.localeCompare(b.code)).map(c=>({code:c.code,text:`title: ${c.title} | text: UTS subject ${c.code}. ${c.title}. ${c.credit_points??'Unknown'} credit points. ${c.faculty??''}` }));
}
export function cosine(a:number[],b:number[]):number{
 if(!a.length||a.length!==b.length||!a.every(Number.isFinite)||!b.every(Number.isFinite))throw new Error('Invalid embedding dimensions or values');
 const aa=a.reduce((s,v)=>s+v*v,0),bb=b.reduce((s,v)=>s+v*v,0);
 if(!aa||!bb)throw new Error('Zero embedding');
 return a.reduce((s,v,i)=>s+v*b[i],0)/Math.sqrt(aa*bb);
}
export function rankVectors(query:number[],rows:{code:string;vector:number[]}[],excluded:string[],minimum:number,limit=5){
 const omit=new Set(excluded);
 return rows.filter(r=>!omit.has(r.code)).map(r=>({code:r.code,score:cosine(query,r.vector)})).filter(r=>r.score>=minimum).sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).slice(0,limit);
}
