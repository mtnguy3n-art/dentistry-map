// QA browser check, clinic website increment 2: web.js is loaded (global dmWeb) but nothing visible changes.
// Updated for iteration 2, increments 3 to 5: PREV is the increment 2 build (2bafc2d) and the new website parts are
// removed from this build's text and links before comparing.
// Compares the page of this build (BASE) with the page of the previous increment (PREV, commit cdb563e served
// separately) on the same addresses: same visible text, same links, same outside hosts, no console error.
// Needs: python3 -m http.server 8123 --directory site; the previous site served on PREV
// (git archive cdb563e site | tar -x -C <dir>; python3 -m http.server 8131 --directory <dir>/site);
// Chrome --headless=new --remote-debugging-port=9333. Run: node tests/qa/qa-web-inc2-browser.mjs
// If site/content/local.json (private, git-ignored) exists, copy it into the previous site too, or the "open dental
// listings" counts differ by the closed practices it lists.
// Public OpenStreetMap listings only; one fake saved clinic, cleared at the end.
const BASE = process.env.BASE || 'http://localhost:8123/', PREV = process.env.PREV || 'http://localhost:8131/', CDP = 'http://localhost:9333';
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); let errs = [], hosts = new Set();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  if (j.method === 'Network.requestWillBeSent') { try { hosts.add(new URL(j.params.request.url).host); } catch {} }
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))
    || (j.method === 'Log.entryAdded' && j.params.entry.level === 'error' && !/favicon\.ico/.test(j.params.entry.url || ''))) errs.push(JSON.stringify(j.params).slice(0, 300));
});
const ev = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (e, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(e).catch(() => false)) return true; await wait(150); } return false; };
const res = []; const check = (n, ok, info) => { res.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});

const FAKE = JSON.stringify({name: 'QA Fake Clinic', lat: 45.55648, lon: -73.56143});
const snap = async (base, q, theme, mine) => {
  errs = []; hosts = new Set();
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Page.navigate', {url: base});
  await until(`document.readyState === 'complete'`);
  await ev(`localStorage.clear(); ${mine ? `localStorage.setItem('dm-clinic', ${JSON.stringify(FAKE)});` : ''} true`);
  await send('Page.navigate', {url: base + q});
  const ok = await until(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`);
  await wait(4000); /* photo lookup settles */
  const v = await ev(`({
    text: document.body.innerText.replace(/Version[^\\n]*/g, ''),
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href') + '|' + a.textContent.trim()).sort(),
    web: typeof window.dmWeb, webKeys: window.dmWeb ? Object.keys(dmWeb).sort().join(',') : '',
    scroll: document.documentElement.scrollWidth > document.documentElement.clientWidth })`);
  return {ok, ...v, errs: [...errs], hosts: [...hosts].sort()};
};

await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
const strip = (t) => t.replace(/ · (Website: [^\s·]+|Website not listed( · Search the web)?)/g, '')
  .replace('Website links come from the OpenStreetMap listing and may be missing or out of date. ', '').replace(/ Website(?=\t|\n)/g, '');
const newLink = (l) => /\|(Website|Website: .+|Search the web)$/.test(l);
const cases = [
  ['default light', '', 'light', false],
  ['competition Rosemont (listing with website) light', '?hub=45.55648,-73.56143#competition', 'light', false],
  ['competition Rosemont dark', '?hub=45.55648,-73.56143#competition', 'dark', false],
  ['competition generic "Dentist" listing', '?hub=46.75949,-70.95007#competition', 'light', false],
  ['fake saved clinic, competition at it', '?hub=45.55648,-73.56143#competition', 'light', true],
  ['fake saved clinic, markets tab with card', '#markets', 'dark', true],
];
for (const [label, q, theme, mine] of cases) {
  const a = await snap(BASE, q, theme, mine), b = await snap(PREV, q, theme, mine);
  check(`${label}: data loaded (new and previous)`, a.ok && b.ok);
  check(`${label}: dmWeb global present with the 8 rules + NOT_LISTED`, a.web === 'object' && a.webKeys === 'NOT_LISTED,cardLink,isGeneric,linkFor,ownListing,safeUrl,searchText,searchUrl,siteName', a.webKeys);
  /* updated for iteration 2, increments 3 to 5: PREV is now the increment 2 build (2bafc2d). The only allowed differences
     are the website parts of the link lines, the note sentence and the "Website" table links; all else must be identical */
  const aT = strip(a.text), aL = a.links.filter((l) => !newLink(l));
  check(`${label}: visible text identical to the previous increment, apart from the new website parts`, aT === b.text, aT === b.text ? undefined : (() => { let i = 0; while (aT[i] === b.text[i]) i++; return {at: i, now: aT.slice(i - 60, i + 80), prev: b.text.slice(i - 60, i + 80)}; })());
  check(`${label}: links identical to the previous increment, apart from the new website and search links`, JSON.stringify(aL) === JSON.stringify(b.links), {added: aL.filter((x) => !b.links.includes(x)), gone: b.links.filter((x) => !aL.includes(x))});
  check(`${label}: previous build shows no website text (sanity)`, !/Website not listed|Search the web|Website:/.test(b.text));
  check(`${label}: no Google search link in the default page or near the fake saved clinic`, (label.startsWith('competition') && !mine) || !a.links.some((l) => l.includes('google.com/search')));
  check(`${label}: outside hosts identical to previous (no new outside request)`, JSON.stringify(a.hosts.map((h) => h.replace(/:8123$/, ':X'))) === JSON.stringify(b.hosts.map((h) => h.replace(/:8131$/, ':X'))), {now: a.hosts, prev: b.hosts});
  check(`${label}: no console error`, a.errs.length === 0, a.errs);
  check(`${label}: no horizontal scroll at 375 px`, !a.scroll);
}
await ev(`localStorage.clear(); true`);
await send('Emulation.clearDeviceMetricsOverride');
const n = res.filter(Boolean).length;
console.log(`\n${n} / ${res.length} pass`);
ws.close();
await fetch(`${CDP}/json/close/${tgt.id}`);
process.exit(n === res.length ? 0 : 1);
