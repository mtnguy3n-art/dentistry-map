// Developer browser check, clinic website increments 3 to 5 (iteration 2): the website part of the link line at the
// Competition centre and in the Your clinic card, the note sentence, and the small "Website" links in both clinic tables.
// Needs Chrome started with --headless=new --remote-debugging-port=9333. The page is served from site/ through the
// DevTools Fetch domain at http://dm.test/ (no web server needed). Links are never followed: the check only reads them.
// Run: node tests/browser/web-inc345.mjs   (not part of `node --test`, because it needs Chrome)
// Saved clinics have fake names; centres are public OpenStreetMap listings from site/data/dentists.json.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');
const BASE = 'http://dm.test/', CDP = 'http://localhost:9333';
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'};
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(), events = [], errors = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  events.push(j);
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))) errors.push(j);
  if (j.method !== 'Fetch.requestPaused') return;
  const {requestId, request} = j.params, u = new URL(request.url);
  if (u.origin + '/' === BASE) {
    const f = path.join(SITE, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
    if (!f.startsWith(SITE) || !fs.existsSync(f)) { send('Fetch.fulfillRequest', {requestId, responseCode: 404, body: ''}); return; }
    send('Fetch.fulfillRequest', {requestId, responseCode: 200, responseHeaders: [{name: 'Content-Type', value: (TYPES[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8'}],
      body: fs.readFileSync(f).toString('base64')});
  } else send('Fetch.continueRequest', {requestId});
});
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, n = 0;
const check = (name, ok, info) => { n++; if (ok) pass++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(info)}`); };
await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable'); await send('DOM.enable');
await send('Fetch.enable', {patterns: [{urlPattern: '*'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
const until = async (expr, fn, ms = 8000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(expr); if (fn(v)) return v; await wait(100); } return v; };
const go = async (q) => { await send('Page.navigate', {url: 'about:blank'}); await wait(200); await send('Page.navigate', {url: `${BASE}${q}`}); await wait(300); await until(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`, (v) => v === true, 20000); await wait(800); };
const outside = () => events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/dm\.test\/|data:|blob:)/.test(e.params.request.url)).map((e) => e.params.request.url);
/* WCAG contrast ratio of the computed text colour against the nearest non-transparent background */
const contrastOf = (sel) => `(() => { const el = document.querySelector('${sel}');
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  let bg = el; while (bg && (rgb(getComputedStyle(bg).backgroundColor)[3] === 0 || getComputedStyle(bg).backgroundColor === 'transparent')) bg = bg.parentElement;
  const a = lum(rgb(getComputedStyle(el).color)), b = lum(rgb(getComputedStyle(bg || document.body).backgroundColor));
  return {fg: getComputedStyle(el).color, bg: getComputedStyle(bg || document.body).backgroundColor, ratio: Math.round(100 * (Math.max(a, b) + .05) / (Math.min(a, b) + .05)) / 100}; })()`;

await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
const hubOf = (r) => `?hub=${r.lat.toFixed(5)},${r.lon.toFixed(5)}`;
const line = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'); const p = el.querySelector('p.dm-note');
  return {hidden: el.hidden, text: p ? p.textContent : '', links: [...el.querySelectorAll('a')].map((a) => ({text: a.textContent, href: a.href,
    target: a.target, rel: a.rel, ref: a.referrerPolicy, aria: a.getAttribute('aria-label')}))}; })()`;
const settled = (v) => !v.hidden && v.text && !v.text.startsWith('Loading');
const webLinks = (v) => v.links.filter((a) => a.text !== 'View on Google Maps' && !/panoramax/i.test(a.href));
const safeLink = (a) => a.target === '_blank' && a.rel === 'noopener noreferrer' && a.ref === 'no-referrer';
const D = JSON.parse(fs.readFileSync(path.join(SITE, 'data/dentists.json'), 'utf8'));
const find = (name, lat) => D.find((r) => r.name === name && Math.abs(r.lat - lat) < 1e-4);
const WEB = find('Clinique Dentaire Sherbrooke', 45.40933);          // has a website
const NAMED = find('Dr Lac Long Ly', 45.51432);                       // named, no website (Montréal)
const GEN_ADDR = find('Dentist', 45.39928);                           // generic name with an address (27 Rue Elgin)
const GEN_NONE = find('Dentist', 46.75949);                           // generic name, no address
check('setup: the four public listings are in the data', WEB && WEB.web && NAMED && !NAMED.web && GEN_ADDR && GEN_ADDR.address && GEN_NONE && !GEN_NONE.address, '');

// 1. AC-9.1, AC-9.2, AC-13.3, AC-13.4: centre with a website
await go('');
await evalJs('localStorage.clear()');
events.length = 0;
await go(hubOf(WEB) + '#competition');
let v = await until(line('hub-photo'), settled, 15000);
let w = webLinks(v);
check('AC-9.1 "View on Google Maps · Website: cliniquedentairesherbrooke.ca" on one line', v.text.includes('View on Google Maps · Website: cliniquedentairesherbrooke.ca') && w.length === 1, v.text);
check('AC-9.2/AC-13.3 website link: new tab, noopener noreferrer, no-referrer; opens the stored address', w[0] && safeLink(w[0]) && w[0].href === new URL(WEB.web).href, w[0]);
check('AC-9.1 screen reader name "Website: cliniquedentairesherbrooke.ca"', w[0] && w[0].aria === 'Website: cliniquedentairesherbrooke.ca', w[0]);
check('No "Website not listed" when a website is known', !v.text.includes('Website not listed'), v.text);

// 2. AC-14.1: note sentence just before the OpenStreetMap credit, credit kept
const note = await evalJs(`[...document.querySelectorAll('#competition .dm-note, .dm-note')].map((p) => p.textContent).find((t) => t.includes('Website links come')) || ''`);
check('AC-14.1 note: "Website links come from the OpenStreetMap listing and may be missing or out of date. Map data © OpenStreetMap contributors."',
  note.includes('Website links come from the OpenStreetMap listing and may be missing or out of date. Map data © OpenStreetMap contributors.'), note.slice(-160));

// 3. AC-12.1, AC-12.4, AC-12.5: "Competing clinics" table links
await go(hubOf(WEB) + '&rshow=all#competition');
await until(`document.querySelectorAll('tbody[data-draw=rival-table] tr').length`, (n) => n > 0);
const tab = await evalJs(`(() => { const d = dash.data('dentists').data.filter((r) => Math.abs(r.lat - ${WEB.lat}) < .06 && Math.abs(r.lon - ${WEB.lon}) < .09); /* rows are within 6 km */ const out = {rows: 0, links: 0, expect: 0, bad: [], aria: []};
  document.querySelectorAll('tbody[data-draw=rival-table] tr').forEach((tr) => { out.rows++;
    const name = tr.dataset.key, a = tr.querySelector('td:first-child a');
    const known = d.some((r) => r.name === name && dmWeb.safeUrl(r.web));
    if (known) out.expect++;
    if (a) { out.links++; out.aria.push(a.getAttribute('aria-label'));
      if (a.textContent !== 'Website' || a.getAttribute('aria-label') !== 'Website of ' + name || a.target !== '_blank' || a.rel !== 'noopener noreferrer' || a.referrerPolicy !== 'no-referrer' || a.className !== 'dm-tlink') out.bad.push(name);
      if (!known) out.bad.push('link without website: ' + name); }
    if (tr.querySelector('td:first-child').textContent.includes('Website not listed') || tr.querySelector('a[href*="google.com/search"]')) out.bad.push('search in table: ' + name);
  }); return out; })()`);
check('AC-12.1/12.3 a "Website" link exactly on rows whose listing has one; no search or "not listed" text', tab.rows > 3 && tab.links > 0 && tab.links === tab.expect && !tab.bad.length, tab);
check('AC-12.4 table link announced "Website of [clinic name]"', tab.aria.every((x) => /^Website of .+/.test(x)), tab.aria.slice(0, 3));
const before = await evalJs(`({q: location.search, sel: [...document.querySelectorAll('tbody[data-draw=rival-table] select')].map((s) => s.value).join('|'), order: [...document.querySelectorAll('tbody[data-draw=rival-table] tr')].map((t) => t.dataset.key).join('|')})`);
await evalJs(`(() => { const stop = (e) => e.preventDefault(); document.addEventListener('click', stop, {once: true});
  document.querySelector('tbody[data-draw=rival-table] a.dm-tlink').click(); })()`); await wait(600);
const after = await evalJs(`({q: location.search, sel: [...document.querySelectorAll('tbody[data-draw=rival-table] select')].map((s) => s.value).join('|'), order: [...document.querySelectorAll('tbody[data-draw=rival-table] tr')].map((t) => t.dataset.key).join('|')})`);
check('AC-12.5 clicking a table "Website" link keeps the centre, the order and the service choices', JSON.stringify(before) === JSON.stringify(after), {before: before.q, after: after.q});

// 4. AC-10.1, AC-10.2, AC-10.4: named centre without a website
await go(hubOf(NAMED) + '#competition');
v = await until(line('hub-photo'), settled, 15000); w = webLinks(v);
check('AC-10.1 "Website not listed · Search the web" after "View on Google Maps"', v.text.includes('View on Google Maps · Website not listed · Search the web') && w.length === 1 && w[0].text === 'Search the web', v.text);
check('AC-10.2/10.4 search = Google with name + town only, new tab, no referrer', w[0] && w[0].href === 'https://www.google.com/search?q=' + encodeURIComponent('Dr Lac Long Ly Montréal') && safeLink(w[0]), w[0] && w[0].href);
check('2.1.1 screen reader: "Search the web for Dr Lac Long Ly"', w[0] && w[0].aria === 'Search the web for Dr Lac Long Ly', w[0]);
check('AC-9.3 the previous centre\'s website is gone', !v.text.includes('cliniquedentairesherbrooke'), v.text);

// 5. AC-10.3 / WR4: generic names
await go(hubOf(GEN_ADDR) + '#competition');
v = await until(line('hub-photo'), settled, 15000); w = webLinks(v);
check('AC-10.3 generic name with address: search with name + address + town', w[0] && new URL(w[0].href).searchParams.get('q').startsWith('Dentist 27 Rue Elgin ') && v.text.includes('Website not listed · Search the web'), w[0] && w[0].href);
await go(hubOf(GEN_NONE) + '#competition');
v = await until(line('hub-photo'), settled, 15000); w = webLinks(v);
check('AC-10.3 generic name without address: "Website not listed" only, no search link', v.text.endsWith('View on Google Maps · Website not listed') && w.length === 0, v.text);

// 6. AC-9.3 fast switching: three centres in a row, the line always belongs to the last one
await go(hubOf(WEB) + '#competition');
await evalJs(`dash.setParams({hub: '${NAMED.lat.toFixed(5)},${NAMED.lon.toFixed(5)}'}); dash.setParams({hub: '${WEB.lat.toFixed(5)},${WEB.lon.toFixed(5)}'}); dash.setParams({hub: '${NAMED.lat.toFixed(5)},${NAMED.lon.toFixed(5)}'})`);
await wait(500);
v = await evalJs(line('hub-photo'));
const title = await evalJs(`document.querySelector('[data-draw=hub-name]').textContent`);
check('AC-9.3/AC-9.5 fast switching: shown at once, the last centre\'s line only', title === 'Competition around Dr Lac Long Ly' && v.text.includes('Search the web') && !v.text.includes('cliniquedentairesherbrooke'), {title, text: v.text});

// 7. US-11 card and "Use your clinic": fake saved clinic on the listing with a website
const FAKE = {name: 'Fake Test Clinic Alpha', lat: WEB.lat, lon: WEB.lon};
await evalJs(`localStorage.clear(); localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(FAKE)}))`);
await go('#clinic');
v = await until(line('clinic-photo'), settled); w = webLinks(v);
check('AC-11.1 card: "Website: cliniquedentairesherbrooke.ca" next to "View on Google Maps"', v.text.includes('View on Google Maps · Website: cliniquedentairesherbrooke.ca') && w.length === 1 && safeLink(w[0]), v.text);
const rivals = await evalJs(`(() => { const d = dash.data('dentists').data.filter((r) => Math.abs(r.lat - ${WEB.lat}) < .06 && Math.abs(r.lon - ${WEB.lon}) < .09); /* rows are within 6 km */ let rows = 0, links = 0, expect = 0, aria = true;
  document.querySelectorAll('tbody[data-draw=clinic-rivals] tr').forEach((tr) => { rows++; const a = tr.querySelector('a'); const name = tr.dataset.key;
    if (d.some((r) => r.name === name && dmWeb.safeUrl(r.web))) expect++;
    if (a) { links++; aria = aria && a.getAttribute('aria-label') === 'Website of ' + name && a.textContent === 'Website' && a.target === '_blank' && a.rel === 'noopener noreferrer'; } });
  return {rows, links, expect, aria}; })()`);
check('AC-12.2/12.4 "Nearest dental listings": "Website" link on rows with one, "Website of [name]"', rivals.rows > 0 && rivals.links === rivals.expect && rivals.links > 0 && rivals.aria, rivals);
await evalJs(`document.querySelector('#clinic-card .dm-hub-mine').click()`); await wait(800);
v = await until(line('hub-photo'), settled);
check('AC-11.3 "Use your clinic" centre: her listing\'s website, as in the card', v.text.includes('Website: cliniquedentairesherbrooke.ca') && !v.text.includes('Search the web'), v.text);

// 8. AC-11.2 / AC-11.3 / W11: saved clinic 55 m from a listing without website, on no listing itself
const NEAR = {name: 'Fake Test Clinic Beta', lat: +(NAMED.lat + 0.0005).toFixed(5), lon: NAMED.lon};
await evalJs(`localStorage.clear(); localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(NEAR)}))`);
await go('#clinic');
v = await until(line('clinic-photo'), settled);
check('AC-11.2 card with no listing within 30 m: no website, no "Website not listed", no search', v.text.endsWith('View on Google Maps') && webLinks(v).length === 0, v.text);
await go(hubOf(NAMED) + '#competition');
v = await until(line('hub-photo'), settled, 15000);
check('AC-11.3/W11 centre 55 m from the saved clinic, no website: nothing appended (no search)', v.text.endsWith('View on Google Maps') && webLinks(v).length === 0, v.text);
const rowNear = await evalJs(`[...document.querySelectorAll('tbody[data-draw=rival-table] a')].filter((a) => a.href.includes('google.com/search')).length`);
check('AC-12.6 no search link in tables near her clinic', rowNear === 0, rowNear);

// 9. AC-11.4: "Change" to the listing with a website, then "Remove"
await go('#clinic');
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(300);
await evalJs(`(() => { const f = document.querySelector('.dm-clinic-form'); f.elements.spot.value = '${WEB.lat}, ${WEB.lon}'; f.requestSubmit(); })()`); await wait(800);
v = await until(line('clinic-photo'), settled);
check('AC-11.4 "Change": the line follows the new location', v.text.includes('Website: cliniquedentairesherbrooke.ca'), v.text);
await evalJs(`document.querySelector('.dm-clinic-remove').click()`); await wait(800);
v = await evalJs(line('clinic-photo'));
check('AC-11.4 "Remove": the block and its website line disappear', v.hidden && webLinks(v).length === 0, v);
await evalJs('localStorage.clear()');

// 10. AC-9.4: no clinic chosen, no line
await go('#competition');
v = await evalJs(line('hub-photo'));
const body = await evalJs(`document.querySelector('[data-draw=hub-photo]').closest('section, .dm-panel, main').textContent`);
check('AC-9.4 no centre: no website line, no "Website not listed", no search link', v.hidden && !/Website not listed|Search the web/.test(body), v);

// 11. AC-14.4: light and dark at 375 px, readable links, no horizontal scroll
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  for (const r of [WEB, NAMED]) {
    await go(hubOf(r) + '&rshow=all#competition');
    await until(line('hub-photo'), settled, 15000);
    const m = await evalJs(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})`);
    check(`AC-14.4 ${theme} 375 px, ${r.name}: no horizontal scroll`, m.sw <= m.cw, m);
    const sel = r === WEB ? '[data-draw=hub-photo] a[aria-label^="Website:"]' : '[data-draw=hub-photo] a[aria-label^="Search the web"]';
    const c = await evalJs(contrastOf(sel));
    check(`AC-14.4 ${theme}: centre link readable (contrast at least 4.5)`, c.ratio >= 4.5, c);
    if (r === WEB) { const t = await evalJs(contrastOf('tbody[data-draw=rival-table] a.dm-tlink')); check(`AC-14.4 ${theme}: table link readable (contrast at least 4.5)`, t.ratio >= 4.5, t); }
  }
}
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// 12. AC-14.6 / WR7: no request to any clinic website or to Google, ever, without a click
const hosts = [...new Set(outside().map((u) => new URL(u).host))];
check('AC-14.6 only the existing Panoramax photo lookup went outside; no clinic site, no Google', hosts.every((h) => h === 'api.panoramax.xyz' || /panoramax/.test(h)), hosts);
check('No console errors or warnings from page code during the whole check', errors.length === 0, errors.slice(0, 3).map((e) => JSON.stringify(e.params).slice(0, 200)));
await evalJs('localStorage.clear()');
console.log(`\n${pass}/${n} passed`);
ws.close();
if (pass !== n) process.exitCode = 1;
