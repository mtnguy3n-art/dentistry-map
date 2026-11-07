#!/usr/bin/env python3
"""Rebuilds site/data from Statistics Canada and OpenStreetMap.

  python pipeline/refresh.py                 only runs if the January tables are newer
  python pipeline/refresh.py --force         runs even if they are not
  python pipeline/refresh.py --no-download   rebuilds from files already in pipeline/dl

site/data is only replaced when every check passes.
"""
import datetime,json,os,re,shutil,subprocess,sys,urllib.request,zipfile
K=os.path.dirname(os.path.abspath(__file__)); W=K+'/work/'; X=K+'/dl/x/'; O=K+'/out/'; DATA=os.path.dirname(K)+'/site/data/'
LAST=K+'/last_release.txt'
WDS='https://www150.statcan.gc.ca/t1/wds/rest/'
LOCAL='--no-download' in sys.argv
def output(**v):
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'],'a') as f:
            for k,x in v.items(): f.write(f'{k}={x}\n')
def post(p,b):
    return json.load(urllib.request.urlopen(urllib.request.Request(WDS+p,json.dumps(b).encode(),{'Content-Type':'application/json'}),timeout=120))
def zipget(pid,name=None):
    z=f'{K}/dl/{pid}.zip'
    urllib.request.urlretrieve(f'https://www150.statcan.gc.ca/n1/tbl/csv/{pid}-eng.zip',z)
    zipfile.ZipFile(z).extract(f'{pid}.csv',X); os.remove(z)
    if name: os.replace(f'{X}{pid}.csv',f'{X}{name}.csv')
    print('got',pid,flush=True)
def business_table():
    # Each Business Counts release is a new table, so pick the newest of the series
    c=json.load(urllib.request.urlopen(WDS+'getAllCubesListLite',timeout=120))
    t='Canadian Business Counts, with employees, census metropolitan areas and census subdivisions'
    m=[x for x in c if x['cubeTitleEn'].startswith(t)]
    b=max(m,key=lambda x:(x['cubeEndDate'],x['productId']))
    return b['productId'],b['cubeTitleEn']
def run(s,*a):
    r=subprocess.run([sys.executable,W+s,*a],capture_output=True,text=True)
    open(K+'/run.log','a').write(f'--- {s}\n{r.stdout}\n{r.stderr}\n')
    if r.returncode: raise SystemExit(f'{s} failed:\n{r.stderr[-1500:]}')
    return r.stdout
release=None
if not LOCAL:
    times=[post('getCubeMetadata',[{'productId':p}])[0]['object']['releaseTime'] for p in(17100152,17100153)]
    release=max(times)
    if '--force' not in sys.argv and min(times)<=open(LAST).read().strip():
        print('Statistics Canada has not published the new tables yet.'); output(changed='false'); sys.exit(0)
    os.makedirs(X,exist_ok=True); open(K+'/run.log','w').close()
    bid,btitle=business_table()
    for p in(17100152,17100154,17100155,34100148,17100009): zipget(p)
    zipget(bid,'33101176')
    json.dump(post('getCubeMetadata',[{'productId':17100153}]),open(K+'/dl/m153.json','w'))
    json.dump({'id':bid,'title':btitle},open(K+'/dl/business.json','w'))
    run('fetch153.py',K)
    run('extract152.py',X[:-1],W+'age152.csv')
os.makedirs(O,exist_ok=True)
out=run('build2.py',K); out+=run('build3.py',K)
d=None
if not LOCAL: d=subprocess.run([sys.executable,W+'build_dentists.py',K+'/geo',O+'dentists.json'],capture_output=True,text=True)
pins=bool(d) and d.returncode==0
if not pins:
    shutil.copy(DATA+'dentists.json',O+'dentists.json')
    if d: print('dentists kept from the last run:',d.stderr[-300:],flush=True)
m=json.load(open(O+'markets.json')); st=json.load(open(W+'stage2.json')); s3=json.load(open(W+'stage3.json')); biz=json.load(open(K+'/dl/business.json'))
rec=[l for l in out.splitlines() if l.startswith('reconcile')][0].split()
prev=json.load(open(DATA+'markets.json'))
rows={f[:-5]:len(json.load(open(O+f))) for f in os.listdir(O) if not f.startswith('map_')}
rep=dict(age_year=st['AY'],migration_year=st['Y'],business=biz,markets=len(m),dentists_updated=pins,
  people=sum(r['pop'] for r in m),net=sum(r['net'] for r in m),arrivals=sum(r['arrivals'] for r in m),departures=sum(r['departures'] for r in m),offices=sum(r['offices'] for r in m),
  status={s:sum(r['action']==s for r in m) for s in('Growing','Steady','Shrinking','High turnover')},
  reconcile_max=float(rec[rec.index('max')+1]),rows=rows,
  top=[(r['market'],r['prov'],r['arr_office'],r['offices']) for r in sorted((x for x in m if x['pop']>=50000 and x['arr_office']),key=lambda x:-x['arr_office'])[:5]])
prior=sum(r['offices'] for r in prev)
rep['failed']=[n for n,bad in (('market count is not 293',len(m)!=293),('markets changed',{r['id'] for r in m}!={r['id'] for r in prev}),
  ('population change does not reconcile',rep['reconcile_max']>1),('population outside 35-50 million',not 35e6<rep['people']<50e6),
  ('offices moved over 25%',not .75<rep['offices']/prior<1.25),('neighbourhood rows changed',rows['neighbourhoods']!=len(json.load(open(DATA+'neighbourhoods.json'))))) if bad]
json.dump(rep,open(K+'/report.json','w'),indent=1,ensure_ascii=False); print(json.dumps(rep,indent=1,ensure_ascii=False))
if rep['failed']: output(changed='false'); sys.exit(1)
month=lambda s:datetime.date(int(s[:4]),int(s[5:7]),1).strftime('%B %Y')
a,b=s3['flows'].split('/')
t=str(biz['id'])
meta=dict(age_year=st['AY'],offices=biz['title'].rsplit(', ',1)[1],flows=f'{a}/{b[2:]}',july=month(s3['july']),housing=month(s3['housing']),business_table=f'{t[:2]}-{t[2:4]}-{t[4:]}')
json.dump(meta,open(O+'meta.json','w'),ensure_ascii=False,indent=1)
for f in os.listdir(O): shutil.copy(O+f,DATA+f)
if release:
    open(LAST,'w').write(release+'\n')
output(changed='true')
print('site/data updated')
