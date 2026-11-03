"""Bounded academic pathway search. Inputs are validated by the API; outputs re-audited here."""
import sys,json,time,math,re
from ortools.sat.python import cp_model

def evaluate(node,prior,same,credits):
 op=node['op']
 if op=='subject':return node['code'] in prior or (node.get('timing')=='concurrent' and node['code'] in same)
 if op=='credits':return credits>=node['minimum']
 if op=='manual':return False
 values=[evaluate(n,prior,same,credits) for n in node.get('children',[])]
 return all(values) if op=='all' else any(values)

def prepare(job):
 catalog={c['code']:c for c in job['catalog']};opts=job['options'];plan=job['plan'];done=set(plan['completed']);waived=set(opts.get('waivedCodes',[]));excluded=set(opts.get('excludedCodes',[]));required=set(opts.get('requiredCodes',[]));prior=job['priorCredits'];requirements=job.get('requirements')
 def cp(codes):return sum(catalog[c]['credit_points'] for c in codes)
 if done&waived:raise ValueError('认可课程与已完成课程重复，请只计入一次。')
 if excluded&(done|waived):raise ValueError('不能排除已完成或已认可课程；请先核对学习记录。')
 if required&excluded:raise ValueError('同一课程不能同时设为必选与排除。')
 if waived and cp(waived)!=prior:raise ValueError('认可课程对应的学分必须等于档案中的认可学分。')
 if opts['mode']=='degree' and cp(waived)!=prior:raise ValueError('毕业草案需要把认可学分映射到具体课程，不能只用一个总数抵扣模块。')
 if requirements:
  required|=set(sum([g['required'] for g in requirements['groups']],[]))
  for c in waived:
   eligible=[g['id'] for g in requirements['groups'] if c in g['pool']]
   group=opts.get('waiverGroups',{}).get(c)
   if len(eligible)>1 and not group:raise ValueError(f'{c} 可计入多个模块，请注明认可模块，如 {c}:studies 或 {c}:electives。')
   if group and group not in eligible:raise ValueError(f'{c} 的认可模块不在官方允许范围内。')
 if required&excluded:raise ValueError('排除列表包含本路线的必修课程，无法生成毕业草案。')
 terms=[{'id':f'path-{y}-{s.lower()}','year':y,'season':s,'courseCodes':[]} for y in range(opts['startYear'],2031) for s in ['Autumn','Spring'] if (y,s!='Autumn') >= (opts['startYear'],opts['startSeason']!='Autumn')]
 if not terms:raise ValueError('没有可用规划学期。')
 index={(t['year'],t['season']):i for i,t in enumerate(terms)};locks={}
 if opts['keepExisting']:
  for t in plan['terms']:
   if not t['courseCodes']:continue
   if (t['year'],t['season']) not in index:raise ValueError('已有安排超出本次起始学期至 2030 Spring 的范围；请调整起始学期、完成状态或取消保留安排。')
   for c in t['courseCodes']:
    if c in waived:raise ValueError('已认可课程仍在现有安排中，请先移出该课程或取消保留安排。')
    locks[c]=index[(t['year'],t['season'])]
 achieved=cp(done)+prior;goal=opts['targetCredits'];remaining=goal-achieved
 if remaining<0:raise ValueError('已完成与认可学分超过本次目标，请提高目标或核对记录。')
 if sum(catalog[c]['credit_points'] for c in locks)>remaining:raise ValueError('保留的已有安排已超过本次剩余学分目标。')
 if remaining and remaining%math.gcd(*[c['credit_points'] for c in catalog.values()]):raise ValueError('当前课程学分组合不能精确达到这个目标，请调整阶段目标。')
 if remaining>sum(c['credit_points'] for code,c in catalog.items() if code not in done|waived|excluded):return {'early':{'status':'INSUFFICIENT_DATA','messages':['当前课程池的可用学分不足以覆盖目标；需要补充课程池或调整阶段目标。'],'proposals':[]}}
 allowed={};assumptions={};blocked=[]
 for code,c in catalog.items():
  seasons={o['session'].title() for o in c.get('offerings',[]) if o['session'].title() in ['Autumn','Spring']}
  raw=job.get('availabilityEvidence',{}).get(code,'');hint=job.get('semesterHints',{}).get(code)
  if seasons:allowed[code]=seasons
  elif c.get('offerings') or raw:
   if re.search(r'Autumn|Spring',raw,re.I):allowed[code]={s for s in ['Autumn','Spring'] if re.search(s,raw,re.I)}
   else:allowed[code]=set();blocked.append(code)
  elif not opts['strictOfferings']:
   allowed[code]={hint} if hint else {'Autumn','Spring'};assumptions[code]='依据培养方案示例学期' if hint else '开课学期待确认'
  else:allowed[code]=set();blocked.append(code)
 missing_required=[c for c in required if c not in done|waived and not allowed[c]]
 if missing_required:return {'early':{'status':'INSUFFICIENT_DATA','messages':['以下必修课程缺少所选政策下可用的 Autumn/Spring 开课资料：'+', '.join(sorted(missing_required))],'proposals':[]}}
 pairs=set()
 for code,c in catalog.items():
  for rule in c['rules']:
   if rule['kind']=='exclusion':
    for other in re.findall(r'(?<![0-9])([0-9]{5})(?![0-9])',rule['raw_text']):
     if other in catalog and other!=code:pairs.add(tuple(sorted([code,other])))
 for a,b in pairs:
  if a in done|waived and b in done|waived:raise ValueError(f'{a} 与 {b} 有互斥/等价冲突，请核对是否重复计分。')
 return dict(catalog=catalog,opts=opts,plan=plan,done=done,waived=waived,excluded=excluded,required=required,requirements=requirements,terms=terms,locks=locks,achieved=achieved,remaining=remaining,allowed=allowed,assumptions=assumptions,pairs=pairs)

def audit(ctx,scheduled,allocations):
 catalog=ctx['catalog'];done=ctx['done'];waived=ctx['waived'];selected=done|waived;seen=set();cp=lambda codes:sum(catalog[c]['credit_points'] for c in codes)
 for i,term in enumerate(scheduled):
  codes=term['courseCodes'];assert not (set(codes)&seen) and len(codes)==len(set(codes));assert not set(codes)&(done|waived|ctx['excluded']);assert cp(codes)<=ctx['opts']['maxPerTerm']
  for c in codes:
   assert c in catalog and term['season'] in ctx['allowed'][c]
   rules=[r for r in catalog[c]['rules'] if r['kind']=='academic'];assert rules and all(evaluate(r['expression'],selected,set(codes),cp(selected)) for r in rules)
   if c in ctx['locks']:assert i==ctx['locks'][c]
  seen.update(codes);selected.update(codes)
 assert ctx['required']<=selected;assert set(ctx['locks'])<=seen
 assert ctx['achieved']+cp(seen)==ctx['opts']['targetCredits']
 for a,b in ctx['pairs']:assert not {a,b}<=selected
 if ctx['requirements']:
  assigned=[]
  for group in ctx['requirements']['groups']:
   codes=allocations[group['id']];assert set(codes)<=set(group['pool']);assert set(group['required'])<=set(codes);assert cp(codes)==group['credits'];assigned+=codes
  assert len(assigned)==len(set(assigned));assert set(assigned)==selected
  for c,g in ctx['opts'].get('waiverGroups',{}).items():assert c in allocations[g]
 return True

def build(ctx,style,previous,earliest,unique_courses=True):
 catalog=ctx['catalog'];codes=list(catalog);terms=ctx['terms'];T=len(terms);opts=ctx['opts'];done=ctx['done']|ctx['waived'];model=cp_model.CpModel();x={};q={}
 for c in codes:
  if c in done:q[c]=1;continue
  for t in range(T):x[c,t]=model.NewBoolVar(f'x_{c}_{t}')
  q[c]=model.NewBoolVar('selected_'+c);model.Add(sum(x[c,t] for t in range(T))==q[c])
  if c in ctx['excluded']:model.Add(q[c]==0)
  for t in range(T):
   if terms[t]['season'] not in ctx['allowed'][c]:model.Add(x[c,t]==0)
 for c in ctx['required']:model.Add(q[c]==1)
 for c,t in ctx['locks'].items():model.Add(x[c,t]==1)
 for a,b in ctx['pairs']:model.Add(q[a]+q[b]<=1)
 cache={}
 def negate(v):return 1-v if isinstance(v,int) else v.Not()
 def condition(node,t):
  key=(json.dumps(node,sort_keys=True),t)
  if key in cache:return cache[key]
  op=node['op']
  if op=='manual':v=0
  elif op=='subject':
   ref=node['code'];last=t+1 if node.get('timing')=='concurrent' else t
   if ref in done:v=1
   elif ref not in catalog:v=0
   else:v=model.NewBoolVar('condition_'+str(len(cache)));model.Add(v==sum(x[ref,k] for k in range(last)))
  elif op=='credits':
   cp_before=sum(catalog[c]['credit_points'] for c in done)+sum(catalog[c]['credit_points']*x[c,k] for c in codes if c not in done for k in range(t));v=model.NewBoolVar('credits_'+str(len(cache)));model.Add(cp_before>=node['minimum']).OnlyEnforceIf(v);model.Add(cp_before<node['minimum']).OnlyEnforceIf(v.Not())
  else:
   children=[condition(n,t) for n in node.get('children',[])]
   if not children:v=1 if op=='all' else 0
   else:
    v=model.NewBoolVar('logic_'+str(len(cache)))
    if op=='all':model.AddBoolAnd(children).OnlyEnforceIf(v);model.AddBoolOr([negate(n) for n in children]).OnlyEnforceIf(v.Not())
    else:model.AddBoolOr(children).OnlyEnforceIf(v);model.AddBoolAnd([negate(n) for n in children]).OnlyEnforceIf(v.Not())
  cache[key]=v;return v
 for c in codes:
  if c in done:continue
  rules=[r for r in catalog[c]['rules'] if r['kind']=='academic']
  for t in range(T):
   if not rules:model.Add(x[c,t]==0)
   for r in rules:model.AddBoolOr([x[c,t].Not(),condition(r['expression'],t)])
 model.Add(sum(catalog[c]['credit_points']*q[c] for c in codes if c not in done)+ctx['achieved']==opts['targetCredits'])
 loads=[]
 for t in range(T):
  load=model.NewIntVar(0,opts['maxPerTerm'],'load_'+str(t));model.Add(load==sum(catalog[c]['credit_points']*x[c,t] for c in codes if c not in done));loads.append(load)
 end=model.NewIntVar(0,T,'end')
 for (c,t),v in x.items():model.Add(end>=t+1).OnlyEnforceIf(v)
 maxload=model.NewIntVar(0,opts['maxPerTerm'],'maxload');model.AddMaxEquality(maxload,loads)
 alloc={}
 if ctx['requirements']:
  groups=ctx['requirements']['groups']
  for c in codes:
   members=[]
   for g in groups:
    if c in g['pool']:alloc[c,g['id']]=model.NewBoolVar(f'group_{c}_{g["id"]}');members.append(alloc[c,g['id']])
   model.Add(sum(members)==q[c])
  for g in groups:
   model.Add(sum(catalog[c]['credit_points']*alloc[c,g['id']] for c in g['pool'])==g['credits'])
   for c in g['required']:model.Add(alloc[c,g['id']]==1)
  for c,g in opts.get('waiverGroups',{}).items():model.Add(alloc[c,g]==1)
 for prev in previous:
  variable=[c for c in prev['selected'] if c not in done|ctx['required']|set(ctx['locks'])]
  if unique_courses and variable:model.Add(sum(q[c] for c in variable)<=len(variable)-1)
  else:
   positive={(c,t) for t,term in enumerate(prev['allTerms']) for c in term['courseCodes']}
   model.AddBoolOr([v.Not() if key in positive else v for key,v in x.items()])
 if earliest is not None:model.Add(end<=min(T,earliest+(2 if style=='balanced' else 1)))
 weighted_time=sum((t+1)*catalog[c]['credit_points']*v for (c,t),v in x.items())
 uncertain=sum(q[c] for c in ctx['assumptions'] if c not in done)
 preferences=opts.get('preferenceScores',{});interest=sum(int(preferences.get(c,0))*q[c] for c in codes if c not in ctx['required'])
 if style=='fast':model.Minimize(end*1000000+uncertain*10000+weighted_time*10-interest)
 elif style=='balanced':
  squares=[]
  for i,l in enumerate(loads):sq=model.NewIntVar(0,opts['maxPerTerm']**2,'square_'+str(i));model.AddMultiplicationEquality(sq,[l,l]);squares.append(sq)
  model.Minimize(maxload*1000000+sum(squares)*100+uncertain*1000+end*100+weighted_time-interest)
 else:model.Minimize(-interest*10000+uncertain*1000+end*1000+weighted_time)
 return model,x,q,alloc,end,loads

def solve(job):
 started=time.time()
 try:ctx=prepare(job)
 except ValueError as e:return {'status':'INPUT_CONFLICT','messages':[str(e)],'proposals':[]}
 if 'early' in ctx:return ctx['early']
 if ctx['remaining']==0 and not ctx['requirements']:return {'status':'ALREADY_MET','messages':['已完成与认可学分已达到本次阶段目标，无需再增加课程。'],'proposals':[]}
 proposals=[];earliest=None;unknown=False;all_status=[]
 for style,title in [('fast','尽早结束取向'),('balanced','学分均衡取向'),('interest','兴趣优先' if job['options'].get('interest') else '不同选修组合')]:
  found=None
  for unique in ([True,False] if proposals else [False]):
   model,x,q,alloc,end,loads=build(ctx,style,proposals,earliest,unique)
   solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=2.0;solver.parameters.num_search_workers=1;solver.parameters.random_seed=42
   status=solver.Solve(model);status_name=solver.StatusName(status);all_status.append(status_name)
   if status in [cp_model.OPTIMAL,cp_model.FEASIBLE]:found=(solver,x,q,alloc,end,loads,status_name);break
   if status==cp_model.UNKNOWN:unknown=True
  if not found:continue
  solver,x,q,alloc,end,loads,status_name=found
  schedule=[{**term,'courseCodes':[c for c in ctx['catalog'] if (c,t) in x and solver.Value(x[c,t])]} for t,term in enumerate(ctx['terms'])]
  allocation={g['id']:[c for c in g['pool'] if solver.Value(alloc[c,g['id']])] for g in (ctx['requirements'] or {}).get('groups',[])}
  audit(ctx,schedule,allocation)
  finish=solver.Value(end);earliest=finish if earliest is None else earliest
  scheduled={c for t in schedule for c in t['courseCodes']};selected=scheduled|ctx['done']|ctx['waived'];warnings=[]
  if ctx['requirements']:warnings.append(ctx['requirements']['conflict'])
  if job.get('entryYear')!=2024:warnings.append('所用资料为 2024 历史版本，适用的入学年份与当前开课情况需确认。')
  assumed=[c for c in scheduled if c in ctx['assumptions']]
  if assumed:warnings.append('以下课程使用示例学期或开课假设：'+', '.join(sorted(assumed)))
  if any(any(r['kind']=='admission' for r in ctx['catalog'][c]['rules']) for c in scheduled):warnings.append('部分课程另有专业、入学或豁免条件，尚需学校确认。')
  if job['priorCredits'] and not ctx['waived']:warnings.append('认可学分仅计入阶段目标，未用来替代具体先修课程。')
  proposal={'id':f'{style}-{len(proposals)+1}','style':style,'title':title,'solverStatus':status_name,'optimal':status_name=='OPTIMAL','targetCredits':ctx['opts']['targetCredits'],'achievedCredits':ctx['achieved'],'newCredits':ctx['remaining'],'finalCredits':ctx['opts']['targetCredits'],'finish':ctx['terms'][finish-1] if finish else None,'semesterCount':sum(bool(t['courseCodes']) for t in schedule),'peakCredits':max([solver.Value(l) for l in loads],default=0),'terms':[t for t in schedule if t['courseCodes']],'allTerms':schedule,'selected':sorted(selected),'waivedCodes':sorted(ctx['waived']),'waiverGroups':ctx['opts'].get('waiverGroups',{}),'allocations':allocation,'warnings':warnings,'assumptionCodes':sorted(assumed),'interestMatches':[c for c in scheduled if ctx['opts'].get('preferenceScores',{}).get(c,0)>0],'auditPassed':True}
  signature=json.dumps([(t['year'],t['season'],sorted(t['courseCodes'])) for t in proposal['terms']])
  if not any(p.get('_signature')==signature for p in proposals):proposal['_signature']=signature;proposals.append(proposal)
 for p in proposals:p.pop('_signature',None);p.pop('allTerms',None);p.pop('selected',None)
 return {'status':'OK' if proposals else 'SEARCH_LIMIT' if unknown else 'NO_FEASIBLE_PLAN','messages':['已按已录入规则找到可行草案；不代表校方已批准。'] if proposals else ['当前约束下未找到方案。请检查目标学分、先修资料、保留安排、开课政策和规划时间；不代表学校不存在其他路径。'],'proposals':proposals,'searchStatuses':all_status,'elapsedSeconds':round(time.time()-started,3)}

if __name__=='__main__':
 sys.stdout.reconfigure(encoding='utf-8');sys.stdin.reconfigure(encoding='utf-8')
 try:print(json.dumps(solve(json.load(sys.stdin)),ensure_ascii=False))
 except Exception:
  import traceback;traceback.print_exc(file=sys.stderr);print(json.dumps({'status':'ERROR','messages':['求解器内部校验未通过，没有返回未经校验的方案。'],'proposals':[]}))
