import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import type {CatalogCourse} from './planning';
import {retrieveCourses,type Candidate} from './grounded-recommendations';
import {vectorDocuments,rankVectors,cosine} from './vector-search';
export const ollamaURL=()=> (process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
export const embeddingModel=()=>process.env.OLLAMA_EMBED_MODEL||'embeddinggemma';
type Index={key:string;dimensions:number;rows:{code:string;vector:number[]}[]};
const pending=new Map<string,Promise<Index>>();
async function embed(input:string[]):Promise<number[][]>{
 const r=await fetch(`${ollamaURL()}/api/embed`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:embeddingModel(),input,truncate:false,keep_alive:'5m'}),signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new Error(`Embedding HTTP ${r.status}`);
 const data=await r.json();const vectors=data.embeddings as number[][];
 if(!Array.isArray(vectors)||vectors.length!==input.length)throw new Error('Invalid embedding batch');
 vectors.forEach(v=>cosine(v,v));if(vectors.some(v=>v.length!==vectors[0].length))throw new Error('Inconsistent embedding dimensions');return vectors;
}
async function getIndex(catalog:CatalogCourse[]):Promise<Index>{
 const tags=await fetch(`${ollamaURL()}/api/tags`,{signal:AbortSignal.timeout(5000),cache:'no-store'});if(!tags.ok)throw new Error('Ollama unavailable');
 const data=await tags.json();const name=embeddingModel();const model=data.models?.find((m:{name:string})=>m.name===name||m.name===`${name}:latest`);if(!model?.digest)throw new Error('Embedding model not installed');
 const docs=vectorDocuments(catalog);
 const key=createHash('sha256').update(JSON.stringify({version:1,model:name,digest:model.digest,docs})).digest('hex');
 const existing=pending.get(key);if(existing)return existing;
 const load=async()=>{
  const folder=path.resolve(process.env.RAG_INDEX_DIR||'.rag-index'),file=path.join(folder,`${key}.json`);
  try{const cached=JSON.parse(await readFile(file,'utf8')) as Index;
   if(cached.key===key&&cached.rows.length===docs.length&&cached.dimensions>0&&cached.rows.every((r,i)=>r.code===docs[i].code&&r.vector.length===cached.dimensions&&cosine(r.vector,r.vector)>.99))return cached;
  }catch{/* Rebuild absent, stale or corrupt index. */}
  const vectors=await embed(docs.map(d=>d.text));const index:Index={key,dimensions:vectors[0].length,rows:docs.map((d,i)=>({code:d.code,vector:vectors[i]}))};
  await mkdir(folder,{recursive:true});const temporary=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,JSON.stringify(index));await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}return index;
 };
 const promise=load();pending.set(key,promise);
 try{return await promise;}finally{pending.delete(key);}
}
export async function retrieveVectorCourses(query:string,catalog:CatalogCourse[],excluded:string[]){
 const index=await getIndex(catalog);const expansion=[...new Set(retrieveCourses(query,catalog,excluded,catalog.length).flatMap(c=>c.matchedTerms))].filter(term=>!query.toLowerCase().includes(term));
 const expandedQuery=expansion.length?`${query} ${expansion.join(' ')}`:query;const [queryVector]=await embed([`task: search result | query: ${expandedQuery}`]);
 const configured=Number(process.env.RAG_MIN_SIMILARITY??'0.24');const threshold=Number.isFinite(configured)&&configured>=0&&configured<=1?configured:.24;
 const ranked=rankVectors(queryVector,index.rows,excluded,threshold);
 const candidates:Candidate[]=ranked.map(hit=>{const course=catalog.find(c=>c.code===hit.code)!;
  return {course,score:hit.score,matchedTerms:[],evidence:[{id:`${course.code}:title`,text:`${course.code} ${course.title}; ${course.credit_points??'unknown'} CP; handbook year 2024.`,url:course.source_url},...course.rules.filter(r=>r.kind==='academic').map((r,i)=>({id:`${course.code}:academic:${i}`,text:r.raw_text.slice(0,1500),url:r.source_url}))]};
 });
 return {candidates,queryExpanded:expansion.length>0,embeddingModel:embeddingModel(),dimensions:index.dimensions,indexedCourses:index.rows.length};
}
