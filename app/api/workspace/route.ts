import {NextResponse} from 'next/server';
import {sessionUser,readWorkspace,writeWorkspace,AccountError,assertSameOrigin,readJSON} from '../../../lib/account-store';
import {getProgram} from '../../../lib/programs';
import {catalogForProgram} from '../../../lib/catalog-data';
import {restorePlan} from '../../../lib/planning';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=sessionUser(req);if(!user)throw new AccountError('请重新登录',401);const p=getProgram(new URL(req.url).searchParams.get('program')||'computing');return NextResponse.json(readWorkspace(user.id,p.id),{headers:{'Cache-Control':'no-store'}});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'读取计划失败'},{status:e instanceof AccountError?e.status:400});}}
export async function PUT(req:Request){try{assertSameOrigin(req);const user=sessionUser(req);if(!user)throw new AccountError('请重新登录',401);const body=await readJSON(req,500000);const p=getProgram(String(body?.programId));const workspace=body.workspace as {plan:unknown;others:unknown[];trash:unknown[]};
 if(!workspace||!Array.isArray(workspace.others)||!Array.isArray(workspace.trash)||workspace.others.length>30||workspace.trash.length>30)throw new AccountError('工作区格式不正确');
 const catalog=catalogForProgram(p.id),restore=(value:unknown)=>restorePlan(value,catalog,p.datasetId);const normalized={plan:restore(workspace.plan),others:workspace.others.map(restore),trash:workspace.trash.map(restore)};
 const ids=[normalized.plan,...normalized.others,...normalized.trash].map(p=>p.id);if(new Set(ids).size!==ids.length)throw new AccountError('计划编号重复');
 return NextResponse.json({updatedAt:writeWorkspace(user.id,p.id,normalized)});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'保存计划失败'},{status:e instanceof AccountError?e.status:400});}}
