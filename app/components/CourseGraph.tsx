'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Search,ZoomIn,ZoomOut,Maximize2,GitBranch,Check,ArrowRight,Focus,Info} from 'lucide-react';
import type {CatalogCourse,StudyPlan} from '../../lib/planning';
import {courseEligibility} from '../../lib/planning';
import {getProgram} from '../../lib/programs';
import {catalogGraph,courseChain,graphScope,layoutCourseGraph} from '../../lib/course-graph';
import pools from '../data/catalog/expanded-program-pools.json';
import designPools from '../data/catalog/design-pools.json';
const directionNames:Record<string,string>={maj02081:'数据分析',maj03444:'企业软件开发',maj02080:'商业信息系统管理',maj02092:'交互设计',maj03445:'网络与网络安全',maj08440:'金融',maj08438:'管理',maj08441:'市场营销'};
type Props={catalog:CatalogCourse[];programId:string;plan:StudyPlan;targetPlan:StudyPlan;target:string;selected:string;onSelect:(code:string)=>void};
export default function CourseGraph({catalog,programId,plan,targetPlan,target,selected,onSelect}:Props){
 const program=getProgram(programId),marker=useId().replace(/:/g,'');
 const [direction,setDirection]=useState('core'),[focus,setFocus]=useState(false),[search,setSearch]=useState(''),[zoom,setZoom]=useState(.85),[viewport,setViewport]=useState({width:800,height:560});
 const viewportRef=useRef<HTMLDivElement>(null),nodesRef=useRef<Map<string,HTMLButtonElement>>(new Map());

 const options=useMemo(()=>{
  const ids=programId==='computing'?pools.programs.computing:programId==='business'?pools.programs.business:[];
  const official=pools.packages.filter(p=>ids.includes(p.id));
  const core=programId==='design'?program.columns.flatMap(c=>c.codes):official.find(p=>p.id.startsWith('stm'))?.codes??[];
  const majors=official.filter(p=>p.id.startsWith('maj')).map(p=>({id:p.id,name:directionNames[p.id]??p.title.replace(/^MAJ\d+ /,''),codes:p.codes}));
  if(programId==='design')majors.push({id:'studies',name:'Design Studies',codes:designPools.stm91882},{id:'design-options',name:'设计选修',codes:designPools.cbk91878},{id:'td',name:'跨学科选修',codes:designPools.cbk92069});
  return [{id:'core',name:'核心课程',codes:core},...majors,{id:'all',name:'全部课程',codes:catalog.map(c=>c.code)}];
 },[catalog,programId,program.columns]);
 const chosen=options.find(o=>o.id===direction)??options[0],full=useMemo(()=>catalogGraph(catalog),[catalog]);
 const chain=useMemo(()=>courseChain(selected,full.edges),[selected,full]);
 const scope=useMemo(()=>graphScope(catalog,chosen.codes,selected,focus),[catalog,chosen.codes,selected,focus]);
 const layout=useMemo(()=>layoutCourseGraph(catalog,scope),[catalog,scope]);
 const results=useMemo(()=>search.trim()?catalog.filter(c=>`${c.code} ${c.title}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0,8):[],[search,catalog]);
 const related=new Set([selected,...chain.ancestors,...chain.descendants]);
 const extras=[...scope].filter(c=>!chosen.codes.includes(c));
 const fit=()=>{setZoom(Math.max(.1,Math.min(1.1,(viewport.width-24)/layout.width,(viewport.height-24)/layout.height)));viewportRef.current?.scrollTo({top:0,left:0});};
 useEffect(()=>{const el=viewportRef.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setViewport({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(el);return()=>observer.disconnect();},[]);
 const reveal=(code:string)=>{onSelect(code);setSearch('');};
 useEffect(()=>{const node=nodesRef.current.get(selected),view=viewportRef.current;if(!node||!view)return;const point=layout.positions[selected];if(point)view.scrollTo({left:Math.max(0,(point.x+118)*zoom-view.clientWidth/2),top:Math.max(0,(point.y+53)*zoom-view.clientHeight/2)});},[selected,layout,zoom]);
 const selectedCourse=catalog.find(c=>c.code===selected);
 return <section className="course-graph" aria-label="完整目录课程路径"><header className="cg-heading"><div><span className="ai-eyebrow"><GitBranch size={15}/>EXPLORE YOUR PATH</span><h1>从一门课，看见更多可能。</h1><p>按方向展开课程，先修链自动补入。图中的层级表示引用关系，不代表年级或推荐学期。</p></div><span className="cg-count" aria-live="polite"><strong>{scope.size}</strong> / {catalog.length}<small>当前显示 / 全部课程</small></span></header>
 <div className="cg-controls"><label className="cg-direction">课程范围<select aria-label="路径图课程方向" value={direction} onChange={e=>{setDirection(e.target.value);setFocus(false);}}>{options.map(o=><option key={o.id} value={o.id}>{o.name} · {o.codes.length} 门</option>)}</select></label><div className="cg-search"><label><Search size={15}/><input aria-label="在完整路径图搜索课程" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&results[0]){e.preventDefault();reveal(results[0].code);}}} placeholder="搜索全部课程编号或名称"/></label>{search&&<div className="cg-search-results">{results.length?results.map(c=><button key={c.code} onClick={()=>reveal(c.code)}><b>{c.code}</b><span>{c.title}</span><ArrowRight size={13}/></button>):<p>没有匹配课程</p>}</div>}</div><button className={`cg-focus ${focus?'active':''}`} aria-pressed={focus} onClick={()=>setFocus(!focus)}><Focus size={14}/>只看所选课程链</button></div>
 <div className="cg-summary"><span><i className="cg-key selected"/>当前：{selectedCourse?.code} {selectedCourse?.title}</span><span>{chain.ancestors.size} 门先修引用 · {chain.descendants.size} 门后续引用</span></div>
 <div className="cg-viewport" ref={viewportRef} tabIndex={0} aria-label="可滚动课程关系图"><div className="cg-space" style={{width:layout.width*zoom,height:layout.height*zoom}}><div className="cg-stage" style={{width:layout.width,height:layout.height,transform:`scale(${zoom})`}}>
 <svg width={layout.width} height={layout.height} className="cg-lines" aria-hidden="true"><defs><marker id={`${marker}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L0 6 L6 3Z" fill="context-stroke"/></marker></defs>{layout.columns.map(col=><text key={col.level} x={col.x} y={29} className="cg-level">{col.level===0?'起点与独立课程':`关系层级 ${col.level+1}`}</text>)}{layout.edges.map(e=>{const a=layout.positions[e.from],b=layout.positions[e.to],active=related.has(e.from)&&related.has(e.to);const same=a.level===b.level;const path=same?`M${a.x},${a.y+52} C${a.x-24},${a.y+52} ${b.x-24},${b.y+52} ${b.x},${b.y+52}`:`M${a.x+236},${a.y+52} C${a.x+270},${a.y+52} ${b.x-34},${b.y+52} ${b.x},${b.y+52}`;return <path key={`${e.from}-${e.to}-${e.timing}`} className={`cg-edge ${e.timing} ${active?'highlight':''}`} d={path} markerEnd={`url(#${marker}-arrow)`}/>;})}</svg>
 {catalog.filter(c=>scope.has(c.code)).map(c=>{const pos=layout.positions[c.code],waived=plan.planningMeta?.waivedCodes.includes(c.code),done=plan.completed.includes(c.code)||waived,term=plan.terms.find(t=>t.courseCodes.includes(c.code)),state=courseEligibility(c,targetPlan,term?.id??target,catalog),isSelected=c.code===selected,ancestor=chain.ancestors.has(c.code),descendant=chain.descendants.has(c.code);return <button key={c.code} ref={node=>{if(node)nodesRef.current.set(c.code,node);else nodesRef.current.delete(c.code);}} type="button" className={`cg-node ${isSelected?'selected':ancestor?'ancestor':descendant?'descendant':''} ${done?'done':term?'planned':''} ${!chosen.codes.includes(c.code)&&!focus?'context':''}`} style={{left:pos.x,top:pos.y}} aria-label={`${c.code} ${c.title}`} aria-pressed={isSelected} title={`${c.code} ${c.title}`} onClick={()=>onSelect(c.code)}><span className="cg-node-top"><b>{c.code}</b><small>{c.credit_points??'?'} CP</small></span><span className="cg-node-title">{c.title}</span><span className="cg-node-status">{done?<><Check size={11}/>{waived?'已认可':'已完成'}</>:term?'● 已规划':state==='unmet'?'先修待满足':state==='unknown'?'条件待核验':'查看课程条件'}<span>{isSelected?'当前课程':ancestor?'先修引用':descendant?'后续引用':''}</span></span></button>;})}
 </div></div></div>
 <div className="cg-bottom"><div className="cg-legend"><span><i className="cg-key ancestor"/>先修链</span><span><i className="cg-key descendant"/>后续链</span><span><i className="cg-key planned"/>已规划</span><span><i className="cg-key done"/>已完成 / 认可</span><span className="cg-line-key">实线：先修 · 虚线：可共修</span></div><div className="cg-zoom"><button aria-label="缩小路径图" onClick={()=>setZoom(z=>Math.max(.1,Math.round((z-.15)*100)/100))}><ZoomOut size={15}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="放大路径图" onClick={()=>setZoom(z=>Math.min(1.6,Math.round((z+.15)*100)/100))}><ZoomIn size={15}/></button><button onClick={fit}><Maximize2 size={14}/>适应全图</button></div></div>
 <div className="cg-notes"><Info size={14}/><div><p>连线展示全部已录入的先修选项，AND / OR、最低学分和专业准入请看课程详情；没有连线不代表没有限制。</p>{!focus&&extras.length>0&&<p>为保留上下文，已额外显示 {extras.length} 门所选课程或相关先修课程。</p>}{layout.missing.length>0&&<details><summary>{new Set(layout.missing.map(e=>e.from)).size} 个先修编号尚未收录详情</summary><p>{[...new Set(layout.missing.map(e=>e.from))].sort().join('、')}。这些可能是历史等价或替代选项，不直接认定为必须补修。</p></details>}{layout.sharedGroups>0&&<p>互相引用或共修的课程放在同一层，请按详情中的组合条件判断。</p>}</div></div></section>;
}
