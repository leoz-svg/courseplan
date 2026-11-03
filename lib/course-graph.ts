import type {CatalogCourse,RuleNode} from './planning';
export type CourseEdge={from:string;to:string;timing:'prior'|'concurrent'};
export type GraphLayout={positions:Record<string,{x:number;y:number;level:number}>;edges:CourseEdge[];missing:{from:string;to:string}[];width:number;height:number;levels:number;columns:{level:number;x:number;width:number}[];sharedGroups:number};
const references=(n:RuleNode):{code:string;timing:'prior'|'concurrent'}[]=>n.op==='subject'?[{code:n.code,timing:n.timing}]:'children' in n?n.children.flatMap(references):[];
export function catalogGraph(catalog:CatalogCourse[]){
 const known=new Set(catalog.map(c=>c.code)),seen=new Set<string>(),edges:CourseEdge[]=[],missing:{from:string;to:string}[]=[];
 for(const c of catalog)for(const rule of c.rules.filter(r=>r.kind==='academic'))for(const ref of references(rule.expression)){
  const key=`${ref.code}:${c.code}:${ref.timing}`;if(seen.has(key))continue;seen.add(key);
  if(known.has(ref.code))edges.push({from:ref.code,to:c.code,timing:ref.timing});else missing.push({from:ref.code,to:c.code});
 }
 return {edges,missing};
}
/** Reachability uses every recorded alternative for exploration; it does not evaluate AND/OR eligibility. */
export function courseChain(selected:string,edges:CourseEdge[]){
 const walk=(backward:boolean)=>{const out=new Set<string>(),queue=[selected];while(queue.length){const c=queue.shift()!;for(const e of edges){if((backward?e.to:e.from)!==c)continue;const next=backward?e.from:e.to;if(next!==selected&&!out.has(next)){out.add(next);queue.push(next);}}}return out;};
 return {ancestors:walk(true),descendants:walk(false)};
}
export function graphScope(catalog:CatalogCourse[],seeds:string[],selected:string,focus:boolean){
 const {edges}=catalogGraph(catalog),known=new Set(catalog.map(c=>c.code));
 const chain=courseChain(selected,edges);
 if(focus)return new Set([selected,...chain.ancestors,...chain.descendants].filter(c=>known.has(c)));
 const scope=new Set(seeds.filter(c=>known.has(c)));
 // Include prerequisite context for every direction, and always reveal a course selected in the catalog.
 if(known.has(selected))scope.add(selected);
 for(const code of [...scope])for(const parent of courseChain(code,edges).ancestors)scope.add(parent);
 return scope;
}
/** SCC condensation keeps shared/corequisite and alternative-reference cycles finite and deterministic. */
export function layoutCourseGraph(catalog:CatalogCourse[],visible:Set<string>):GraphLayout{
 const codes=catalog.map(c=>c.code).filter(c=>visible.has(c)).sort(),set=new Set(codes),full=catalogGraph(catalog),edges=full.edges.filter(e=>set.has(e.from)&&set.has(e.to));
 const next=new Map(codes.map(c=>[c,[] as string[]]));for(const e of edges)next.get(e.from)!.push(e.to);
 let cursor=0;const indices=new Map<string,number>(),low=new Map<string,number>(),stack:string[]=[],active=new Set<string>(),components:string[][]=[];
 const visit=(c:string)=>{indices.set(c,cursor);low.set(c,cursor++);stack.push(c);active.add(c);for(const n of next.get(c)!){if(!indices.has(n)){visit(n);low.set(c,Math.min(low.get(c)!,low.get(n)!));}else if(active.has(n))low.set(c,Math.min(low.get(c)!,indices.get(n)!));}if(low.get(c)===indices.get(c)){const part:string[]=[];let n:string;do{n=stack.pop()!;active.delete(n);part.push(n);}while(n!==c);components.push(part.sort());}};
 for(const c of codes)if(!indices.has(c))visit(c);
 const partOf=new Map(components.flatMap((cs,i)=>cs.map(c=>[c,i] as const))),incoming=components.map(()=>new Set<number>()),outgoing=components.map(()=>new Set<number>());
 for(const e of edges){const a=partOf.get(e.from)!,b=partOf.get(e.to)!;if(a!==b){incoming[b].add(a);outgoing[a].add(b);}}
 const degrees=incoming.map(s=>s.size),levels=components.map(()=>0),queue=degrees.map((d,i)=>d===0?i:-1).filter(i=>i>=0);
 while(queue.length){const a=queue.shift()!;for(const b of outgoing[a]){levels[b]=Math.max(levels[b],levels[a]+1);if(--degrees[b]===0)queue.push(b);}}
 const columns:string[][]=Array.from({length:Math.max(1,...levels.map(l=>l+1))},()=>[]);for(const c of codes)columns[levels[partOf.get(c)!]].push(c);
 // Order each column by predecessor row, with a stable code tie-break.
 const rows=new Map<string,number>();columns.forEach((col,l)=>{if(l)col.sort((a,b)=>{const score=(c:string)=>{const refs=edges.filter(e=>e.to===c&&rows.has(e.from)).map(e=>rows.get(e.from)!);return refs.length?refs.reduce((s,n)=>s+n,0)/refs.length:999;};return score(a)-score(b)||a.localeCompare(b);});col.forEach((c,i)=>rows.set(c,i));});
 const positions:GraphLayout['positions']={},columnBounds:GraphLayout['columns']=[];let offset=36;
 columns.forEach((col,l)=>{const lanes=Math.max(1,Math.ceil(col.length/8));columnBounds.push({level:l,x:offset,width:lanes*300});col.forEach((c,i)=>{positions[c]={x:offset+Math.floor(i/8)*300,y:54+(i%8)*142,level:l};});offset+=lanes*300;});
 return {positions,edges,missing:full.missing.filter(e=>set.has(e.to)),width:Math.max(380,offset-24),height:Math.max(260,...columns.map(c=>Math.min(8,c.length)*142+60)),levels:columns.length,columns:columnBounds,sharedGroups:components.filter(c=>c.length>1).length};
}
