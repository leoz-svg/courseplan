'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,CheckCircle2,LoaderCircle,MessageSquare,RotateCcw,Send,Square,Route} from 'lucide-react';
import {STATIC_DEMO} from '../../lib/runtime';
import type {StudyPlan} from '../../lib/planning';
import type {LearningProfile} from '../../lib/profile';
import type {AgentReply,AgentHandoff} from '../../lib/agent-contract';
import GroundedRecommendations from './GroundedRecommendations';
import CourseIntroduction from './CourseIntroduction';

type Turn={id:number;user:string;reply?:AgentReply;error?:string};
const labels:Record<string,string>={get_context:'读取计划',search_courses:'检索课程',check_courses:'先修检查',prepare_pathway:'整理规划条件',solve_pathway:'路径求解'};
export default function PlanningAssistant({plan,profile,target,onSelect,onHandoff}:{plan:StudyPlan;profile:LearningProfile;target:string;onSelect:(code:string)=>void;onHandoff:(value:AgentHandoff)=>void}){
 const [turns,setTurns]=useState<Turn[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[elapsed,setElapsed]=useState(0),[status,setStatus]=useState<{generationReady:boolean;embeddingReady:boolean;generation:string}|null>(null);
 const session=useRef<string|undefined>(undefined),request=useRef<AbortController|null>(null),bottom=useRef<HTMLDivElement>(null),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;if(!STATIC_DEMO)fetch('/api/ai-status').then(r=>r.json()).then(x=>{if(mounted.current)setStatus(x);}).catch(()=>{});return()=>{mounted.current=false;request.current?.abort();};},[]);
 useEffect(()=>{if(!busy)return;setElapsed(0);const timer=setInterval(()=>setElapsed(n=>n+1),1000);return()=>clearInterval(timer);},[busy]);
 useEffect(()=>{if(turns.length)bottom.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[turns,busy]);
 const send=async(message:string,draftId?:string)=>{
  if(busy||STATIC_DEMO||(!message.trim()&&!draftId))return;
  const id=Date.now();setTurns(t=>[...t,{id,user:draftId?'确认上述条件，生成候选方案':message.trim()}]);setQuery('');setBusy(true);
  const controller=new AbortController();request.current=controller;
  try{const response=await fetch('/api/agent',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({action:draftId?'confirm':'message',sessionId:session.current,message,draftId,plan,profile:{...profile,displayName:'用户',studentId:''},target})});const data=await response.json();if(!response.ok)throw new Error(data.error||'助手请求失败');if(controller.signal.aborted)return;session.current=data.sessionId;setTurns(t=>t.map(v=>v.id===id?{...v,reply:data}:v));}
  catch(e){if(mounted.current)setTurns(t=>t.map(v=>v.id===id?{...v,error:controller.signal.aborted?'已停止等待；当前计划未修改。如刚提交过求解条件，请重新整理后再计算。':e instanceof Error?e.message:'请求失败'}:v));}
  finally{if(mounted.current)setBusy(false);}
 };
 const latest=turns.at(-1)?.reply;
 if(STATIC_DEMO)return <div className="ai-workspace"><h1>AI 规划助手（本地功能）</h1><p>对话与工具调用需要本地 Ollama 和规划服务。在线演示仍可使用下方关键词检索。</p><GroundedRecommendations programId={profile.programId} plan={plan} target={target} onSelect={onSelect}/></div>;
 return <div className="planning-assistant"><header className="assistant-heading"><div><span className="ai-eyebrow"><MessageSquare size={15}/>AI PLANNING ASSISTANT</span><h1>AI 规划助手</h1><p>描述兴趣或规划要求；助手可检索课程、检查先修条件，并整理可确认的规划条件。</p></div><button className="outline-button" disabled={busy} onClick={()=>{session.current=undefined;setTurns([]);setQuery('');}}><RotateCcw size={14}/>新对话</button></header>
 <div className="assistant-context"><span>{status?.generationReady?`本地模型 · ${status.generation}`:status?'生成模型未就绪':'检查本地模型…'}</span><span>{status?.embeddingReady?'向量检索可用':'向量不可用时回退关键词'}</span><span>档案累计目标 {profile.targetCredits} CP</span><span>认可 {profile.priorCredits} CP</span></div>
 <p className="assistant-scope">对话仅保留在本地服务内存，30分钟不活动后过期。切换计划、专业或推荐学期会开始新对话；工具不会直接修改已修记录或保存计划。</p>
 {!turns.length&&<div className="assistant-empty"><MessageSquare size={30}/><h2>课程咨询与学分规划</h2><p>可以先问课程，再补充负载和目标；规划条件确认后才会计算。</p><div className="assistant-prompts">{['我想学游戏开发，有哪些相关课程？','帮我按档案目标规划，每学期最多18 CP','帮我检查41039在当前目标学期的先修条件'].map(text=><button key={text} onClick={()=>setQuery(text)}>{text}<ArrowRight size={13}/></button>)}</div></div>}
 <div className="assistant-messages" role="log" aria-label="规划助手对话" aria-live="polite">{turns.map(turn=><article key={turn.id} className="assistant-turn"><div className="assistant-user"><span>你</span><p>{turn.user}</p></div>{turn.error&&<p className="form-error" role="alert">{turn.error}</p>}{turn.reply&&<div className="assistant-answer"><span className="assistant-role">{turn.reply.mode==='solver'?'规划服务':turn.reply.mode==='unavailable'?'服务状态':'规划助手 · 本地模型'}</span><p className="assistant-text">{turn.reply.text.replace(/\*\*/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')}</p>
 {turn.reply.traces.length>0&&<details className="assistant-traces" open><summary>实际工具调用 · {turn.reply.traces.length} 次</summary>{turn.reply.traces.map((trace,i)=><div key={i} className={trace.status==='error'?'trace-error':''}><CheckCircle2 size={13}/><strong>{labels[trace.tool]??trace.tool}</strong><span>{trace.summary}</span></div>)}</details>}
 {turn.reply.courses.length>0&&<div className="assistant-course-grid">{turn.reply.courses.map(c=><article key={c.code} className="assistant-course"><button onClick={()=>onSelect(c.code)}><b>{c.code}</b><span>{c.title}</span><ArrowRight size={14}/></button><CourseIntroduction code={c.code} compact/><span className={`eligibility ${c.eligibility}`}>{c.eligibility==='met'?'目标学期满足已录入先修条件':c.eligibility==='unmet'?'目标学期缺少先修条件':'条件待核验'} · {c.credits??'?'} CP</span><details><summary>先修条件与来源</summary>{c.rules.map((r,i)=><p key={i}>{r}</p>)}{!c.rules.length&&<p>未完整录入学术条件，不能视为无先修要求。</p>}<a href={c.url} target="_blank" rel="noreferrer">UTS Handbook 2024 ↗</a></details></article>)}</div>}
 {turn.reply.draft&&<section className="assistant-draft"><h3><Route size={16}/>待确认的规划条件</h3><dl><div><dt>累计学分目标</dt><dd>{turn.reply.draft.options.targetCredits} CP（含已修与认可）</dd></div><div><dt>每学期上限</dt><dd>{turn.reply.draft.options.maxPerTerm} CP</dd></div><div><dt>起始学期</dt><dd>{turn.reply.draft.options.startYear} {turn.reply.draft.options.startSeason}</dd></div><div><dt>已有安排</dt><dd>{turn.reply.draft.options.keepExisting?'保留':'允许重新安排'}</dd></div><div><dt>开课依据</dt><dd>{turn.reply.draft.options.strictOfferings?'仅明确历史开课':'允许待确认的开课假设'}</dd></div><div><dt>兴趣偏好</dt><dd>{turn.reply.draft.options.interest||'未指定'}</dd></div><div><dt>必选课程</dt><dd>{turn.reply.draft.options.requiredCodes.join('、')||'未指定'}</dd></div><div><dt>排除课程</dt><dd>{turn.reply.draft.options.excludedCodes.join('、')||'未指定'}</dd></div><div><dt>认可课程映射</dt><dd>{turn.reply.draft.options.waivedCodes.join('、')||'无（需要时在路径面板填写）'}</dd></div></dl><p>阶段学分规划，不等于正式毕业审核。你可以继续发送修改要求；采用方案需要在路径面板再次确认。</p><button className="primary-button" disabled={busy||latest?.draft?.id!==turn.reply.draft.id} onClick={()=>void send('',turn.reply!.draft!.id)}>确认条件并生成方案<ArrowRight size={14}/></button></section>}
 {turn.reply.handoff&&turn.reply.handoff.result.proposals.length>0&&<button className="primary-button" disabled={busy||latest?.handoff?.id!==turn.reply.handoff.id} onClick={()=>onHandoff(turn.reply!.handoff!)}>在路径方案中查看（{turn.reply.handoff.result.proposals.length} 个）<ArrowRight size={14}/></button>}
 </div>}</article>)}<div ref={bottom}/></div>
 {busy&&<div className="assistant-busy" role="status"><LoaderCircle size={16} className="spinner"/>{elapsed<30?'正在理解需求并调用本地工具…':'本地模型或求解器仍在处理，请稍候…'} {elapsed}s<button className="quiet-button" onClick={()=>request.current?.abort()}><Square size={12}/>停止等待</button></div>}
 <form className="assistant-composer" onSubmit={e=>{e.preventDefault();void send(query);}}><label htmlFor="assistant-message">兴趣、课程问题或规划调整</label><textarea id="assistant-message" aria-label="规划助手消息" value={query} onChange={e=>setQuery(e.target.value)} maxLength={1200} placeholder="例如：我想做游戏开发，每学期最多18 CP。先帮我看看相关课程。" rows={3}/><div><span>先修与学分由规则层计算；资料为2024历史快照。</span><button className="primary-button" type="submit" disabled={busy||!query.trim()}><Send size={14}/>发送</button></div></form>
 <details className="assistant-quick"><summary>单次课程检索（保留原推荐功能）</summary><GroundedRecommendations programId={profile.programId} plan={plan} target={target} onSelect={onSelect}/></details></div>;
}
