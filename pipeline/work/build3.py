import csv,json,sys,re,collections,math
import pandas as pd, numpy as np
from shapely.geometry import shape
from shapely.strtree import STRtree
sp=sys.argv[1]; W=sp+'/work/'; X=sp+'/dl/x/'; O=sp+'/out/'; GEO=sp+'/geo/'
PR={'10':'NL','11':'PE','12':'NS','13':'NB','24':'QC','35':'ON','46':'MB','47':'SK','48':'AB','59':'BC','60':'YT','61':'NT','62':'NU'}
st1=json.load(open(W+'stage1.json')); st2=json.load(open(W+'stage2.json'))
ns=st1['ns'];inc_nat=st1['inc'];deg_nat=st1['deg'];f2cd=st1['f2cd'];pc=st2['pc'];csdv=st2['csdv'];csdn=st2['csdn']
m=pd.read_pickle(W+'markets.pkl'); ALL=pd.read_pickle(W+'all.pkl'); cen=pd.read_pickle(W+'cen.pkl')
def seg(yf,ya,op,rt,income,degree):
    lq={'Young families':yf/ns['yf'],'Young adults':ya/ns['ya'],'Older':op/ns['op'],'Retirees':rt/ns['rt']}
    k=max(lq,key=lq.get)
    if k=='Older': k='Older professionals' if (income>=inc_nat or degree>=deg_nat) else 'Older working-age'
    return k
def clean(n): return re.sub(r'\s+',' ',n).strip()
# friendly names: Division No. markets take their largest town
big={}
for c,v in pc.items():
    if 'latest' in v:
        k=c[:4]
        if k not in big or v['latest']>big[k][1]: big[k]=(re.sub(r'\s*\(.*?\)|,.*$','',v['n']).strip(),v['latest'])
def fn(r):
    n=clean(r.market)
    if n.startswith('Division No.') and r.id in big: return f"{big[r.id][0]} area (Div. {n.split()[-1]})"
    return n
m['market']=m.apply(fn,axis=1)
def act(r):
    if r.arr_rate>=15 and r.dep_rate>=10: return 'High turnover'
    if r.net_rate>=10: return 'Growing'
    if r.net_rate<0: return 'Shrinking'
    return 'Steady'
m['action']=m.apply(act,axis=1)
print(m.action.value_counts())
# CMA overlay
cmaf=json.load(open(GEO+'cma.geojson'))['features']; cdf=json.load(open(GEO+'cd.geojson'))['features']
cmaP=[shape(f['geometry']).buffer(0) for f in cmaf]; t=STRtree(cmaP)
mm={}
for f in cdf:
    g=shape(f['geometry']).buffer(0); best=None;ba=0
    for i in t.query(g):
        if cmaf[i]['properties']['PRUID'][:2]!=f['properties']['PRUID'][:2] and len(cmaf[i]['properties']['PRUID'])==2: continue
        a=cmaP[i].intersection(g).area
        if a>ba: ba=a;best=i
    if best is not None and ba>0.15*cmaP[best].area:
        mm[f['properties']['CDUID']]=cmaf[best]['properties']['CMANAME']
print(len(mm),list(mm.items())[:6])
m['metro']=m.id.map(mm).map(lambda v:re.sub(r'\s*-\s*','-',re.sub(r' / .*$','',re.sub(r' \(.*?\)','',v))) if isinstance(v,str) else v)
# metro flows
f=collections.defaultdict(lambda:collections.defaultdict(float))
years=set()
rr=csv.reader(open(X+'17100154.csv',encoding='utf-8-sig'));h=next(rr)
for x in rr: years.add(x[0])
Y2=sorted(years)[-1]; print('flows yr',Y2,sorted(years))
inn=collections.defaultdict(dict);out=collections.defaultdict(dict)
rr=csv.reader(open(X+'17100154.csv',encoding='utf-8-sig'));next(rr)
for x in rr:
    if x[0]==Y2 and x[1]!=x[3] and x[10]!='' :
        try:v=float(x[h.index('VALUE')] or 0)
        except:v=0
        out[x[1]][x[3]]=v; inn[x[3]][x[1]]=v
def nm(s): return re.sub(r'\s*-\s*','-',re.sub(r' \((CMA|CA)\),.*$','',s))
fl=[]
PART=lambda a:' part' in a or 'partie' in a
def merge(d):
    o=collections.defaultdict(float)
    for a,b in d.items():
        if '(C' in a and not PART(a): o[nm(a)]+=b
    return o
names=sorted({nm(k) for k in set(inn)|set(out) if '(C' in k and not PART(k)})
for mn in names:
    ks=[k for k in set(inn)|set(out) if '(C' in k and nm(k)==mn and not PART(k)]
    I={};U={}
    for k in ks:
        for a,b in inn[k].items():
            if a not in ks and not PART(a): I[a]=I.get(a,0)+b
        for a,b in out[k].items():
            if a not in ks and not PART(a): U[a]=U.get(a,0)+b
    k=ks[0]
    top=lambda d:'; '.join(a for a,_ in sorted(merge(d).items(),key=lambda z:-z[1])[:3] if a!=mn)
    pv=ks[0].split('), ')[-1]
    fl.append(dict(metro=mn,prov=pv,moved_in=round(sum(I.values())),moved_out=round(sum(U.values())),net=round(sum(I.values())-sum(U.values())),from_top=top(I),to_top=top(U)))
fl=pd.DataFrame(fl); print(fl.sort_values('moved_in',ascending=False).head(6).to_string()); print(len(fl))
# housing
rr=csv.reader(open(X+'34100148.csv',encoding='utf-8-sig'));h=next(rr);ix={c:i for i,c in enumerate(h)}
H=collections.defaultdict(lambda:collections.defaultdict(float));mo=set()
for x in rr:
    if x[ix['VALUE']]!='': H[(x[1],x[3])][x[0]]+=float(x[ix['VALUE']]);mo.add(x[0])
mo=sorted(mo);cur=mo[-12:];pri=mo[-24:-12];print(cur[0],cur[-1],pri[0],pri[-1])
hs=[]
for g in sorted({k[0] for k in H}):
    if not re.search(r', [A-Z]',g): continue
    if not any(z in H[k] for k in H if k[0]==g for z in cur+pri): continue
    T=H[(g,'Total units')];Sg=H[(g,'Single units')];Se=H[(g,'Semi-detached units')];R=H[(g,'Row units')]
    c=sum(T.get(z,0) for z in cur);p=sum(T.get(z,0) for z in pri);gr=sum(d.get(z,0) for d in(Sg,Se,R) for z in cur)
    hs.append(dict(metro=re.sub(r'\s*-\s*','-',g.split(',')[0]),prov=g.split(', ')[-1],starts_12m=round(c),starts_prior=round(p),change=(c/p-1 if p else None),family_share=(gr/c if c else None)))
hs=pd.DataFrame(hs);print(hs.sort_values('starts_12m',ascending=False).head(6).to_string());print(len(hs),hs.starts_12m.sum())
# province now
rr=csv.reader(open(X+'17100009.csv',encoding='utf-8-sig'));h=next(rr);P=collections.defaultdict(dict)
rows=list(rr);J=sorted({x[0] for x in rows if x[0].endswith('-07-01')})[-3:]
for x in rows:
    if x[0] in J:P[x[1]][x[0][:4]]=float(x[9] or 0)
y0,y1,y2=[j[:4] for j in J]
pv=[dict(province=k,pop_latest=int(v[y2]),growth_latest=v[y2]/v[y1]-1,growth_prior=v[y1]/v[y0]-1) for k,v in P.items() if len(v)==3]
print(pd.DataFrame(pv).to_string())
json.dump({'flows':Y2,'housing':cur[-1],'july':J[-1]},open(W+'stage3.json','w'))
# municipalities
mu=[]
idn=dict(zip(m.id,m.market))
for c,v in pc.items():
    if 'latest' in v and '2021' in v and v['latest']>=5000:
        off=csdv.get(c,0)
        mu.append(dict(id=c,name=re.sub(r'\s*\(.*?\)|,.*$','',v['n']).strip(),market_id=c[:4],market=idn.get(c[:4]),prov=PR[c[:2]],pop=int(v['latest']),growth=v['latest']/v['2021']-1,offices=int(off),people_office=round(v['latest']/off) if off else None))
mu=pd.DataFrame(mu);print(len(mu),mu.sort_values('growth',ascending=False).head(5).to_string())
# csd name for FSA
csdf=[]
for o in(0,2000,4000): csdf+=json.load(open(GEO+f'csd{o}.geojson'))['features']
print('csd n',len(csdf))
cP=[shape(f['geometry']).buffer(0) for f in csdf];tc=STRtree(cP)
fsaf=json.load(open(GEO+'fsa_u.geojson'))['features']+json.load(open(GEO+'fsa_r.geojson'))['features']
place={}
for f_ in fsaf:
    pt=shape(f_['geometry']).buffer(0).representative_point()
    c=[i for i in tc.query(pt) if cP[i].contains(pt)]
    if c: place[f_['properties']['CFSAUID']]=clean(csdf[c[0]]['properties']['CSDNAME'])
# FSA rows
cc=cen[cen.flow=='DF_FSA'].set_index('id')
mi=m.set_index('id')
fs=[]
for k,r in cc.iterrows():
    if not (r['pop']>=500) or pd.isna(r.income) or pd.isna(r.m1t) or r.m1t==0: continue
    t_=r.tot; cd_=f2cd.get(k)
    sy,sa,so,sr=r.yf/t_,r.ya/t_,r.op/t_,r.rt/t_
    fs.append(dict(fsa=k,place=(mi.market.get(cd_)+' (rural)' if k[1]=='0' else place.get(k,'')),market_id=cd_,market=mi.market.get(cd_),prov=mi.prov.get(cd_),pop=int(r['pop']),segment=seg(sy,sa,so,sr,r.income,r.degree),
      s_yf=round(sy,3),s_ya=round(sa,3),s_op=round(so,3),s_rt=round(sr,3),income=int(r.income),degree=round(r.degree,3),renter=round(r.renter,3),
      movers1=int(r.mov1),mover_rate=round(r.mov1/r.m1t,3),newcomer1=int(r.mig1),newcomer_rate=round(r.mig1/r.m1t,3),arrived5=int(r.mig5),arrived5_rate=round(r.mig5/r.m5t,3),recent_imm=round(r.recent_imm/r.imm_tot,3),market_action=mi.action.get(cd_)))
fs=pd.DataFrame(fs)
# city to postal area, from boundary overlap; postal areas often reach well past one town
ci={f_['properties']['CSDUID']:i for i,f_ in enumerate(csdf)}
fk=set(fs.fsa); kept=[f_ for f_ in fsaf if f_['properties']['CFSAUID'] in fk]
fP=[shape(f_['geometry']).buffer(0) for f_ in kept]; tf=STRtree(fP)
links={};top={}
for _,r in mu.iterrows():
    g=cP[ci[r.id]]; ro=[]
    for i in tf.query(g):
        a=fP[i].intersection(g).area
        if a<=0: continue
        k=kept[i]['properties']['CFSAUID']; ro.append((k,a/fP[i].area,a/g.area))
        e=r['pop']*a/g.area
        if k[1]!='0' and e>top.get(k,(0,''))[0]: top[k]=(e,r['name'])
    urb=[x for x in ro if x[0][1]!='0'] or ro
    use=[x for x in urb if x[1]>=.2 or x[2]>=.1] or sorted(urb,key=lambda x:-x[2])[:1]
    links[r.id]=' '.join(x[0] for x in sorted(use,key=lambda x:-x[2]))
mu['fsas']=mu.id.map(links)
fs['place']=[top[k][1] if k in top else p for k,p in zip(fs.fsa,fs.place)]
print('cities with no postal area',(mu.fsas=='').sum())
print(len(fs),fs.segment.value_counts().to_dict());print(fs.sort_values('movers1',ascending=False).head(5).to_string())
# rounding & write
fm=m.copy()
for c in('growth','s_yf','s_ya','s_op','s_rt','degree','owner'): fm[c]=fm[c].round(4)
for c in('net_rate','arr_rate','dep_rate','arr_office'): fm[c]=fm[c].round(1)
fm['people_office']=fm.people_office.round(0)
def recs(df): return json.loads(df.to_json(orient='records'))
json.dump(recs(fm),open(O+'markets.json','w'),separators=(',',':'),ensure_ascii=False)
tr=ALL[['code','year','imm','nem','npr','ipm','iam']].copy()
tr['domestic']=tr.ipm+tr.iam; tr['international']=tr.imm-tr.nem+tr.npr; tr['period']=tr.year.map(lambda y:f"{y}/{str(int(y)+1)[2:]}")
tr=tr[tr.code.isin(m.id)]
json.dump(recs(tr.rename(columns={'code':'id'})[['id','period','domestic','international']].round(0)),open(O+'trend.json','w'),separators=(',',':'))
json.dump(recs(fs),open(O+'neighbourhoods.json','w'),separators=(',',':'),ensure_ascii=False)
json.dump(recs(fl),open(O+'metro_flows.json','w'),separators=(',',':'),ensure_ascii=False)
hs=hs.copy();hs['change']=hs.change.round(3);hs['family_share']=hs.family_share.round(3)
json.dump(recs(hs),open(O+'housing.json','w'),separators=(',',':'),ensure_ascii=False)
pvd=pd.DataFrame(pv);pvd['growth_latest']=pvd.growth_latest.round(4);pvd['growth_prior']=pvd.growth_prior.round(4)
json.dump(recs(pvd),open(O+'provinces.json','w'),separators=(',',':'),ensure_ascii=False)
mu['growth']=mu.growth.round(4)
json.dump(recs(mu),open(O+'municipalities.json','w'),separators=(',',':'),ensure_ascii=False)
for s,d in(('cd_s.json','map_markets.json'),('fsa_s.json','map_neighbourhoods.json')):
    open(O+d,'w').write(open(GEO+s).read())
