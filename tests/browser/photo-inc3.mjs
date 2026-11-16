// Developer browser check, clinic photo increment 3: live Panoramax lookups in the real page.
// Needs Chrome started with --headless=new --remote-debugging-port=9333. No local web server is needed: the page is
// served from site/ through the DevTools Fetch domain at http://dm.test/. Panoramax calls are real (live network),
// except in the "fails" and "slow" checks, where they are failed or held on purpose.
// Run: node tests/browser/photo-inc3.mjs   (not part of `node --test`, because it needs Chrome and the network)
// Fake clinic name only ("Fake Test Clinic"); all coordinates are public OpenStreetMap listings in Sherbrooke and Quebec City.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');
const BASE = 'http://dm.test/', CDP = 'http://localhost:9333';
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(), events = [];
let panoramaxMode = 'live'; const held = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  events.push(j);
  if (j.method !== 'Fetch.requestPaused') return;
  const {requestId, request} = j.params, u = new URL(request.url);
  if (u.origin + '/' === BASE) {
    const f = path.join(SITE, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(SITE) || !fs.existsSync(f)) { send('Fetch.fulfillRequest', {requestId, responseCode: 404, body: ''}); return; }
    send('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: (TYPES[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8'}],
      body: fs.readFileSync(f).toString('base64')});
  } else if (u.hostname === 'api.panoramax.xyz' && panoramaxMode === 'fail') send('Fetch.failRequest', {requestId, errorReason: 'InternetDisconnected'});
  else if (u.hostname === 'api.panoramax.xyz' && panoramaxMode === 'hold') held.push(requestId);
  else send('Fetch.continueRequest', {requestId});
});
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, n = 0;
const check = (name, ok, info) => { n++; if (ok) pass++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable'); await send('Log.enable');
await send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
const block = `(() => { const el = document.querySelector('[data-draw="hub-photo"]'); if (!el) return {text: '', links: []}; const img = el.querySelector('img'), a = [...el.querySelectorAll('a')];
  return {hidden: el.hidden, text: el.textContent, img: img && {alt: img.alt, hidden: img.hidden, complete: img.complete, w: img.naturalWidth, src: img.src, rp: img.referrerPolicy},
    links: a.map((x) => ({t: x.textContent, href: x.href, target: x.target, rel: x.rel}))}; })()`;
const go = async (q) => { await send('Page.navigate', {url: `${BASE}${q}`}); };
const until = async (fn, ms = 15000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(block); if (fn(v)) return v; await wait(100); } return v; };
const panoramaxReqs = () => events.filter((e) => e.method === 'Network.requestWillBeSent' && /panoramax/.test(e.params.request.url));

const A = '45.39869,-71.93327'; /* Centre Dentaire Gagne Remillard, Sherbrooke: has a Panoramax photo */
const B = '46.81239,-71.22778'; /* Centre Dentaire Charest, Quebec City: no Panoramax photo nearby */

// 1. A clinic with a photo: loading, then photo with credit, note and links
await go(`?hub=${A}#competition`);
const s1 = await until((v) => v.text.startsWith('Loading photo') || !!v.img);
/* iteration 2 appends the website part (spec 2.1.1) after "View on Google Maps"; the photo part must stay as it was (AC-9.5) */
const photoPart = (t) => t.replace(/ · (Website: \S+|Website not listed( · Search the web)?)$/, '');
check('AC-1.5 loading text first', s1.text.startsWith('Loading photo...') && s1.links.some((l) => l.t === 'View on Google Maps'), s1.text);
const s2 = await until((v) => v.img && !v.img.hidden);
check('AC-1.1 photo shown once loaded, never broken', !!s2.img && !s2.img.hidden && s2.img.complete && s2.img.w > 0, s2.img);
check('AC-7.3 alt text', s2.img && s2.img.alt === 'Street view of Centre Dentaire Gagné Rémillard', s2.img && s2.img.alt);
check('AC-6.1/6.2 credit, licence, date, note', /^Photo: \S.* via Panoramax, \S+ · Photo taken [A-Z][a-z]+ \d{4} · The photo shows the location, not necessarily the clinic's current sign\. · View on Google Maps$/.test(photoPart(s2.text)), s2.text);
const px = s2.links.find((l) => l.t === 'Panoramax');
check('R5 Panoramax links to the photo page, new tab, noreferrer', !!px && /^https:\/\/api\.panoramax\.xyz\/#focus=pic&pic=[0-9a-f-]{36}$/.test(px.href) && px.target === '_blank' && /noreferrer/.test(px.rel), px);
check('Image requested with no-referrer', s2.img && s2.img.rp === 'no-referrer', s2.img && s2.img.rp);
const sr = panoramaxReqs().filter((e) => /api\/search/.test(e.params.request.url));
check('Exactly one Panoramax search, bbox only, no Referer header', sr.length === 1 && /\/api\/search\?bbox=[-0-9.,]+&limit=50$/.test(sr[0].params.request.url)
  && sr[0].params.request.referrerPolicy === 'no-referrer' && !Object.entries(sr[0].params.request.headers).some(([h, v]) => h.toLowerCase() === 'referer' && v),
  sr.map((e) => [e.params.request.url, e.params.request.referrerPolicy]));

// redraw (change the radius) keeps the same image, no new search
await evalJs(`dash.setParams({rad: '5'})`); await wait(800);
check('R9 no new search on redraw', panoramaxReqs().filter((e) => /api\/search/.test(e.params.request.url)).length === 1, {});

// 2. Dark theme and phone width with a photo shown
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await wait(500);
  const m = await evalJs(`(() => { const r = document.querySelector('[data-draw="hub-photo"] img').getBoundingClientRect();
    return {sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: Math.round(r.width), h: Math.round(r.height)}; })()`);
  check(`AC-7.2 ${theme} 375 px: no horizontal scroll, photo fits`, m.sw <= m.cw && m.w > 0 && m.w <= m.cw && m.h <= 201, m);
  const shot = await send('Page.captureScreenshot', {format: 'jpeg', quality: 60, captureBeyondViewport: false});
  if (process.env.SHOTS) fs.writeFileSync(path.join(process.env.SHOTS, `inc3-${theme}-375.jpg`), Buffer.from(shot.result.data, 'base64'));
}
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
{
  const m = await evalJs(`(() => { const r = document.querySelector('[data-draw="hub-photo"] img').getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height)}; })()`);
  check('Desktop: photo at most about 200 px high', m.h > 0 && m.h <= 201, m);
}

// 3. Clinic with no photo nearby
await go(`?hub=${B}#competition`);
const s3 = await until((v) => v.text.startsWith('Photo not available'));
check('AC-3.1 no photo nearby: "Photo not available" + link', photoPart(s3.text) === 'Photo not available · View on Google Maps' && !s3.img, s3.text);

// 4. Fast switching: pick A (slow, held), then B at once; A's late answer must not appear
events.length = 0;
await go(`?hub=${B}#competition`); await until((v) => v.text.startsWith('Photo not available'));
panoramaxMode = 'hold';
await evalJs(`dash.setParams({hub: '45.39895,-71.91099'})`); /* Lapointe, Sherbrooke: has a photo; its search is held */
await until((v) => v.text.startsWith('Loading photo'));
panoramaxMode = 'live';
await evalJs(`dash.setParams({hub: '${B}'})`); /* back to B (already known: no photo) */
await wait(300);
for (const r of held.splice(0)) send('Fetch.continueRequest', {requestId: r}); /* now let the old answer arrive */
await wait(4000);
const s4 = await evalJs(block);
check('AC-1.2 late answer for the old clinic is not shown', photoPart(s4.text) === 'Photo not available · View on Google Maps' && !s4.img, s4.text);

// 5. Source fails: "Photo not available", no error from page code
events.length = 0;
panoramaxMode = 'fail';
await go(`?hub=45.39902,-71.90374#competition`); /* Dr. Denis Bernard, Sherbrooke */
const s5 = await until((v) => v.text.startsWith('Photo not available'));
check('AC-3.2 source down: "Photo not available"', photoPart(s5.text) === 'Photo not available · View on Google Maps' && !s5.img, s5.text);

// 6. Source too slow: after 10 s, "Photo not available"
panoramaxMode = 'hold';
await go(`?hub=45.28205,-72.12311#competition`); /* Dr. Rejean Tremblay, Magog */
await until((v) => v.text.startsWith('Loading photo'));
const t6 = Date.now();
const s6 = await until((v) => v.text.startsWith('Photo not available'), 14000);
check('R4 slow source: "Photo not available" after about 10 s', photoPart(s6.text) === 'Photo not available · View on Google Maps' && Date.now() - t6 > 8000, {ms: Date.now() - t6});
for (const r of held.splice(0)) send('Fetch.failRequest', {requestId: r, errorReason: 'Aborted'});
panoramaxMode = 'live';
const pageErrors = events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)));
check('AC-8.2 no console errors from page code when the source fails or is slow', pageErrors.length === 0, pageErrors.slice(0, 3).map((e) => JSON.stringify(e.params).slice(0, 200)));

// 7. Privacy guard: with a saved clinic, no Panoramax request for it or anything within 100 m
events.length = 0;
await go(`#competition`);
await wait(1500);
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'Fake Test Clinic', lat: 45.39903, lon: -71.90384}))`);
for (const [label, hub] of [['own listing', '45.39903,-71.90384'], ['listing 8 m away', '45.39902,-71.90374'], ['listing 23 m away', '45.39909,-71.90359']]) {
  await go(`?hub=${hub}#competition`);
  const s = await until((v) => v.text.startsWith('Photo not available'), 5000);
  await wait(1500);
  check(`R1 ${label}: no lookup, "Photo not available"`, s.text.startsWith('Photo not available') && !s.img, s.text);
}
await go(`#clinic`); await wait(2000);
const card = await evalJs(`document.querySelector('[data-draw="clinic-photo"]').textContent`);
check('R1/D2 Your clinic card: never looked up, privacy line', card.includes('stays private') && !card.includes('Loading'), card);
check('R1 zero Panoramax requests while the saved clinic area was shown', panoramaxReqs().length === 0, panoramaxReqs().map((e) => e.params.request.url));
await evalJs('localStorage.clear()');
console.log(`\n${pass}/${n} passed`);
ws.close();
