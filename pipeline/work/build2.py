import csv,json,sys,re,collections
import pandas as pd, numpy as np
sp=sys.argv[1]; W=sp+'/work/'; X=sp+'/dl/x/'; O=sp+'/out/'
import os; os.makedirs(O,exist_ok=True)
PR={'10':'NL','11':'PE','12':'NS','13':'NB','24':'QC','35':'ON','46':'MB','47':'SK','48':'AB','59':'BC','60':'YT','61':'NT','62':'NU'}
st=json.load(open(W+'stage1.json')); ns=st['ns']; inc_nat=st['inc']; deg_nat=st['deg']; f2cd=st['f2cd']
cen=pd.read_pickle(W+'cen.pkl')
def seg(yf,ya,op,rt,income,degree,ns):
    lq={'Young families':yf/ns['yf'],'Young adults':ya/ns['ya'],'Older':op/ns['op'],'Retirees':rt/ns['rt']}
    k=max(lq,key=lq.get)
    if k=='Older': k='Older professionals' if (income>=inc_nat or degree>=deg_nat) else 'Older working-age'
    return k
# components
comp=pd.read_csv(W+'comp153.csv',dtype={'code':str})
comp['val']=pd.to_numeric(comp.val,errors='coerce')
cdc=comp[comp.code.str.len()==4]; cdc=cdc[cdc.geo!='Canada']
L={'Births':'births','Deaths':'deaths','Immigrants':'imm','Net emigration':'nem','Net interprovincial migration':'ipm','Net intraprovincial migration':'iam','Net non-permanent residents':'npr'}
ALL=cdc[cdc.age=='All ages'].pivot_table(index=['code','year'],columns='comp',values='val',aggfunc='first').rename(columns=L).reset_index()
print(comp[(comp.geo=='Canada')&(comp.age=='All ages')].pivot_table(index='year',columns='comp',values='val'))
Y=ALL.year.max(); print('latest',Y)
# age estimates
age=pd.read_csv(W+'age152.csv'); age['code']=age.dguid.str.replace('2021A0003','')
AY=int(age.year.max()); assert int(Y)+1==AY,(Y,AY)
a=age[age.dguid.str.startswith('2021A0003')]
def bands(df):
    p=df.pivot_table(index='code',columns='age',values='val')
    o=pd.DataFrame(index=p.index); o['pop']=p['All ages']
    o['yf']=p['0 to 14 years']+p['30 to 34 years']+p['35 to 39 years']+p['40 to 44 years']
    o['ya']=p['15 to 19 years']+p['20 to 24 years']+p['25 to 29 years']
    o['op']=p['45 to 49 years']+p['50 to 54 years']+p['55 to 59 years']+p['60 to 64 years']
    o['rt']=p['65 years and older']; return o
b25=bands(a[a.year==AY]); b21=bands(a[a.year==2021]); b24=bands(a[a.year==AY-1])
can=age[(age.geo=='Canada')&(age.year==AY)].set_index('age').val
ns25={'yf':(can['0 to 14 years']+can['30 to 34 years']+can['35 to 39 years']+can['40 to 44 years'])/can['All ages'],
 'ya':(can['15 to 19 years']+can['20 to 24 years']+can['25 to 29 years'])/can['All ages'],
 'op':(can['45 to 49 years']+can['50 to 54 years']+can['55 to 59 years']+can['60 to 64 years'])/can['All ages'],'rt':can['65 years and older']/can['All ages']}
print(ns25,can['All ages'])
# net flow by age band for latest year
aa=cdc[(cdc.year==Y)&(cdc.age!='All ages')].copy()
sign={'Immigrants':1,'Net emigration':-1,'Net interprovincial migration':1,'Net intraprovincial migration':1,'Net non-permanent residents':1}
aa['s']=aa.comp.map(sign)*aa.val.fillna(0)
AGE={'0 to 14 years':'yf','30 to 34 years':'yf','35 to 39 years':'yf','40 to 44 years':'yf','15 to 19 years':'ya','20 to 24 years':'ya','25 to 29 years':'ya','45 to 49 years':'op','50 to 54 years':'op','55 to 59 years':'op','60 to 64 years':'op','65 years and older':'rt'}
aa['band']=aa.age.map(AGE); fb=aa.dropna(subset=['band']).groupby(['code','band']).s.sum().unstack().fillna(0)
# dental offices
csd=collections.defaultdict(float); cma=[]
r=csv.reader(open(X+'33101176.csv',encoding='utf-8-sig'));h=next(r);ix={c:i for i,c in enumerate(h)}
csdn={};csdv={}
for x in r:
    if x[ix['Employment size']].startswith('Total') and 'Offices of dentists' in x[4] :
        v=float(x[ix['VALUE']] or 0)
        if x[2].startswith('2021A0005'):
            c=x[2][9:]; csdv[c]=v; csdn[c]=x[1]; csd[c[:4]]+=v
        else: cma.append((x[1],x[2],v))
print('csd offices',sum(csdv.values()),'cma rows',len(cma),'cma sum',sum(v for _,_,v in cma))
r=csv.reader(open(X+'17100155.csv',encoding='utf-8-sig'));h=next(r)
pc={}
for x in r:
    if x[0] in('2021',str(AY)) and x[2].startswith('2021A0005') and x[1] and x[9]: pc.setdefault(x[2][9:],{'n':x[1]})['latest' if x[0]==str(AY) else x[0]]=float(x[9])
# assemble markets
cg=json.load(open(sp+'/geo/cd.geojson'))['features']
names={f['properties']['CDUID']:f['properties'] for f in cg}
nm=json.load(open(sp+'/dl/m153.json'))[0]['object']['dimension'][0]['member']
fname={m['classificationCode']:m['memberNameEn'] for m in nm if m.get('classificationCode')}
cc=cen[cen.flow=='DF_CD'].set_index('id')
rows=[]
for code,p in names.items():
    if code not in b25.index: print('no age',code); continue
    b=b25.loc[code]; pop=b['pop']; l=ALL[(ALL.code==code)&(ALL.year==Y)].iloc[0]; c0=cc.loc[code]
    dom=l.ipm+l.iam; intl=l.imm-l.nem+l.npr
    net=dom+intl
    arr=l.imm+max(0,l.npr)+max(0,dom); dep=l.nem+max(0,-l.npr)+max(0,-dom)
    off=csd.get(code,0)
    rec=dict(id=code,market=p['CDNAME'],prov=PR[p['PRUID']],pop=int(pop),growth=b['pop']/b21.loc[code,'pop']-1,
      net=round(net),net_rate=net/pop*1000,arrivals=round(arr),departures=round(dep),arr_rate=arr/pop*1000,dep_rate=dep/pop*1000,
      domestic=round(dom),immigrants=round(l.imm),temporary=round(l.npr),emigration=round(l.nem),
      s_yf=b.yf/pop,s_ya=b.ya/pop,s_op=b.op/pop,s_rt=b.rt/pop,
      f_yf=round(fb.loc[code].get('yf',0)),f_ya=round(fb.loc[code].get('ya',0)),f_op=round(fb.loc[code].get('op',0)),f_rt=round(fb.loc[code].get('rt',0)),
      income=c0.income,degree=c0.degree,owner=c0.owner,offices=int(off),people_office=(pop/off if off else None),arr_office=(arr/off if off else None))
    rec['segment']=seg(b.yf/pop,b.ya/pop,b.op/pop,b.rt/pop,c0.income,c0.degree,ns25)
    rows.append(rec)
m=pd.DataFrame(rows)
print(m[['pop','net','arrivals','departures','offices']].sum()); print(m[['net_rate','arr_rate','dep_rate','growth','people_office','arr_office']].describe())
print(m.segment.value_counts()); print((m.offices==0).sum())
m.to_pickle(W+'markets.pkl'); ALL.to_pickle(W+'all.pkl')
print(m.sort_values('pop',ascending=False).head(14)[['market','prov','pop','net_rate','arr_rate','dep_rate','segment','offices','people_office','f_yf','f_ya','f_op','f_rt']].to_string())
# reconcile check
y=ALL[ALL.year==Y]; ck=b25['pop']-b24['pop']
z=y.set_index('code'); e=(z.births-z.deaths+z.imm-z.nem+z.npr+z.ipm+z.iam)
d=(ck-e).dropna(); print('reconcile residual abs median',d.abs().median(),'max',d.abs().max(),'sum',d.sum(), 'pop chg',ck.sum())
json.dump({'pc':pc,'csdv':csdv,'csdn':csdn,'ns25':ns25,'Y':str(Y),'AY':str(AY)},open(W+'stage2.json','w'))
