import {NextResponse} from 'next/server';
import {solvePathways} from '../../../lib/pathway-service';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{const raw=await req.text();if(raw.length>100000)return NextResponse.json({error:'请求过大'},{status:413});
  return NextResponse.json(await solvePathways(JSON.parse(raw),req.signal));
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'路径计算失败'},{status:400});}
}
