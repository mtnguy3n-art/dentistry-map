import csv,sys
d=sys.argv[1]
keep={'All ages','0 to 14 years','65 years and older'}|{f'{a} to {a+4} years' for a in range(15,65,5)}
r=csv.reader(open(d+'/17100152.csv',encoding='utf-8-sig'));next(r)
AY=max(int(x[0]) for x in r)
years={'2021',str(AY-1),str(AY)}
r=csv.reader(open(d+'/17100152.csv',encoding='utf-8-sig'));h=next(r)
ix={c:i for i,c in enumerate(h)}
w=csv.writer(open(sys.argv[2],'w'));w.writerow(['year','geo','dguid','age','val'])
n=0
for x in r:
    if x[0] in years and x[3].startswith('Total') and x[ix['Age group']] in keep:
        w.writerow([x[0],x[1],x[2],x[ix['Age group']],x[ix['VALUE']]]);n+=1
print(AY,n)
