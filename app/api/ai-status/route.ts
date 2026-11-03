import {NextResponse} from 'next/server';
import {ollamaURL,embeddingModel} from '../../../lib/vector-rag';
export const dynamic='force-dynamic';
export async function GET(){
 const generation=process.env.OLLAMA_MODEL||'qwen3:1.7b',embedding=embeddingModel();
 try{const r=await fetch(`${ollamaURL()}/api/tags`,{signal:AbortSignal.timeout(3000),cache:'no-store'});if(!r.ok)throw new Error('Unavailable');
  const data=await r.json();const installed=(name:string)=>data.models?.some((m:{name:string})=>m.name===name||m.name===`${name}:latest`)??false;
  return NextResponse.json({connected:true,generation,embedding,generationReady:installed(generation),embeddingReady:installed(embedding)});
 }catch{return NextResponse.json({connected:false,generation,embedding,generationReady:false,embeddingReady:false});}
}
