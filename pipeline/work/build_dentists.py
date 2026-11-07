import json,sys,urllib.request,urllib.parse
from shapely.geometry import shape,Point
from shapely.strtree import STRtree
# args: geo dir, output file, optional saved Overpass response
G,out=sys.argv[1],sys.argv[2]
Q='[out:json][timeout:170];area["ISO3166-1"="CA"][admin_level=2]->.a;(nwr["amenity"="dentist"](area.a);nwr["healthcare"="dentist"](area.a););out center tags;'
if len(sys.argv)>3: raw=json.load(open(sys.argv[3]))
else:
    r=urllib.request.Request('https://overpass-api.de/api/interpreter',urllib.parse.urlencode({'data':Q}).encode(),{'User-Agent':'dental-market-research/1.0','Accept':'application/json'})
    raw=json.load(urllib.request.urlopen(r,timeout=200))
csd=[]
for o in(0,2000,4000): csd+=json.load(open(f'{G}/csd{o}.geojson'))['features']
P=[shape(f['geometry']).buffer(0) for f in csd];T=STRtree(P)
seen=set();rows=[]
for x in raw['elements']:
    c=x.get('center',{}); la=x.get('lat',c.get('lat')); lo=x.get('lon',c.get('lon'))
    if la is None: continue
    t=x.get('tags',{}); nm=' '.join(t.get('name','').split())
    k=(nm.lower(),round(la,3),round(lo,3))
    if k in seen: continue
    seen.add(k)
    pt=Point(lo,la); h=[i for i in T.query(pt) if P[i].contains(pt)]
    if not h: continue
    a=' '.join(z for z in(t.get('addr:housenumber'),t.get('addr:street')) if z)
    rows.append(dict(name=nm or 'Dentist',address=a,lat=round(la,5),lon=round(lo,5),city_id=csd[h[0]]['properties']['CSDUID'],market_id=csd[h[0]]['properties']['CSDUID'][:4]))
rows.sort(key=lambda r:(r['market_id'],r['name']))
if len(rows)<3000: raise SystemExit(f'only {len(rows)} dentists, keeping the old file')
json.dump(rows,open(out,'w'),separators=(',',':'),ensure_ascii=False); print(len(rows))
