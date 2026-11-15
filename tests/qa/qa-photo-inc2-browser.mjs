// QA browser check, clinic photo increment 2: R1 guard wired through app.js (dmPhoto.view(c, clinic)).
// Needs the same server and Chrome as qa-photo-inc1.mjs. Run: node tests/qa/qa-photo-inc2-browser.mjs
// Fake clinic name only; coordinates are two public OpenStreetMap listings about 55 m apart, and one far away.
const BASE = 'http://localhost:8123/', CDP = 'http://localhost:9333';
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (m) => { const j = JSON.parse(m.data); if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } else events.push(j); });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const load = async (url) => { await send('Page.navigate', {url}); await wait(2500); };
let pass = 0, n = 0;
const check = (name, ok, info) => { n++; if (ok) pass++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');

const SAVED = {name: 'QA Fake Clinic', lat: 47.61994, lon: -52.72038};
await load(BASE); await evalJs(`localStorage.setItem('dm-clinic', ${JSON.stringify(JSON.stringify(SAVED))})`);
const state = `(() => { const h = hubNow(); const v = h && dmPhoto.view(h, clinic); const el = document.querySelector('[data-draw="hub-photo"]');
  return {hub: h && h.name, mine: !!(h && h.mine), lookup: v && v.lookup, privacy: !!(v && v.privacy), text: el.textContent}; })()`;
for (const [label, hub, wantLookup, wantPriv] of [
  ['own listing (same point) -> no lookup, privacy line', '47.61994,-52.72038', false, true],
  ['neighbour listing ~55 m -> no lookup, no privacy line', '47.62016,-52.71973', false, false],
  ['far listing -> lookup allowed', '45.52429,-73.55307', true, false]]) {
  await load(`${BASE}?hub=${hub}#competition`);
  const s = await evalJs(state);
  check(`R1 in page: ${label}`, s.lookup === wantLookup && s.privacy === wantPriv && s.text.startsWith('Photo not available'), s);
}
await load(`${BASE}#clinic`);
const card = await evalJs(`(() => { const v = dmPhoto.view({...clinic, mine: true}, clinic); return {lookup: v.lookup, text: document.querySelector('[data-draw="clinic-photo"]').textContent}; })()`);
check('R1 in page: card own clinic never looked up', card.lookup === false && card.text.includes('stays private'), card);
const out = events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/localhost:8123|data:|blob:|about:)/.test(e.params.request.url)).map((e) => e.params.request.url);
// Updated for increment 3: only the far listing may be looked up, and only on Panoramax; never the saved clinic or its ~55 m neighbour
const inBox = (u, la, lo) => { const m = u.match(/bbox=([-\d.,]+)/); if (!m) return false; const [w, s2, e, n] = m[1].split(',').map(Number); return la >= s2 && la <= n && lo >= w && lo <= e; };
check('Outside calls are Panoramax only', out.every((u) => u.startsWith('https://api.panoramax.xyz/api/search?')), out.slice(0, 5));
check('R1 no search box covers the saved clinic or the 55 m neighbour', !out.some((u) => inBox(u, 47.61994, -52.72038) || inBox(u, 47.62016, -52.71973)), out);
check('Far listing was looked up exactly once', out.filter((u) => inBox(u, 45.52429, -73.55307)).length === 1, out);
await evalJs('localStorage.clear()');
console.log(`\n${pass}/${n} passed`);
ws.close();
