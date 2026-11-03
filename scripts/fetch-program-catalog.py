import os
import urllib.request,json,re,html,pathlib,concurrent.futures,time
root=pathlib.Path(__file__).resolve().parents[1]
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['HTTPS_PROXY']} if os.environ.get('HTTPS_PROXY') else {}))
groups={'design':['87631','87100','85503','87632','87222','85502','87731','87441','87443','87009','87832','87011','87012','87010'],'business':['22108','23115','21212','26134','24109','25300','22208','21214']}
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def fetch(pair):
 program,code=pair;url=f'https://handbookpre2025.uts.edu.au/2024/subjects/{code}.html'
 for attempt in range(3):
  try:s=opener.open(url,timeout=25).read().decode('utf-8','replace');break
  except Exception:
   if attempt==2:raise
 title=clean(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S|re.I).group(1));assert title.startswith(code)
 h=s[s.index('</h1>')+5:];desc=re.search(r'<h3[^>]*>\s*Description\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I)
 assert desc,code
 header=clean(h[:desc.start()]);req=re.search(r'(?<!Anti-)Requisite\(s\):\s*(.*?)(?=Anti-requisite|Recommended studies|Undergraduate|Postgraduate|$)',header,re.I)
 cp=re.search(r'(\d+)\s*cp',header);assert cp,code
 availability=re.search(r'<h3[^>]*>\s*Typical availability\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I)
 return {'program':program,'code':code,'title':title[len(code):].strip(),'credit_points':int(cp.group(1)),'raw_requisites':req.group(1).strip() if req else '', 'description_excerpt':clean(desc.group(1))[:1200],'availability':clean(availability.group(1)) if availability else '', 'source_url':url}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(fetch,[(p,c) for p,cs in groups.items() for c in cs]))
(root/'app/data/catalog/program-source-evidence.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
for r in rows:print(json.dumps(r,ensure_ascii=True),flush=True)
