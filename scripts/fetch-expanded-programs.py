import os
import pathlib,urllib.request,re,html,json,concurrent.futures,time
ROOT=pathlib.Path(__file__).resolve().parents[1];CACHE=ROOT/'work/route-sources';OP=urllib.request.build_opener(urllib.request.ProxyHandler({'https':os.environ['HTTPS_PROXY']} if os.environ.get('HTTPS_PROXY') else {}))
PACKAGES={'computing':['stm90651','maj02081','maj03444','maj02080','maj02092','maj03445'],'business':['stm90273','maj08440','maj08438','maj08441']}
CACHE.mkdir(parents=True,exist_ok=True)
def clean(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s))).strip()
def page(kind,code):
 p=CACHE/(code+'.html')
 if p.exists():return p.read_text(encoding='utf-8')
 url=f'https://handbookpre2025.uts.edu.au/2024/{kind}/{code}.html'
 for attempt in range(3):
  try:s=OP.open(url,timeout=30).read().decode('utf-8','replace');p.write_text(s,encoding='utf-8');return s
  except Exception:
   if attempt==2:raise
   time.sleep(1)
def package(code):
 s=page('directory',code);s=s[s.index('<h1'):];title=clean(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S).group(1));body=s[s.index('<h2>Completion requirements'):] if '<h2>Completion requirements' in s else s[s.index('<table'):];body=body[:body.index('</table>')+8];codes=list(dict.fromkeys(re.findall(r'/subjects/(\d{5})\.html',body)))
 return {'id':code,'title':title,'codes':codes,'source_url':f'https://handbookpre2025.uts.edu.au/2024/directory/{code}.html','requirements_text':clean(body)}
def subject(code):
 s=page('subjects',code);title=clean(re.search(r'<h1[^>]*>(.*?)</h1>',s,re.S).group(1));assert title.startswith(code);h=s[s.index('</h1>')+5:];desc=re.search(r'<h3[^>]*>\s*Description\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I);assert desc,code
 header=clean(h[:desc.start()]);cp=re.search(r'(\d+)\s*cp',header);assert cp,code
 req=re.search(r'(?<!Anti-)Requisite\(s\):\s*(.*?)(?=Anti-requisite|Recommended studies|Undergraduate|Postgraduate|$)',header,re.I);anti=re.search(r'Anti-requisite\(s\):\s*(.*?)(?=Recommended studies|Undergraduate|Postgraduate|$)',header,re.I);avail=re.search(r'<h3[^>]*>\s*Typical availability\s*</h3>(.*?)(?=<h[234]|$)',h,re.S|re.I)
 return {'code':code,'title':title[len(code):].strip(),'credit_points':int(cp.group(1)),'raw_requisites':req.group(1).strip() if req else '', 'anti_requisites':anti.group(1).strip() if anti else '', 'description_excerpt':clean(desc.group(1))[:1200],'availability':clean(avail.group(1)) if avail else '', 'source_url':f'https://handbookpre2025.uts.edu.au/2024/subjects/{code}.html'}
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:packages=list(pool.map(package,sum(PACKAGES.values(),[])))
 (ROOT/'work/expanded-packages.json').write_text(json.dumps({'programs':PACKAGES,'packages':packages},ensure_ascii=False,indent=2),encoding='utf-8');codes=sorted(set(sum([p['codes'] for p in packages],[])));print('Subjects to fetch',len(codes),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(subject,codes))
 (ROOT/'work/expanded-evidence.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
 for r in rows:print(json.dumps({k:r[k] for k in ['code','credit_points','raw_requisites','anti_requisites','availability']},ensure_ascii=True),flush=True)
