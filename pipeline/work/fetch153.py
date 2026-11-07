import json,sys,urllib.request,time,csv
sp=sys.argv[1]
o=json.load(open(sp+'/dl/m153.json'))[0]['object']
geo=o['dimension'][0]['member']; comps=o['dimension'][1]['member']; ages=o['dimension'][3]['member']
AG=[1,112,114,21,27,33,39,45,51,57,63,69,75]
CO=[1,2,3,4,8,9,10]   # births deaths immigrants netEmig netInter netIntra netNPR
series=[]
for g in geo:
    for c in CO:
        series.append((g['memberId'],c,1,6))
        if c>=3:
            for a in AG[1:]: series.append((g['memberId'],c,a,1))
print(len(series),flush=True)
gn={m['memberId']:(m['memberNameEn'],m.get('classificationCode')) for m in geo}
cn={m['memberId']:m['memberNameEn'] for m in comps}; an={m['memberId']:m['memberNameEn'] for m in ages}
w=csv.writer(open(sp+'/work/comp153.csv','w'));w.writerow(['year','geoid','code','geo','comp','age','val','status'])
U='https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods'
miss=0
for i in range(0,len(series),280):
    b=series[i:i+280]
    body=json.dumps([{'productId':17100153,'coordinate':f'{g}.{c}.1.{a}.0.0.0.0.0.0','latestN':n} for g,c,a,n in b]).encode()
    for t in range(6):
        try:
            res=json.load(urllib.request.urlopen(urllib.request.Request(U,body,{'Content-Type':'application/json'}),timeout=120));break
        except Exception as e: print('retry',e,flush=True);time.sleep(4+t*5)
    else: raise SystemExit('fail')
    for s in res:
        if s.get('status')!='SUCCESS': miss+=1;continue
        g,c,_,a=map(int,s['object']['coordinate'].split('.')[:4])
        for p in s['object']['vectorDataPoint']:
            w.writerow([p['refPer'][:4],g,gn[g][1],gn[g][0],cn[c],an[a],p['value'],p.get('statusCode')])
    if i%14000==0: print(i,miss,flush=True)
    time.sleep(0.15)
print('done',miss)
