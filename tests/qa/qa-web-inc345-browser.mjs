// QA browser check, clinic website increments 3 to 5 (iteration 2): link line at the Competition centre and in the
// Your clinic card, note sentence, table links, QA-W5 in the page, safety of the links, no outside requests.
// Independent of the developer's tests/browser/web-inc345.mjs.
// Needs: python3 -m http.server 8123 --directory site;
//        python3 -m http.server 8124 --directory <dir with probe.html> (see PROBE below; created by this script);
//        Chrome --headless=new --remote-debugging-port=9333 (fresh profile, or the page may come from the HTTP cache).
// Run: node tests/qa/qa-web-inc345-browser.mjs
// Data: public OpenStreetMap listings from site/data/dentists.json, plus FAKE listings (fictive names and sites) added
// to the data file in the browser only (DevTools Fetch), placed in the forest north of Chibougamau, far from any real
// listing. One fake saved clinic, cleared at the end. No patient data.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8123/', CDP = 'http://localhost:9333';
const PROBE = process.env.PROBE || 'http://127.0.0.1:8124/probe.html'; /* a plain IPv4 host passes WR1b */
const PROBE_DIR = process.env.PROBE_DIR;
if (PROBE_DIR) fs.writeFileSync(path.join(PROBE_DIR, 'probe.html'), '<!doctype html><title>probe</title><script>document.title = JSON.stringify({opener: window.opener === null ? "null" : "set", referrer: document.referrer});</script>');

const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); const reqs = []; const errs = [];
let holdPhotos = 0; /* ms to hold Panoramax requests (AC-9.5) */
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });

/* fake listings (fictive names, fictive sites) */
const C = {city_id: '2499025', market_id: '2499'}; /* Chibougamau, Nord-du-Québec */
const LAT = 50.3, LON = -74.8, step = 0.0045; /* about 500 m */
const LONG_HOST = ['a'.repeat(63), 'b'.repeat(63), 'c'.repeat(63), 'fictive', 'ca'].join('.');
const at = (i, dLat = 0) => ({lat: +(LAT + i * step + dLat).toFixed(5), lon: LON});
const FAKES = [
  {key: 'xss', name: '<img src=x onerror="window.__xss=1">QA Fake XSS Clinic', address: '', web: 'https://fictive-xss.ca/"><img/src=x/onerror=window.__xss=2>', ...at(0)},
  {key: 'long', name: 'QA Fake Long Host Clinic', address: '', web: `https://${LONG_HOST}/${'p'.repeat(250)}` /* 461 chars, under the 500 limit */, ...at(1)},
  {key: 'probe', name: 'QA Fake Opener Clinic', address: '', web: PROBE, ...at(2)},
  {key: 'js', name: 'QA Fake Js Clinic', address: '', web: 'javascript:alert(1)', ...at(3)},
  {key: 'plural', name: 'Cliniques dentaires', address: '1 Rue Fictive', ...at(4)},
  {key: 'family', name: 'Family Dental Care', address: '', ...at(5)},
  {key: 'surr', name: 'QA Fake Clinic \ud800 Surrogate', address: '', ...at(6)},
  {key: 'fb', name: 'QA Fake Facebook Clinic', address: '', web: 'https://m.facebook.com/qafakeclinic', ...at(7)},
  {key: 'user', name: 'QA Fake Userinfo Clinic', address: '', web: 'https://fictive.ca@evil.example', ...at(8)},
  /* around Thu's fake saved clinic (= fb listing): 20 m, 60 m with a site, 60 m without */
  {key: 'n20', name: 'QA Fake Neighbour 20m', address: '', web: 'https://voisin20fictive.ca', ...at(7, 0.00018)},
  {key: 'n60web', name: 'QA Fake Neighbour 60m Site', address: '', web: 'https://voisin60fictive.ca', lat: at(7).lat, lon: +(LON + 0.00085).toFixed(5)},
  {key: 'n60', name: 'QA Fake Neighbour 60m', address: '9 Rue Fictive', lat: +(at(7).lat - 0.00054).toFixed(5), lon: LON},
].map((f) => ({...C, ...f}));
const F = Object.fromEntries(FAKES.map((f) => [f.key, f]));

ws.addEventListener('message', async (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  if (j.method === 'Network.requestWillBeSent') reqs.push(j.params.request.url);
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))
    || (j.method === 'Log.entryAdded' && j.params.entry.level === 'error' && !/favicon\.ico/.test(j.params.entry.url || ''))) errs.push(JSON.stringify(j.params).slice(0, 300));
  if (j.method !== 'Fetch.requestPaused') return;
  const {requestId, request, responseStatusCode} = j.params;
  if (/dentists\.json/.test(request.url) && responseStatusCode) {
    const b = await send('Fetch.getResponseBody', {requestId});
    const raw = b.result.base64Encoded ? Buffer.from(b.result.body, 'base64').toString('utf8') : b.result.body;
    const data = JSON.parse(raw).concat(FAKES.map(({key, ...f}) => f));
    send('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: 'application/json; charset=utf-8'}], body: Buffer.from(JSON.stringify(data)).toString('base64')});
  } else if (/panoramax/.test(request.url) && holdPhotos) setTimeout(() => send('Fetch.continueRequest', {requestId}), holdPhotos);
  else send('Fetch.continueRequest', {requestId});
});
const ev = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (e, fn = Boolean, ms = 20000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await ev(e).catch(() => undefined); if (fn(v)) return v; await wait(150); } return v; };
const res = []; const check = (n, ok, info) => { res.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Fetch.enable', {patterns: [{urlPattern: '*dentists.json*', requestStage: 'Response'}, {urlPattern: '*panoramax*', requestStage: 'Request'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});

const ready = `!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`;
const go = async (q) => { await send('Page.navigate', {url: 'about:blank'}); await wait(150); await send('Page.navigate', {url: BASE + q}); await until(ready); await wait(600); };
const setSaved = async (c) => { await go(''); await ev(`localStorage.clear(); ${c ? `localStorage.setItem('dm-clinic', ${JSON.stringify(JSON.stringify(c))});` : ''} true`); };
const hubQ = (r) => `?hub=${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
const line = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'); const p = el.querySelector('p.dm-note');
  return {hidden: el.hidden, text: p ? p.textContent : '', all: el.textContent, html: el.innerHTML, imgs: el.querySelectorAll('img:not(.dm-photo-img)').length,
    links: [...el.querySelectorAll('a')].map((a) => ({text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, ref: a.referrerPolicy, aria: a.getAttribute('aria-label')}))}; })()`;
const settled = (v) => v && !v.hidden && v.text && !v.text.startsWith('Loading');
const web = (v) => v.links.filter((a) => a.text !== 'View on Google Maps' && !/panoramax/i.test(a.href || ''));
const safe = (a) => a && a.target === '_blank' && a.rel === 'noopener noreferrer' && a.ref === 'no-referrer';
const title = () => ev(`document.querySelector('[data-draw=hub-name]').textContent`);
const centre = async (r) => { await go(hubQ(r) + '#competition'); return until(line('hub-photo'), settled, 15000); };
const tail = (t) => t.slice(t.indexOf('View on Google Maps'));

// 1. Examples from the task, exact text (US-9, US-10)
await setSaved(null);
let v = await centre({lat: 45.40933, lon: -71.85909});
check('AC-9.1 example ?hub=45.40933,-71.85909: "View on Google Maps · Website: cliniquedentairesherbrooke.ca" ends the line', tail(v.text) === 'View on Google Maps · Website: cliniquedentairesherbrooke.ca', v.text);
let w = web(v);
check('AC-9.2 / AC-13.3 website link: new tab, noopener noreferrer, referrerpolicy no-referrer; one link only', w.length === 1 && safe(w[0]) && w[0].text === 'Website: cliniquedentairesherbrooke.ca', w);
check('AC-13.4 link opens the same host it shows', w[0] && new URL(w[0].href).host.replace(/^www\./, '') === 'cliniquedentairesherbrooke.ca', w[0] && w[0].href);
check('AC-9.5 photo part unchanged in front of the link ("Photo not available" or a credit, then Google Maps link)', /^(Photo not available|Photo: .+The photo shows the location, not necessarily the clinic's current sign\.) · View on Google Maps/.test(v.text), v.text);
v = await centre({lat: 45.51432, lon: -73.56878});
w = web(v);
check('AC-10.1 example ?hub=45.51432,-73.56878: "View on Google Maps · Website not listed · Search the web"', tail(v.text) === 'View on Google Maps · Website not listed · Search the web' && w.length === 1 && w[0].text === 'Search the web', v.text);
check('AC-10.2 / AC-10.4 search link = Google, only q = name + town', w[0] && w[0].href === 'https://www.google.com/search?q=' + encodeURIComponent('Dr Lac Long Ly Montréal') && [...new URL(w[0].href).searchParams.keys()].join() === 'q' && safe(w[0]), w[0]);
check('2.1.1 screen reader "Search the web for Dr Lac Long Ly"', w[0] && w[0].aria === 'Search the web for Dr Lac Long Ly', w[0]);
check('AC-10.4 search link holds nothing of the page (no hub, rad, localhost)', w[0] && !/hub|rad=|localhost|competition/.test(decodeURIComponent(w[0].href)), w[0] && w[0].href);

// 2. AC-14.1 note sentence just before the credit
const note = await ev(`[...document.querySelectorAll('#competition .dm-note')].map((p) => p.textContent).find((t) => t.includes('Map data ©')) || ''`);
check('AC-14.1 "... Website links come from the OpenStreetMap listing and may be missing or out of date. Map data © OpenStreetMap contributors." (end of note)',
  note.endsWith('the same size for every clinic. Website links come from the OpenStreetMap listing and may be missing or out of date. Map data © OpenStreetMap contributors.'), note.slice(-200));

// 3. Fake listings: rules on screen
const fake = async (k) => { v = await centre(F[k]); return v; };
await fake('js'); w = web(v);
check('AC-13.1 "javascript:" website: treated as none -> "Website not listed · Search the web", no javascript: anywhere', tail(v.text) === 'View on Google Maps · Website not listed · Search the web' && !/javascript:/i.test(v.html), v.text);
check('WR4 search text for a named fake: name + town', w[0] && new URL(w[0].href).searchParams.get('q') === 'QA Fake Js Clinic Chibougamau', w[0] && w[0].href);
await fake('user'); w = web(v);
check('AC-13.4 user-part website refused -> search, never evil.example', tail(v.text).endsWith('Search the web') && !/evil\.example/.test(v.html), v.text);
await fake('plural'); w = web(v);
check('WR4 extended: "Cliniques dentaires" is generic -> searched with address', w[0] && new URL(w[0].href).searchParams.get('q') === 'Cliniques dentaires 1 Rue Fictive Chibougamau', w[0] && w[0].href);
await fake('family');
check('WR4 extended: "Family Dental Care" without address -> "Website not listed", no link', tail(v.text) === 'View on Google Maps · Website not listed' && web(v).length === 0, v.text);
await fake('surr'); w = web(v);
check('QA-W4 in page: lone surrogate in the name -> line drawn, search link built', w[0] && new URL(w[0].href).searchParams.get('q') === 'QA Fake Clinic  Surrogate Chibougamau'.replace('  ', ' ') && errs.every((e) => !/URIError/.test(e)), w[0] && w[0].href);
await fake('fb');
check('AC-13.5 social page: "Website: m.facebook.com"', tail(v.text) === 'View on Google Maps · Website: m.facebook.com', v.text);
await fake('xss'); w = web(v);
check('Security: name and website with HTML are shown as text only (no extra element, no script run)', v.imgs === 0 && (await ev('window.__xss === undefined')) && w.length === 1 && w[0].text === 'Website: fictive-xss.ca', {imgs: v.imgs, w});
const xssT = await ev(`[...document.querySelectorAll('tbody[data-draw=rival-table] img, [data-draw=hub-name] img')].length`);
check('Security: no <img> injected in title or tables', xssT === 0, xssT);

// 4. AC-14.4 long host at 375 px, light and dark
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await fake('long');
  const m = await ev(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pw: document.querySelector('[data-draw=hub-photo]').scrollWidth, pcw: document.querySelector('[data-draw=hub-photo]').clientWidth})`);
  check(`AC-14.4 ${theme} 375 px, 200-char host: shown as host only, no horizontal scroll`, v.text.includes(`Website: ${LONG_HOST}`) && !v.text.includes('pppp') && m.sw <= m.cw && m.pw <= m.pcw, m);
  const tl = await ev(`(() => { const a = document.querySelector('tbody[data-draw=rival-table] a.dm-tlink'); if (!a) return null; const cs = getComputedStyle(a); let n = a, bg; do { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; } while (n && /rgba\\(0, 0, 0, 0\\)/.test(bg)); return {color: cs.color, bg}; })()`);
  const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map(Number).map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  const ratio = tl ? (Math.max(lum(tl.color), lum(tl.bg)) + .05) / (Math.min(lum(tl.color), lum(tl.bg)) + .05) : 0;
  check(`AC-14.4 ${theme}: table "Website" link readable (contrast ${ratio.toFixed(2)} >= 4.5)`, ratio >= 4.5, tl);
}
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// 5. US-12 tables around the fakes (centre = xss fake, radius 3 km -> rows within 6 km = all other fakes)
await go(hubQ(F.xss) + '&rshow=all#competition');
await until(`document.querySelectorAll('tbody[data-draw=rival-table] tr').length > 5`);
const rows = await ev(`[...document.querySelectorAll('tbody[data-draw=rival-table] tr')].map((tr) => { const td = tr.querySelector('td'); const as = [...td.querySelectorAll('a')];
  return {key: tr.dataset.key, text: td.textContent, links: as.map((a) => ({text: a.textContent, href: a.getAttribute('href'), aria: a.getAttribute('aria-label'), target: a.target, rel: a.rel, ref: a.referrerPolicy, cls: a.className}))}; })`);
const expectLink = {xss: F.xss.web, long: F.long.web, probe: PROBE, fb: 'https://m.facebook.com/qafakeclinic', n20: 'https://voisin20fictive.ca/', n60web: 'https://voisin60fictive.ca/'};
const tb = FAKES.filter((f) => f.key !== 'xss').map((f) => {
  const r = rows.find((x) => x.key === f.name);
  if (!r) return {k: f.key, missing: true};
  const want = expectLink[f.key];
  const ok = want ? r.links.length === 1 && new URL(r.links[0].href).href === new URL(want).href && r.links[0].text === 'Website' && r.links[0].aria === `Website of ${f.name}` && safe(r.links[0]) && r.links[0].cls === 'dm-tlink'
    : r.links.length === 0 && !/Website not listed|Search/.test(r.text);
  return {k: f.key, ok, r};
});
check('AC-12.1 / 12.3 / 12.4 / 13.1 Competing clinics: "Website" (aria "Website of [name]") only for valid addresses; none for javascript:, user part, no website', tb.every((x) => x.ok), tb.filter((x) => !x.ok));
check('AC-12.3 no search link and no "Website not listed" anywhere in the table', rows.every((r) => !/Website not listed|Search the web/.test(r.text) && r.links.every((a) => !/google\./.test(a.href))), '');

// 6. AC-12.5: clicking a table link changes nothing on the dashboard; the opened tab has no opener and no referrer
const state = () => ev(`({q: location.search + location.hash, order: [...document.querySelectorAll('tbody[data-draw=rival-table] tr')].map((t) => t.dataset.key).join('|'), sel: [...document.querySelectorAll('tbody[data-draw=rival-table] select')].map((s) => s.value).join('|')})`);
const s0 = await state();
const pt = await ev(`(() => { const a = [...document.querySelectorAll('tbody[data-draw=rival-table] a.dm-tlink')].find((x) => x.getAttribute('href') === ${JSON.stringify(PROBE)}); if (!a) return null; a.scrollIntoView({block: 'center'}); const r = a.getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; })()`);
const before = new Set((await (await fetch(`${CDP}/json/list`)).json()).map((t) => t.id));
if (pt) for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', {type, x: pt.x, y: pt.y, button: 'left', clickCount: 1});
await wait(2500);
const s1 = await state();
check('AC-12.5 table "Website" click: same address, order and service choices', pt && JSON.stringify(s0) === JSON.stringify(s1), {s0, s1});
const popup = (await (await fetch(`${CDP}/json/list`)).json()).find((t) => !before.has(t.id) && t.url.startsWith(PROBE));
let pop = null;
if (popup) {
  const pws = new WebSocket(popup.webSocketDebuggerUrl); await new Promise((r) => pws.addEventListener('open', r, {once: true}));
  pop = await new Promise((r) => { pws.addEventListener('message', (m) => r(JSON.parse(m.data))); pws.send(JSON.stringify({id: 1, method: 'Runtime.evaluate', params: {expression: 'document.title', returnByValue: true}})); });
  pop = pop.result && pop.result.result.value; pws.close(); await fetch(`${CDP}/json/close/${popup.id}`);
}
check('AC-9.2 / AC-13.3 link opens in a new tab; window.opener is null and document.referrer is empty there', popup && pop === JSON.stringify({opener: 'null', referrer: ''}), {popup: popup && popup.url, pop, note: PROBE_DIR ? '' : 'PROBE_DIR not set: probe page missing'});

// 7. AC-9.5: website line shown at once while the photo is still loading (Panoramax held 4 s)
holdPhotos = 4000;
await go(hubQ({lat: 45.40933, lon: -71.85909}) + '#competition');
v = await ev(line('hub-photo'));
check('AC-9.5 website shown during "Loading photo..." (does not wait for the photo)', v.text === 'Loading photo... · View on Google Maps · Website: cliniquedentairesherbrooke.ca', v.text);
await wait(4500); holdPhotos = 0;

// 8. US-11 / WR6 / QA-W5 in the page: fake saved clinic on the fb fake listing
const SAVED = {name: 'QA Fake Saved Clinic', lat: F.fb.lat, lon: F.fb.lon};
await setSaved(SAVED);
await go('#clinic');
v = await until(line('clinic-photo'), settled);
check('AC-11.1 card: "View on Google Maps · Website: m.facebook.com" (her listing\'s website), safe link', v.text.startsWith('Photo not available · View on Google Maps · Website: m.facebook.com') && safe(web(v)[0]), v.text);
const near = await ev(`[...document.querySelectorAll('tbody[data-draw=clinic-rivals] tr')].map((tr) => ({key: tr.dataset.key, links: [...tr.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('aria-label'), a.target, a.rel, a.referrerPolicy])}))`);
const nOk = near.filter((r) => r.key.startsWith('QA Fake') || r.key === 'Cliniques dentaires' || r.key === 'Family Dental Care').every((r) => {
  const f = FAKES.find((x) => x.name === r.key); const want = f && expectLink[f.key];
  return want ? r.links.length === 1 && r.links[0][0] === 'Website' && r.links[0][1] === `Website of ${f.name}` && r.links[0][2] === '_blank' && r.links[0][3] === 'noopener noreferrer' && r.links[0][4] === 'no-referrer' : r.links.length === 0;
});
check('AC-12.2 / AC-12.6 "Nearest dental listings": link only where valid, none (no search) on the others, incl. her own and the 60 m neighbour', near.length > 3 && nOk, near.slice(0, 6));
await ev(`document.querySelector('#clinic-card .dm-hub-mine').click()`); await wait(800);
v = await until(line('hub-photo'), settled);
check('AC-11.3 "Use your clinic" centre: "Website: m.facebook.com", no search', tail(v.text) === 'View on Google Maps · Website: m.facebook.com', v.text);
v = await centre(F.n60web);
check('QA-W5 / AC-9.3 neighbour 60 m with its own site: its own website, never hers', (await title()) === `Competition around ${F.n60web.name}` && tail(v.text) === 'View on Google Maps · Website: voisin60fictive.ca', v.text);
v = await centre(F.n60);
check('W11 / AC-11.3 neighbour 60 m without website: nothing appended (no search, no "Website not listed", not her site)', (await title()) === `Competition around ${F.n60.name}` && tail(v.text) === 'View on Google Maps', v.text);
v = await centre(F.n20);
const t20 = await title();
check('Neighbour 20 m: the page treats the centre as her clinic (iteration 1 30 m rule): her name with her website, consistent', t20 === `Competition around ${SAVED.name}` && tail(v.text) === 'View on Google Maps · Website: m.facebook.com', {t20, text: v.text});
v = await centre(F.probe);
check('Fake 1 km away from her clinic: normal rule (own website)', tail(v.text) === `View on Google Maps · Website: 127.0.0.1`, v.text);

// 9. Real data: saved clinic on a real listing, centre = real neighbours at 66 m and 79 m
const DD = JSON.parse(fs.readFileSync(path.join(HERE, '../../site/data/dentists.json'), 'utf8'));
const find = (n, lat) => DD.find((r) => r.name === n && Math.abs(r.lat - lat) < 1e-4);
const papineau = find('Clinique dentaire Métro Papineau', 45.5237), n1935 = find('1935 Clinique Dentaire', 45.52429);
const loft = find('Le Loft Dentaire', 46.79584), holland = find('Clinique Dentaire Samuel Holland', 46.79569);
await setSaved({name: 'QA Fake Saved Clinic', lat: papineau.lat, lon: papineau.lon});
v = await centre(n1935);
check('Real pair: saved on "Métro Papineau" (has a site), centre "1935 Clinique Dentaire" 66 m, no site -> nothing appended', tail(v.text) === 'View on Google Maps' && !/cliniquemetropapineau/.test(v.html), v.text);
await setSaved({name: 'QA Fake Saved Clinic', lat: loft.lat, lon: loft.lon});
v = await centre(holland);
check('Real pair: saved on "Le Loft Dentaire", centre "Samuel Holland" 79 m -> its own site only', tail(v.text) === 'View on Google Maps · Website: cliniquesamuelholland.com' && !/leloft/.test(v.html), v.text);

// 10. W11 property on real data: every listing within 100 m of the saved clinic, as centre, never gets a search
const km = (a, b) => { const R = 6371, t = Math.PI / 180, x = (b.lat - a.lat) * t, y = (b.lon - a.lon) * t; return 2 * R * Math.asin(Math.sqrt(Math.sin(x / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(y / 2) ** 2)); };
const hubs = [papineau, find('Centre de Santé Dentaire Saint-Denis', 45.52542), find('Centre dentaire 1450', 45.53107)].filter(Boolean);
const bad = []; let tried = 0;
for (const h of hubs) {
  await setSaved({name: 'QA Fake Saved Clinic', lat: h.lat, lon: h.lon});
  await go('#competition');
  for (const r of DD.filter((x) => km(h, x) < 0.1)) {
    tried++;
    await ev(`dash.setParams({hub: '${r.lat.toFixed(5)},${r.lon.toFixed(5)}'})`); await wait(250);
    const x = await ev(line('hub-photo'));
    if (/Website not listed|Search the web|google\.com\/search/.test(x.all + JSON.stringify(x.links))) bad.push({r: r.name, text: x.text});
  }
}
check(`W11 / AC-11.3: ${tried} real centres within 100 m of a saved clinic -> 0 search links, 0 "Website not listed"`, tried > 3 && bad.length === 0, bad.slice(0, 3));

// 11. W11 guard of an earlier location in the same visit: save at fb fake, change to far away, then centre n60
await setSaved(SAVED);
await go('#clinic');
await ev(`document.querySelector('.dm-clinic-edit').click()`); await wait(300);
await ev(`(() => { const f = document.querySelector('.dm-clinic-form'); f.elements.spot.value = '45.40933, -71.85909'; f.requestSubmit(); })()`); await wait(800);
await ev(`dash.setParams({hub: '${F.n60.lat.toFixed(5)},${F.n60.lon.toFixed(5)}'})`); await wait(800);
v = await ev(line('hub-photo'));
check('W11: 60 m from a location saved earlier this visit -> still no search', !v.hidden && tail(v.text) === 'View on Google Maps', v.text);
await ev(`document.querySelector('.dm-clinic-remove').click()`); await wait(500);
v = await ev(line('clinic-photo'));
check('AC-11.4 "Remove": card line gone', v.hidden && v.links.length === 0, v.hidden);

// 12. AC-9.4 no centre: nothing
await setSaved(null);
await go('#competition');
v = await ev(line('hub-photo'));
const body = await ev(`document.querySelector('#competition').textContent`);
check('AC-9.4 no centre: no line, no "Website not listed", no search link', v.hidden && !/Website not listed|Search the web/.test(body), v.hidden);

// 13. AC-14.6 / WR7 / W8: outside requests made by the page itself during the whole run
const hosts = [...new Set(reqs.map((u) => { try { return new URL(u).host; } catch { return u.slice(0, 20); } }))].filter((h) => h && !/^localhost:8123$/.test(h) && !/^(data|blob|about)/.test(h));
check('AC-14.6 page contacted only api.panoramax.xyz on its own (127.0.0.1:8124 only from the click in step 6)', hosts.every((h) => h === 'api.panoramax.xyz'), hosts);
const pre = await ev(`document.querySelectorAll('link[rel~=prefetch], link[rel~=preconnect], link[rel~=dns-prefetch], link[rel~=prerender], script[type=speculationrules]').length`);
check('WR7 no prefetch / preconnect / speculation rules on the page', pre === 0, pre);
check('No console errors or warnings during the run', errs.length === 0, errs.slice(0, 3));
await ev('localStorage.clear()');
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
ws.close(); await fetch(`${CDP}/json/close/${tgt.id}`);
if (res.some((x) => !x)) process.exitCode = 1;
