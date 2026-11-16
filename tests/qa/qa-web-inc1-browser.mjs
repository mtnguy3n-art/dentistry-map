// QA browser check, clinic website increment 1: the page loads the refreshed dentists.json (with the new optional
// `web` field), shows no console error, renders unchanged (no website text or link yet) and makes no request to any
// clinic website or search engine. Needs: python3 -m http.server 8123 --directory site, and Chrome started with
// --headless=new --remote-debugging-port=9333. Run: node tests/qa/qa-web-inc1-browser.mjs
// Uses public OpenStreetMap listings only; no saved clinic.
const BASE = 'http://localhost:8123/', CDP = 'http://localhost:9333';
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(), errs = [], hosts = new Set();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  if (j.method === 'Network.requestWillBeSent') { try { hosts.add(new URL(j.params.request.url).host); } catch {} }
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))
    || (j.method === 'Log.entryAdded' && j.params.entry.level === 'error')) errs.push(JSON.stringify(j.params).slice(0, 300));
});
const ev = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e).catch(() => false)) return true; await wait(150); } return false; };
const res = []; const check = (n, ok, info) => { res.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 300) : ''}`); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});
const webHosts = new Set();
for (const [label, q, theme] of [['default', '', 'light'], ['competition Rosemont (has web)', '?hub=45.55648,-73.56143#competition', 'light'], ['competition dark', '?hub=45.55648,-73.56143#competition', 'dark']]) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Page.navigate', {url: BASE + q});
  const ok = await until(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`);
  await wait(1500);
  check(`${label}: data loaded`, ok);
  if (label === 'default') {
    const s = await ev(`(async()=>{const d=await (await fetch('data/dentists.json',{cache:'no-store'})).json();return {n:d.length,w:d.filter(r=>'web' in r).length,hosts:[...new Set(d.filter(r=>r.web).map(r=>new URL(r.web).host))]}})()`);
    check('dentists.json served: 5,728 listings, 1,692 with web', s.n === 5728 && s.w === 1692, {n: s.n, w: s.w});
    s.hosts.forEach((h) => webHosts.add(h));
  }
  const dom = await ev(`document.body.innerText.toLowerCase()`);
  const links = await ev(`[...document.querySelectorAll('a[href]')].map(a=>a.href)`);
  check(`${label}: no website text on the page yet`, !/\bwebsite\b/.test(dom) || !links.some((h) => { try { return webHosts.has(new URL(h).host); } catch { return false; } }));
  check(`${label}: no link to any listing website`, !links.some((h) => { try { return webHosts.has(new URL(h).host); } catch { return false; } }));
  check(`${label}: no horizontal scroll`, await ev(`document.documentElement.scrollWidth <= window.innerWidth`));
}
check('no console errors or exceptions', errs.length === 0, errs);
const bad = [...hosts].filter((h) => webHosts.has(h) || /google\.[a-z.]+$/.test(h) && !/maps|tile|fonts|gstatic/.test(h));
check('no request to a clinic website or search engine', bad.length === 0, {hosts: [...hosts]});
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
ws.close(); process.exit(res.every(Boolean) ? 0 : 1);
