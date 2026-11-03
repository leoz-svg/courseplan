import {NextResponse} from 'next/server';
import {getCatalog} from '../../../lib/catalog';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return NextResponse.json(await getCatalog(new URL(req.url).searchParams.get('program')||'computing'));}catch{return NextResponse.json({error:'不支持的 Program'},{status:400});}}
