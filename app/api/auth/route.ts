import {NextResponse} from 'next/server';
import {sessionUser,registerAccount,loginAccount,endSession,createSession,AccountError,assertSameOrigin,readJSON} from '../../../lib/account-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){return NextResponse.json({user:sessionUser(req)},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){try{assertSameOrigin(req);const body=await readJSON(req);if(!body)throw new AccountError('请求格式不正确');
 if(body.action==='logout'){endSession(req);const r=NextResponse.json({ok:true});r.cookies.set('courseplan_session','',{httpOnly:true,sameSite:'lax',path:'/',maxAge:0});return r;}
 const user=body.action==='register'?await registerAccount(body.email,body.password):body.action==='login'?await loginAccount(body.email,body.password):null;
 if(!user)throw new AccountError('不支持的账号操作');const response=NextResponse.json({user});response.cookies.set('courseplan_session',createSession(user.id),{httpOnly:true,sameSite:'lax',path:'/',maxAge:604800,secure:new URL(req.url).protocol==='https:'});return response;
 }catch(e){return NextResponse.json({error:e instanceof AccountError?e.message:'账号服务暂不可用'},{status:e instanceof AccountError?e.status:500});}}
