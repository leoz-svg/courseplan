import {NextResponse} from 'next/server';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {getProgram} from '../../../lib/programs';
import {getCatalog} from '../../../lib/catalog';
import {restorePlan} from '../../../lib/planning';
import {validatePathwayOptions} from '../../../lib/pathways';
import {retrieveVectorCourses} from '../../../lib/vector-rag';
import {retrieveCourses} from '../../../lib/grounded-recommendations';
import requirements from '../../data/catalog/design-requirements.json';
import designEvidence from '../../data/catalog/design-option-evidence.json';
import expandedEvidence from '../../data/catalog/expanded-program-evidence.json';
import programEvidence from '../../data/catalog/program-source-evidence.json';
export const runtime='nodejs';export const dynamic='force-dynamic';
let active=0;
export async function POST(req:Request){
 if(active>=2)return NextResponse.json({error:'正在计算其他方案，请稍后重试'},{status:429});
 let job;
 try{const raw=await req.text();if(raw.length>100000)return NextResponse.json({error:'请求过大'},{status:413});const body=JSON.parse(raw);const program=getProgram(body.programId);const {courses}=await getCatalog(program.id);const plan=restorePlan(body.plan,courses);const options=validatePathwayOptions(body.options,courses);
  if(!Number.isInteger(body.priorCredits)||body.priorCredits<0||body.priorCredits>600)throw new Error('认可学分不正确');
  if(!Number.isInteger(body.entryYear)||body.entryYear<2000||body.entryYear>2100)throw new Error('入学年份不正确');
  if(options.mode==='degree'&&(program.id!=='design'||!options.acceptProvisional||options.targetCredits!==144))throw new Error('毕业路线目前仅支持明确确认规则依据后的视觉传达 2024 草案，目标固定 144 CP');
  const matches=retrieveCourses(options.interest,courses,[],courses.length);options.preferenceScores=Object.fromEntries(matches.map(m=>[m.course.code,m.score*100]));
  if(options.interest.trim()){try{const semantic=await retrieveVectorCourses(options.interest,courses,[]);for(const match of semantic.candidates)options.preferenceScores[match.course.code]=Math.max(options.preferenceScores[match.course.code]??0,Math.round(match.score*100));}catch{/* Known title synonyms still provide deterministic soft preferences. */}}
  const semesterHints=Object.fromEntries(program.columns.flatMap(col=>col.codes.map(code=>[code,col.label.includes('Autumn')?'Autumn':col.label.includes('Spring')?'Spring':null])));
  const availabilityEvidence=Object.fromEntries([...programEvidence,...designEvidence,...expandedEvidence].filter(e=>courses.some(c=>c.code===e.code)).map(e=>[e.code,e.availability]));
  job={programId:program.id,catalog:courses,plan,options,priorCredits:body.priorCredits,entryYear:body.entryYear,requirements:options.mode==='degree'?requirements:null,semesterHints,availabilityEvidence};
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'请求格式不正确'},{status:400});}
 active++;
 try{const result=await new Promise<Record<string,unknown>>((resolve,reject)=>{
  const executable=process.env.COURSEPLAN_PLANNER_PYTHON||path.join(process.cwd(),'.planner-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  const child=spawn(executable,[path.join(process.cwd(),'scripts/pathways/solve.py')],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',errors='';const timer=setTimeout(()=>{child.kill();reject(new Error('方案搜索超时，请缩小规划范围后重试'));},25000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;if(output.length>2000000){child.kill();reject(new Error('方案输出过大'));}});child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-2000);});
  child.on('error',()=>{clearTimeout(timer);reject(new Error('规划求解器未就绪，请检查本地 Python 环境'));});child.on('close',code=>{clearTimeout(timer);if(code!==0){console.error('Pathway solver failed',errors);reject(new Error('规划求解器运行失败'));return;}try{resolve(JSON.parse(output));}catch{reject(new Error('求解器没有返回有效结果'));}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(job));
 });
 return NextResponse.json({...result,programId:getProgram(job.programId).id,ruleVersion:job.options.mode==='degree'?requirements.id:'stage-2024-catalog',catalogCount:job.catalog.length,sources:job.options.mode==='degree'?requirements.sourceUrls:[getProgram(job.programId).sourceUrl]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'路径计算失败'},{status:503});}finally{active--;}
}