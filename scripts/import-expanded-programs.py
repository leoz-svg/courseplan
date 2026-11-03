"""Import official program pools. Unknown scoped requirements remain manual, never assumed true."""
import json,re,pathlib,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def subject(code,timing='prior'):return {'op':'subject','code':code,'timing':timing}
def allof(*children):return {'op':'all','children':list(children)}
def anyof(*children):return {'op':'any','children':list(children)}
REVIEWED_DIGESTS={'24212': 'e119d3251520ef25a0a8f368482607dab5d84c343ddb757628535185a5f5ce76', '24309': '11e4e8ae9beb7a97d3065d0cff63a12cbac19cbb74c8cee1af089a48b4bab3f7', '31269': '088f501c420f93fc54c2f13e90f43322b86b7a62e643ff3955bda77093f45c1d', '31272': '524317f5aa2dc78b73a64e4f73f86e5d3707d8da35681c9079ee54d5a11b08ac', '41004': '470d42644eed050673d1fd295cd656b51a3a1d2f92ba5754f124d53f9e0b66c8', '41903': 'f2eba57ea0ea99f9d8dc7fadd5a285b39d69d5042c33641cca7013a9e6f59c05', '48270': '0fce89c73352cbc3c53b87b1c6155dc989f48b5840cb5dfa9578cb0034410a3d', '48730': '0a5b1846ca57c8383c1f2bae17a7e871469a4a1e215a9c945e3f55eac739e021'}
def expression(raw,code,program):
 if not raw:return allof()
 minimum=lambda n:{'op':'credits','minimum':n}
 # Reviewed against C10148's historical subject pages; all available local courses belong to this program pool.
 overrides={
  '31269':minimum(18),
  '31272':allof(subject('31269'),anyof(*[subject(c) for c in ['31265','48230','41078']]),minimum(72)),
  '41004':allof(subject('31250'),subject('31272','concurrent'),minimum(90)),
  '41903':allof(anyof(*[subject(c) for c in ['41092','31270','48720']]),minimum(96)),
  '48270':minimum(120),
  # The source renders these three with unbalanced parentheses. Preserve the reviewed logical grouping explicitly.
  '48730':allof(anyof(*[subject(c) for c in ['31268','48410','41082','65325','48450','48033']]),anyof(*[subject(c) for c in ['31270','41092','48720']])),
  '24309':allof(anyof(subject('24108'),subject('24109')),anyof(subject('26134'),subject('37151'),allof(subject('33130'),subject('33230')))),
  '24212':anyof(anyof(subject('24108'),subject('24109')),allof(anyof(subject('54047'),subject('52663')),anyof(subject('54048'),subject('52664'))))
 }
 if code in overrides and (program=='computing' or code in ['24309','24212']) and hashlib.sha256(raw.encode()).hexdigest()==REVIEWED_DIGESTS[code]:return overrides[code]
 if re.search(r'credit points|spk\(|grade|permission|GPA|admission',raw,re.I):return {'op':'manual','text':raw}
 s=re.split(r'The lower case|These requisites|There are course requisites|Fields of practice:|See access conditions',raw)[0]
 # Remove title-only parentheses, e.g. (Capstone); keep logical groups containing subject references.
 s=re.sub(r'\(([^()]*)\)',lambda m:m.group(0) if re.search(r'\d{5}|\bAND\b|\bOR\b',m.group(1)) else '',s)
 tokens=re.findall(r'(?<![A-Za-z0-9])\d{5}c?\b|\bAND\b|\bOR\b|[()]',s)
 i=0
 def atom():
  nonlocal i
  if i>=len(tokens):raise ValueError('missing operand')
  t=tokens[i];i+=1
  if t=='(':
   n=or_expr()
   if i>=len(tokens) or tokens[i]!=')':raise ValueError('unbalanced parentheses')
   i+=1;return n
  if not re.fullmatch(r'\d{5}c?',t):raise ValueError('invalid subject')
  return subject(t[:5],'concurrent' if t.endswith('c') else 'prior')
 def and_expr():
  nonlocal i
  children=[atom()]
  while i<len(tokens) and tokens[i]=='AND':i+=1;children.append(atom())
  return allof(*children) if len(children)>1 else children[0]
 def or_expr():
  nonlocal i
  children=[and_expr()]
  while i<len(tokens) and tokens[i]=='OR':i+=1;children.append(and_expr())
  return anyof(*children) if len(children)>1 else children[0]
 try:
  n=or_expr()
  if i!=len(tokens):raise ValueError('unparsed rule')
  return n
 except ValueError:return {'op':'manual','text':raw}

def load(name):return json.loads((ROOT/name).read_text(encoding='utf-8'))
def write(name,data):(ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def main():
 pools=load('work/expanded-packages.json');evidence=load('work/expanded-evidence.json');by={r['code']:r for r in evidence};packages={p['id']:p for p in pools['packages']};oldcomputing=load('app/data/catalog/subjects.json');additional=load('app/data/catalog/program-subjects.json');intro=load('app/data/catalog/introductions.json');groups=load('app/data/catalog/categories.json')
 membership={p:set(sum([packages[i]['codes'] for i in ids],[])) for p,ids in pools['programs'].items()};results={};manual={}
 for program in ['computing','business']:
  dataset=f'uts-2024-{program}-snapshot';existing={c['code']:c for c in (oldcomputing if program=='computing' else additional) if c['dataset_id']==dataset};manual[program]=[]
  for code in sorted(membership[program]):
   e=by[code];node=expression(e['raw_requisites'],code,program);url=e['source_url'];rules=[{'kind':'academic','expression':node,'raw_text':e['raw_requisites'] or 'No academic requisites are listed on this historical subject page; admission/access conditions still require verification.','source_url':url,'review_status':'manual_required' if node['op']=='manual' else 'historical_source_reviewed'}]
   if node['op']=='manual':manual[program].append(code)
   if e['anti_requisites']:rules.append({'kind':'exclusion','expression':{'op':'manual','text':e['anti_requisites']},'raw_text':e['anti_requisites'],'source_url':url,'review_status':'historical_source_reviewed'})
   rules.append({'kind':'admission','expression':{'op':'manual','text':'Program admission, permissions and exemptions must be confirmed with UTS.'},'raw_text':'Historical academic rules only; course-specific admission, access conditions or approvals may additionally apply.','source_url':f'https://studentforms.uts.edu.au/evop/access/search.cfm?subjectcode={code}','review_status':'manual_required'})
   seasons=[s for s in ['Autumn','Spring','Summer','Winter','July','December'] if re.search(r'\b'+s+r'\s+session',e['availability'],re.I)]
   existing[code]={'dataset_id':dataset,'code':code,'title':e['title'],'credit_points':e['credit_points'],'faculty':'Engineering and Information Technology' if program=='computing' else 'Business','study_level':'Undergraduate','source_url':url,'access_conditions_url':rules[-1]['source_url'],'requirements_status':'historical_academic_rules_reviewed','rules':rules,'offerings':[{'session':s,'location':'Historical page; confirm campus','indicative':True} for s in seasons]}
   if not any(i['code']==code for i in intro):
    text=e['description_excerpt'];sentence=re.split(r'(?<=[.!?])\s+',text)[0]
    intro.append({'code':code,'summary_zh':'','summary_en':sentence,'source_url':url,'source_year':2024,'summary_kind':'official_description_excerpt','verified_on':'2026-11-03'})
  results[program]=list(existing.values())
 # Preserve all original codes and dataset IDs so saved plans remain valid.
 write('app/data/catalog/subjects.json',results['computing']);write('app/data/catalog/program-subjects.json',[c for c in additional if c['dataset_id']!='uts-2024-business-snapshot']+results['business']);write('app/data/catalog/introductions.json',intro)
 groupnames={'stm90651':'IT 核心课程','maj02081':'IT · 数据分析','maj03444':'IT · 企业软件开发','maj02080':'IT · 商业信息系统','maj02092':'IT · 交互设计','maj03445':'IT · 网络与网络安全','stm90273':'商科核心课程','maj08440':'商科 · 金融','maj08438':'商科 · 管理','maj08441':'商科 · 市场营销'}
 assigned=set(sum([g['codes'] for g in groups['groups']],[]))
 for id,name in groupnames.items():
  codes=[c for c in packages[id]['codes'] if c not in assigned]
  if codes:groups['groups'].append({'name':name,'codes':codes});assigned.update(codes)
 write('app/data/catalog/categories.json',groups);write('app/data/catalog/expanded-program-pools.json',pools);write('app/data/catalog/expanded-program-evidence.json',evidence)
 print('Catalog sizes', {p:len(cs) for p,cs in results.items()},'Manual academic conditions',manual)
if __name__=='__main__':main()
