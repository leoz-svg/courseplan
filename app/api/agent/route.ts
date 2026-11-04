import {NextResponse} from 'next/server';
import {assertSameOrigin,readJSON,AccountError} from '../../../lib/account-store';
import {runCourseAgent} from '../../../lib/course-agent';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{assertSameOrigin(req);const body=await readJSON(req,100000);return NextResponse.json(await runCourseAgent(body,req.signal),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'助手暂不可用'},{status:e instanceof AccountError?e.status:400,headers:{'Cache-Control':'no-store'}});}
}
