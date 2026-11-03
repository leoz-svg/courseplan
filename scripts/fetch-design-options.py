import os
import urllib.request,re,html,json,pathlib,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parents[1];op=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['HTTPS_PROXY']} if os.environ.get('HTTPS_PROXY') else {}))
pools={}
(root/'work/route-sources').mkdir(parents=True,exist_ok=True)
for package in ['stm91882','cbk91878','cbk92069']:
 source=root/f'work/route-sources/{package}.html'
 if not source.exists():source.write_text(op.open(f'https://handbookpre2025.uts.edu.au/2024/directory/{package}.html',timeout=30).read().decode('utf-8','replace'),encoding='utf-8')
 s=source.read_text(encoding='utf-8');s=s[s.find('<h1'):]
 pools[package]=list(dict.fromkeys(re.findall(r'/subjects/(\d{5})\.html',s)))
existing=json.loads((root/'app/data/catalog/program-subjects.json').read_text(encoding='utf-8'));existingCodes={c['code'] for c in existing}
(root/'app/data/catalog/design-pools.json').write_text(json.dumps(pools,indent=2),encoding='utf-8')
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def fetch(code):
 url=f'https://handbookpre2025.uts.edu.au/2024/subjects/{code}.html'
 for n in range(3):
  try:s=op.open(url,timeout=25).read().decode('utf-8','replace');break
  except Exception:
   if n==2:raise
 title=clean(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S|re.I).group(1));assert title.startswith(code)
 h=s[s.index('</h1>')+5:];desc=re.search(r'<h3[^>]*>\s*Description\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I);assert desc
 header=clean(h[:desc.start()]);cp=re.search(r'(\d+)\s*cp',header);assert cp
 req=re.search(r'(?<!Anti-)Requisite\(s\):\s*(.*?)(?=Anti-requisite|Recommended studies|Undergraduate|Postgraduate|$)',header,re.I)
 anti=re.search(r'Anti-requisite\(s\):\s*(.*?)(?=Recommended studies|Undergraduate|Postgraduate|$)',header,re.I)
 avail=re.search(r'<h3[^>]*>\s*Typical availability\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I)
 # Some subject pages omit availability; retain unknown rather than inventing sessions.
 return {'code':code,'title':title[len(code):].strip(),'credit_points':int(cp.group(1)),'raw_requisites':req.group(1).strip() if req else '', 'anti_requisites':anti.group(1).strip() if anti else '', 'description_excerpt':clean(desc.group(1))[:1200],'availability':clean(avail.group(1)) if avail else '', 'source_url':url}
codes=sorted(set(sum(pools.values(),[]))-existingCodes)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(fetch,codes))
evidence_path=root/'app/data/catalog/design-option-evidence.json'
previous=json.loads(evidence_path.read_text(encoding='utf-8')) if evidence_path.exists() else []
merged={r['code']:r for r in previous+rows}
evidence_path.write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2),encoding='utf-8')
print('Pools', {k:len(v) for k,v in pools.items()},'New subjects',len(rows),flush=True)
for r in rows:print(json.dumps({k:r[k] for k in ['code','title','credit_points','raw_requisites','anti_requisites','availability']},ensure_ascii=True),flush=True)
