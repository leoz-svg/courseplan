import {NextResponse} from 'next/server';
import {sessionUser,saveProfile,AccountError,assertSameOrigin,readJSON} from '../../../lib/account-store';
import {validateProfileState} from '../../../lib/profile';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function PUT(req:Request){try{assertSameOrigin(req);const user=sessionUser(req);if(!user)throw new AccountError('请重新登录',401);const state=validateProfileState(await readJSON(req));saveProfile(user.id,state);return NextResponse.json({profileState:state});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'档案保存失败'},{status:e instanceof AccountError?e.status:400});}}
