"""QA iteration 2, increment 1: refresh.py --dentists boundaries on a scratch copy (fake listings only).
Run: .venv/bin/python tests/qa/qa_web_inc1_refresh.py"""
import hashlib, json, os, shutil, subprocess, sys, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SPOTS = [(45.55, -73.65), (43.70, -79.42), (51.04, -114.10)]
fails = 0

def fake(n, extra=()):
    els = []
    for i in range(n):
        la, lo = SPOTS[i % 3]; j = i // 3
        els.append(dict(type='node', id=i, lat=la + (j % 30) * 0.001, lon=lo + (j // 30) * 0.0003, tags={'name': f'QA Fake {i}'}))
    return {'elements': els + list(extra)}

def h(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()

def run(label, overpass, old_count, expect_rc, check=None, raw=None):
    global fails
    t = tempfile.mkdtemp(prefix='qa-web-'); p = os.path.join(t, 'pipeline'); d = os.path.join(t, 'site', 'data')
    os.makedirs(os.path.join(p, 'work')); os.makedirs(d)
    shutil.copy(os.path.join(ROOT, 'pipeline', 'refresh.py'), p)
    for f in ('build_dentists.py', 'weblink.py'):
        shutil.copy(os.path.join(ROOT, 'pipeline', 'work', f), os.path.join(p, 'work'))
    os.symlink(os.path.join(ROOT, 'pipeline', 'geo'), os.path.join(p, 'geo'))
    open(os.path.join(p, 'last_release.txt'), 'w').write('qa-release\n')
    open(os.path.join(d, 'meta.json'), 'w').write('{"qa": 1}')
    open(os.path.join(d, 'dentists.json'), 'w').write(json.dumps([{'name': 'Old', 'market_id': '2466'}] * old_count))
    before = {f: h(os.path.join(d, f)) for f in os.listdir(d)}; lr = h(os.path.join(p, 'last_release.txt'))
    sv = os.path.join(t, 'ov.json'); open(sv, 'w').write(raw if raw is not None else json.dumps(overpass))
    r = subprocess.run([sys.executable, os.path.join(p, 'refresh.py'), '--dentists', sv], capture_output=True, text=True, timeout=600)
    ok = r.returncode == expect_rc
    ok &= h(os.path.join(d, 'meta.json')) == before['meta.json'] and h(os.path.join(p, 'last_release.txt')) == lr
    if expect_rc:
        ok &= h(os.path.join(d, 'dentists.json')) == before['dentists.json']
    rows = json.load(open(os.path.join(d, 'dentists.json')))
    rep = json.load(open(os.path.join(p, 'report.json'))) if os.path.exists(os.path.join(p, 'report.json')) else None
    if check: ok &= bool(check(rows, rep))
    print('PASS' if ok else 'FAIL', label, 'rc', r.returncode, 'rows', len(rows), 'report', rep and {k: rep.get(k) for k in ('dentists', 'dentists_web', 'failed')})
    if not ok:
        fails += 1; print(r.stdout[-500:], r.stderr[-800:])
    shutil.rmtree(t, ignore_errors=True)

run('exactly 75 % (3750 of 5000) accepted', fake(3750), 5000, 0, lambda r, rep: len(r) == 3750)
run('just under 75 % (3749 of 5000) refused', fake(3749), 5000, 1, lambda r, rep: rep['failed'])
run('exactly 3000 accepted (old 3000)', fake(3000), 3000, 0, lambda r, rep: len(r) == 3000)
run('2999 refused even if old smaller', fake(2999), 100, 1)
run('broken Overpass file refused, files kept', None, 4000, 1, raw='{not json')
dups = [
    dict(type='node', id=8001, lat=45.6001, lon=-73.6001, tags={'name': 'QA Gamma', 'website': 'javascript:alert(1)'}),
    dict(type='node', id=8002, lat=45.6003, lon=-73.6003, tags={'name': 'qa gamma', 'url': 'gammafictive.ca'}),
    dict(type='node', id=8003, lat=45.6201, lon=-73.6201, tags={'name': 'QA Delta', 'website': 'https://deltafictive.ca'}),
    dict(type='node', id=8004, lat=45.6202, lon=-73.6202, tags={'name': 'QA Delta'}),
    dict(type='node', id=8005, lat=45.5301, lon=-73.6001, tags={'name': 'QA Eps', 'website': 'mailto:x@y.ca;tel:1;eps.fictive.ca'}),
    dict(type='node', id=8006, lat=47.0, lon=-40.0, tags={'name': 'QA Ocean', 'website': 'oceanfictive.ca'}),  # outside Canada
]
def chk(rows, rep):
    by = {r['name']: r for r in rows}
    return (by['QA Gamma'].get('web') == 'https://gammafictive.ca' and by['QA Delta'].get('web') == 'https://deltafictive.ca'
            and by['QA Eps'].get('web') == 'https://eps.fictive.ca' and 'QA Ocean' not in by and 'qa gamma' not in by
            and rep['dentists_web'] == {'canada': 3, 'quebec': 3} and all(('web' not in r) or r['web'] for r in rows))
run('WR3 merge, scheme cleanup, counts', fake(3000, dups), 3000, 0, chk)
print('failures:', fails); sys.exit(1 if fails else 0)
