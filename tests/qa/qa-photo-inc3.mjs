// QA browser check, clinic photo increment 3: live Panoramax lookups in the real page. Independent of the developer's checks.
// Updated for iteration 2, increment 3: centre A has no website, so the line ends with " · Website not listed · Search the web".
// Needs: python3 -m http.server 8123 --directory site, and Chrome started with --headless=new --remote-debugging-port=9333.
// Run: node tests/qa/qa-photo-inc3.mjs   (uses the live network; Panoramax answers are held or failed on purpose in some checks)
// Fake clinic names only ("QA Fake Clinic"); coordinates are public OpenStreetMap listings, or made-up points near them.
const BASE = 'http://localhost:8123/', CDP = 'http://localhost:9333';
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); let events = [];
// mode for Panoramax requests: 'live' | 'holdSearch' | 'failSearch' | 'holdImage' | 'failImage'
let mode = 'live'; const held = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const isSearch = (u) => u.startsWith('https://api.panoramax.xyz/api/search');
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  events.push(j);
  if (j.method !== 'Fetch.requestPaused') return;
  const {requestId, request} = j.params, u = request.url;
  if (isSearch(u) && mode === 'holdSearch') held.push({requestId, url: u});
  else if (isSearch(u) && mode === 'failSearch') send('Fetch.failRequest', {requestId, errorReason: 'TimedOut'});
  else if (!isSearch(u) && mode === 'holdImage') held.push({requestId, url: u});
  else if (!isSearch(u) && mode === 'failImage') send('Fetch.failRequest', {requestId, errorReason: 'ConnectionRefused'});
  else send('Fetch.continueRequest', {requestId});
});
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({name, ok: !!ok}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); };
await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
await send('Fetch.enable', {patterns: [{urlPattern: '*panoramax*', requestStage: 'Request'}]});
// first-visit conditions: no browser cache (otherwise Chrome may answer from an earlier run and skip the network)
await send('Network.setCacheDisabled', {cacheDisabled: true});
// log every change of the competition title and photo block, to catch a stale photo even for a split second
await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__log = []; document.addEventListener('DOMContentLoaded', () => {
  const t = document.querySelector('[data-draw="hub-name"]'), b = document.querySelector('[data-draw="hub-photo"]');
  const rec = () => { const i = b.querySelector('img'); window.__log.push({t: t.textContent, text: b.textContent, src: i ? i.src : '', alt: i ? i.alt : '', shown: !!(i && !i.hidden && !b.hidden), broken: !!(i && !i.hidden && i.complete && i.naturalWidth === 0)}); };
  new MutationObserver(rec).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'src']}); });`});

const block = `(() => { const el = document.querySelector('[data-draw="hub-photo"]'), img = el.querySelector('img');
  return {hidden: el.hidden, text: el.textContent, title: document.querySelector('[data-draw="hub-name"]').textContent,
    img: img && {alt: img.alt, hidden: img.hidden, w: img.naturalWidth, src: img.src, rp: img.referrerPolicy, h: img.getBoundingClientRect().height},
    links: [...el.querySelectorAll('a')].map((a) => ({t: a.textContent, href: a.href, target: a.target, rel: a.rel}))}; })()`;
const until = async (fn, ms = 15000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(block); if (fn(v)) return v; await wait(100); } return v; };
const go = async (url) => { events = []; await send('Page.navigate', {url}); await wait(300); };
const reqs = (re = /panoramax/) => events.filter((e) => e.method === 'Network.requestWillBeSent' && re.test(e.params.request.url));
const searches = () => reqs(/api\.panoramax\.xyz\/api\/search/).map((e) => e.params.request.url);
const inBox = (u, la, lo) => { const m = u.match(/bbox=([-\d.,]+)/); if (!m) return false; const [w, s, e, n] = m[1].split(',').map(Number); return la >= s && la <= n && lo >= w && lo <= e; };
const pageErrors = () => events.filter((e) => (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') || e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && e.params.entry.source !== 'network')).map((e) => JSON.stringify(e.params).slice(0, 200));
const setHub = (h) => evalJs(`dash.setParams({hub: '${h}', svc: ''})`); /* the same call hubSet() makes when a clinic is picked */

const A = {hub: '45.39869,-71.93327', lat: 45.39869, lon: -71.93327, name: 'Centre Dentaire Gagné Rémillard'}; // has a photo
const B = {hub: '45.39606,-71.94475', lat: 45.39606, lon: -71.94475}; // 943 m away
const NOTE = "The photo shows the location, not necessarily the clinic's current sign.";
const EXPECTED_ID = '21ad9cc0-8ce2-401d-9bbb-79acd61ffc2c'; // R2 worked out by hand from the live answer on 2026-11-14 (only photo within 50 deg)

// ---------- 1. Photo found: states, credit, links, no Referer ----------
await go(`${BASE}#competition`); await evalJs('localStorage.clear()');
await go(`${BASE}?hub=${A.hub}#competition`);
const s0 = await until((v) => v.text.startsWith('Loading') || !!v.img, 8000);
check('AC-1.5 "Loading photo..." with the Google Maps link first', s0.text === 'Loading photo... · View on Google Maps · Website not listed · Search the web', s0.text);
const s1 = await until((v) => v.img && !v.img.hidden);
check('AC-1.1 photo shown under the title, fully loaded', s1.img && s1.img.w > 0 && !s1.img.hidden, s1.img);
check('R2 the picked photo matches QA hand calculation', s1.img && s1.img.src.includes(EXPECTED_ID.split('-').slice(1).join('-')), s1.img && s1.img.src);
check('AC-7.3 alt "Street view of [clinic name]" with accents', s1.img && s1.img.alt === `Street view of ${A.name}`, s1.img && s1.img.alt);
check('AC-6.1/6.2/6.3 credit line: contributor, Panoramax, licence, Québec month, sign note, link',
  s1.text === `Photo: Ombrefeu via Panoramax, CC-BY-SA-4.0 · Photo taken November 2026 · ${NOTE} · View on Google Maps · Website not listed · Search the web`, s1.text);
const pxl = s1.links.find((l) => l.t === 'Panoramax'), gm = s1.links.find((l) => l.t === 'View on Google Maps');
check('R5 "Panoramax" links to the photo page in a new tab, noreferrer', pxl && pxl.href === `https://api.panoramax.xyz/#focus=pic&pic=${EXPECTED_ID}` && pxl.target === '_blank' && /noopener/.test(pxl.rel) && /noreferrer/.test(pxl.rel), pxl);
check('AC-4.1/R6 Google Maps link still there, coordinates only', gm && gm.href === 'https://www.google.com/maps/search/?api=1&query=45.39869,-71.93327' && gm.target === '_blank', gm);
check('AC-7.4 photo at most about 200 px high (1280 px wide window)', s1.img && s1.img.h <= 201 && s1.img.h > 50, s1.img && s1.img.h);
// Referer actually sent on the wire (ExtraInfo has the final headers)
await wait(500);
const pxIds = new Set(reqs().map((e) => e.params.requestId));
const sent = events.filter((e) => e.method === 'Network.requestWillBeSentExtraInfo' && pxIds.has(e.params.requestId)).map((e) => e.params.headers);
const withRef = sent.filter((h) => Object.keys(h).some((k) => k.toLowerCase() === 'referer'));
check('No Referer header on any Panoramax request (search and images)', sent.length >= 2 && withRef.length === 0, {requests: sent.length, withRef});
const urls = reqs().map((e) => e.params.request.url);
check('Requests carry only a ~50 m box, never the clinic name or the page address', urls.every((u) => !/Gagn|R%C3%A9millard|localhost|hub=/.test(u)) && searches().length === 1, urls);
check('Only Panoramax hosts were contacted', events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/localhost:8123|data:|blob:|about:)/.test(e.params.request.url)).every((e) => /(^|\.)panoramax\.|panoramax\./.test(new URL(e.params.request.url).host)));
check('No console error from page code', pageErrors().length === 0, pageErrors());
// the photo page id exists at the source (the link is not dead)
const one = await (await fetch(`https://api.panoramax.xyz/api/search?ids=${EXPECTED_ID}`)).json();
check('The linked photo exists on Panoramax', one.features && one.features.length === 1 && one.features[0].id === EXPECTED_ID, one.features && one.features.length);

// dark theme with a photo
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'dark'}]});
await wait(300);
const dk = await evalJs(`(() => { const el = document.querySelector('[data-draw="hub-photo"]'); const p = el.querySelector('p'); let n = el, bg = 'rgba(0, 0, 0, 0)'; while (n && /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; } return {bg, fg: getComputedStyle(p).color, a: getComputedStyle(p.querySelector('a')).color}; })()`);
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const ctr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
check('AC-7.1 dark theme: credit text and links readable (>= 4.5)', ctr(dk.fg, dk.bg) >= 4.5 && ctr(dk.a, dk.bg) >= 4.5, {note: ctr(dk.fg, dk.bg).toFixed(2), link: ctr(dk.a, dk.bg).toFixed(2)});
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});

// ---------- 2. R9: one lookup per clinic per visit, A -> B -> A -> B ----------
events = [];
await setHub(B.hub); await until((v) => v.title !== `Competition around ${A.name}` && !v.text.startsWith('Loading'));
await setHub(A.hub); const back = await until((v) => v.img && !v.img.hidden, 5000);
await setHub(B.hub); await wait(800); await setHub(A.hub); await wait(800);
const sB = searches().filter((u) => inBox(u, B.lat, B.lon)).length, sA = searches().filter((u) => inBox(u, A.lat, A.lon)).length;
check('R9 returning to a clinic in the same visit asks the source again 0 times', sA === 0 && sB === 1, {searchesA: sA, searchesB: sB});
check('R9 returning to A shows its photo again at once', back.img && !back.img.hidden && back.text.includes('Photo taken'), back.text);

// ---------- 3. AC-1.2 fast switching with A's answer arriving late ----------
await go(`${BASE}#competition`); await evalJs('window.__log = []');
mode = 'holdSearch'; held.length = 0;
await setHub(A.hub); await wait(400);
await setHub(B.hub); await wait(400);
const heldNow = held.splice(0);
check('Both searches are in flight (held by QA)', heldNow.length === 2, heldNow.map((h) => h.url));
mode = 'live';
const hA = heldNow.find((h) => inBox(h.url, A.lat, A.lon)), hB = heldNow.find((h) => inBox(h.url, B.lat, B.lon));
if (hA) await send('Fetch.continueRequest', {requestId: hA.requestId}); // A answers first, while B is the centre
await wait(4000);
if (hB) await send('Fetch.continueRequest', {requestId: hB.requestId});
const fin = await until((v) => !v.text.startsWith('Loading'), 8000);
const log = await evalJs('window.__log');
const stale = log.filter((r) => r.src && r.t !== `Competition around ${A.name}`);
check('AC-1.2 A\'s late photo never appears while B is the centre (every DOM change logged)', stale.length === 0 && log.length > 0, {changes: log.length, stale: stale.slice(0, 2)});
check('AC-1.2 B ends in its own state', fin.title !== `Competition around ${A.name}` && !fin.img && fin.text.startsWith('Photo not available'), fin.text);
events = []; await setHub(A.hub); const lateA = await until((v) => v.img && !v.img.hidden, 5000);
check('R9 A\'s late answer was kept: going back shows the photo with no new search', lateA.img && !lateA.img.hidden && searches().length === 0, {s: searches().length});
check('AC-3.3 no broken image at any moment during switching', !log.some((r) => r.broken), log.filter((r) => r.broken).length);

// ---------- 4. Map click: photo follows the new centre ----------
await go(`${BASE}?hub=45.52429,-73.55307#competition`); await until((v) => !v.text.startsWith('Loading'), 12000);
const clicked = await evalJs(`(() => { const c = [...document.querySelectorAll('#competition svg circle')].find((x) => x.style.cursor === 'pointer'); if (!c) return false; c.dispatchEvent(new MouseEvent('click', {bubbles: true})); return true; })()`);
const mc = await until((v) => !v.text.startsWith('Loading'), 12000);
const hp = await evalJs(`new URLSearchParams(location.search).get('hub')`);
check('AC-1.4 after a map click the block follows the new centre', clicked && hp !== '45.52429,-73.55307' && mc.links.some((l) => l.t === 'View on Google Maps' && l.href.endsWith(hp.split(',').map((x) => Number(x).toFixed(5)).join(','))), {hp, text: mc.text});

// ---------- 5. Time limit and failures ----------
// the browser cache must be off, otherwise the image already seen above comes from the cache and never reaches the network
await send('Network.setCacheDisabled', {cacheDisabled: true});
for (const [m, label] of [['holdSearch', 'search never answers'], ['holdImage', 'search answers, image never arrives']]) {
  await go(`${BASE}#competition`); mode = m; held.length = 0;
  const t0 = Date.now(); await setHub(A.hub);
  const r = await until((v) => v.text.startsWith('Photo not available') || (v.img && !v.img.hidden), 14000);
  const ms = Date.now() - t0;
  check(`R4/AC-3.2 ${label}: "Photo not available" after about 10 s`, r.text.startsWith('Photo not available') && ms >= 9000 && ms <= 11500 && !r.img, {ms, text: r.text});
  check(`AC-3.2 ${label}: no console error from page code`, pageErrors().length === 0, pageErrors());
  mode = 'live'; for (const h of held.splice(0)) await send('Fetch.failRequest', {requestId: h.requestId, errorReason: 'Aborted'}).catch(() => {});
}
for (const [m, label] of [['failSearch', 'source down'], ['failImage', 'image fails to download']]) {
  await go(`${BASE}#competition`); await evalJs('window.__log = []'); mode = m;
  await setHub(A.hub);
  const r = await until((v) => v.text.startsWith('Photo not available') || (v.img && !v.img.hidden), 12000);
  const lg = await evalJs('window.__log');
  check(`AC-3.1/3.3 ${label}: "Photo not available" + link, no image element, never a broken icon`, r.text === 'Photo not available · View on Google Maps · Website not listed · Search the web' && !r.img && !lg.some((x) => x.broken || x.shown), r.text);
  check(`AC-3.2 ${label}: no console error from page code`, pageErrors().length === 0, pageErrors());
  mode = 'live';
}

// ---------- 6. R1 100 m guard around a saved clinic typed as coordinates (not a listing) ----------
// points straight north of A: 1 deg latitude is about 111,195 m
const north = (m) => (A.lat + m / 111195).toFixed(5);
for (const [m, want] of [[25, 'mine'], [60, 'blocked'], [98, 'blocked'], [103, 'allowed']]) {
  await go(`${BASE}#competition`);
  await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Clinic', lat: ${north(m)}, lon: ${A.lon}}))`);
  await go(`${BASE}?hub=${A.hub}#competition`);
  const r = await until((v) => !v.text.startsWith('Loading'), 12000);
  await wait(500);
  const n = searches().length;
  const priv = r.text.includes('stays private');
  if (want === 'allowed') check(`R1 saved clinic ${m} m away: lookup made, photo shown`, n === 1 && r.img && !priv, {searches: n, text: r.text.slice(0, 60)});
  else check(`R1 saved clinic ${m} m away: zero requests, "Photo not available"${want === 'mine' ? ' + privacy line' : ', no privacy line'}`, n === 0 && reqs().length === 0 && !r.img && r.text.startsWith('Photo not available') && priv === (want === 'mine'), {searches: n, text: r.text});
}
// the "Your clinic" card and "Use your clinic" never ask
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Clinic', lat: ${A.lat}, lon: ${A.lon}}))`);
await go(`${BASE}#clinic`); await wait(2500);
await evalJs(`document.querySelectorAll('#competition .dm-hub-mine')[0].click()`); await wait(2500);
check('R1 "Your clinic" card + "Use your clinic" on the clinic with a free photo: zero outside requests', reqs().length === 0 && !(await evalJs(block)).img, reqs().map((e) => e.params.request.url));
// form: saving the clinic through the real form also guards at once
await go(`${BASE}?hub=${B.hub}#clinic`); await wait(1500); events = [];
await evalJs(`localStorage.clear()`);
await go(`${BASE}#clinic`); await wait(1500);
await evalJs(`(() => { const f = document.querySelector('.dm-clinic-form'); f.elements.name.value = 'QA Fake Clinic'; f.elements.spot.value = '${north(70)}, ${A.lon}'; f.requestSubmit(); })()`); await wait(500);
events = [];
await setHub(A.hub); await wait(2500);
check('R1 clinic saved through the form, then the listing 70 m away is picked: zero requests', reqs().length === 0, reqs().map((e) => e.params.request.url));
// Observation: what happens when the clinic is removed while it is the centre
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Clinic', lat: ${A.lat}, lon: ${A.lon}}))`);
await go(`${BASE}?hub=${A.hub}#clinic`); await wait(2500); events = [];
await evalJs(`document.querySelector('.dm-clinic-remove').click()`); await wait(3000);
console.log(`INFO  after "Remove" while the clinic is the centre, Panoramax searches made: ${searches().length} ${JSON.stringify(searches())}`);

await evalJs('localStorage.clear()');
ws.close(); await fetch(`${CDP}/json/close/${tgt.id}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
