import {mergeCatalogSnapshot} from './catalog-merge';
import {catalogForProgram} from './catalog-data';
import {getProgram} from './programs';
import {type CatalogCourse} from './planning';
export async function getCatalog(programId='computing'):Promise<{courses:CatalogCourse[];source:'supabase'|'snapshot';datasetId:string;notice?:string}>{
 const program=getProgram(programId),DATASET=program.datasetId,snapshot=catalogForProgram(programId);
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(programId==='computing'&&url&&key){try{const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/catalog_subjects?dataset_id=eq.${DATASET}&select=*&order=code`,{headers:{apikey:key},signal:AbortSignal.timeout(5000),cache:'no-store'});
 if(!response.ok)throw new Error('Catalog unavailable');const rows=await response.json();if(!Array.isArray(rows)||!rows.length||rows.some(r=>r.dataset_id!==DATASET||!r.code||!r.title||!Array.isArray(r.rules)))throw new Error('Unexpected catalog');
 const merged=mergeCatalogSnapshot(snapshot,rows);
 return {courses:merged,source:'supabase',datasetId:DATASET,notice:'云端目录已合并本地核对过的官方历史课程扩充资料。'};}catch{return {courses:snapshot as CatalogCourse[],source:'snapshot',datasetId:DATASET,notice:'云端目录暂不可用，当前显示本地历史快照。'};}}
 return {courses:snapshot as CatalogCourse[],source:'snapshot',datasetId:DATASET};
}
