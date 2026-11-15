// Developer browser check, clinic photo increment 6: final regression, screen-reader labels, QA notes N-12 and N-15.
// Needs Chrome started with --headless=new --remote-debugging-port=9333. No local web server is needed: the page is
// served from site/ through the DevTools Fetch domain at http://dm.test/. One check (the street photo's alt text) uses
// the live Panoramax service.
// Run: node tests/browser/photo-inc6.mjs   (not part of `node --test`, because it needs Chrome)
// Fake clinic names only; coordinates are made up (46.0, -71.0) or public OpenStreetMap listings in Sherbrooke.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');
const BASE = 'http://dm.test/', CDP = 'http://localhost:9333';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-inc6-'));
process.on('exit', () => fs.rmSync(TMP, {recursive: true, force: true})); /* fake files are removed even if a step fails */
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
const pick = async (file) => {
  const doc = await send('DOM.getDocument', {depth: -1});
  const q = await send('DOM.querySelector', {nodeId: doc.result.root.nodeId, selector: '.dm-own-file'});
  await send('DOM.setFileInputFiles', {nodeId: q.result.nodeId, files: [file]});
};
const blockOf = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'); const img = el.querySelector('img');
  return {hidden: el.hidden, text: el.textContent, img: img && {alt: img.alt, hidden: img.hidden, w: img.naturalWidth}}; })()`;
/* WCAG contrast ratio of the computed text colour against the nearest non-transparent background */
const contrastOf = (sel) => `(() => { const el = document.querySelector('${sel}');
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  let bg = el; while (bg && (rgb(getComputedStyle(bg).backgroundColor)[3] === 0 || getComputedStyle(bg).backgroundColor === 'transparent')) bg = bg.parentElement;
  const a = lum(rgb(getComputedStyle(el).color)), b = lum(rgb(getComputedStyle(bg || document.body).backgroundColor));
  return {fg: getComputedStyle(el).color, bg: getComputedStyle(bg || document.body).backgroundColor, ratio: Math.round(100 * (Math.max(a, b) + .05) / (Math.min(a, b) + .05)) / 100}; })()`;

// 1. QA N-15: a clinic saved with whole-number coordinates can be renamed only, and keeps its own photo
const WHOLE = {name: 'Fake Whole Number Clinic', lat: 46, lon: -71};
await go('');
const tinyJpeg = await evalJs(`(() => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d');
  g.fillStyle = '#3a7'; g.fillRect(0, 0, 40, 30); g.fillStyle = '#fff'; g.fillRect(10, 8, 20, 14); return c.toDataURL('image/jpeg', .8); })()`);
await evalJs(`localStorage.clear(); localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(WHOLE)}));
  localStorage.setItem('dm-clinic-photo', JSON.stringify({key: '46.00000,-71.00000', img: ${JSON.stringify(tinyJpeg)}}))`);
events.length = 0;
await go('#clinic');
let card = await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
check('N-15 setup: clinic at 46, -71 with its own photo', !!card.img && card.img.alt === 'Your photo of Fake Whole Number Clinic', card);
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(400);
const filled = await evalJs(`document.querySelector('.dm-clinic-form').elements.spot.value`);
check('N-15 "Change" fills the location as "46.0, -71.0"', filled === '46.0, -71.0', filled);
await evalJs(`(() => { const f = document.querySelector('.dm-clinic-form'); f.elements.name.value = 'Fake Renamed Whole Clinic'; f.requestSubmit(); })()`); await wait(800);
const after = await evalJs(`({saved: JSON.parse(localStorage.getItem('dm-clinic')), bad: [...document.querySelectorAll('.dm-clinic-bad')].some((e) => !e.hidden),
  formOpen: !document.querySelector('.dm-clinic-form').hidden, photo: !!localStorage.getItem('dm-clinic-photo'), title: document.querySelector('[data-draw=clinic-name]').textContent})`);
check('N-15 name-only change is saved, no "No location found" message, form closed', !after.bad && !after.formOpen && after.saved.name === 'Fake Renamed Whole Clinic'
  && after.saved.lat === 46 && after.saved.lon === -71 && after.title === 'Fake Renamed Whole Clinic', after);
card = await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
check('N-15 / AC-2.2 the own photo is kept (same location)', after.photo && card.img && card.img.alt === 'Your photo of Fake Renamed Whole Clinic', card.img);
// a usual decimal clinic still fills exactly as before
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'Fake Test Clinic', lat: 45.39923, lon: -71.9333}))`);
await go('#clinic');
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(400);
const filled2 = await evalJs(`document.querySelector('.dm-clinic-form').elements.spot.value`);
check('N-15 a decimal location is filled unchanged', filled2 === '45.39923, -71.9333', filled2);
await evalJs(`document.querySelector('.dm-clinic-form').requestSubmit()`); await wait(500);
check('N-15 resaving it unchanged works', await evalJs(`JSON.parse(localStorage.getItem('dm-clinic')).lat === 45.39923 && document.querySelector('.dm-clinic-form').hidden`), '');
check('No outside request for the saved clinics', outside().length === 0, outside());

// 2. QA N-12: the own-photo error line, readable in light and dark (contrast 4.5 or more), announced as an alert
const notImage = path.join(TMP, 'notes.txt'); fs.writeFileSync(notImage, 'not a photo');
await pick(notImage);
await until(`document.querySelector('.dm-own-error').hidden`, (v) => v === false);
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]}); await wait(300);
  const c = await evalJs(contrastOf('.dm-own-error'));
  check(`N-12 ${theme}: error line contrast at least 4.5`, c.ratio >= 4.5, c);
}
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
check('N-12 error line has role="alert" and the spec sentence first', await evalJs(`(() => { const e = document.querySelector('.dm-own-error'); return e.getAttribute('role') === 'alert' && e.textContent.startsWith('This photo could not be saved in this browser.'); })()`), '');

// 3. Screen-reader labels (AC-7.3): every button and link in both photo areas has a name; images have alt text
await evalJs(`localStorage.clear()`);
await go('?hub=45.39869,-71.93327#competition');
const hub = await until(blockOf('hub-photo'), (v) => (v.img && !v.img.hidden) || v.text.startsWith('Photo not available'), 15000);
check('AC-7.3 street photo alt "Street view of [clinic name]" (live Panoramax)', !!hub.img && /^Street view of .+/.test(hub.img.alt), hub.img || hub.text);
const names = await evalJs(`(() => { const out = []; document.querySelectorAll('[data-draw=hub-photo] a, [data-draw=clinic-photo] a, .dm-own button, #clinic-card .dm-actions button').forEach((e) => {
  out.push({tag: e.tagName, name: (e.getAttribute('aria-label') || e.textContent).trim()}); }); return out; })()`);
check('AC-7.3 photo links and own-photo buttons all have a readable name', names.length >= 3 && names.every((x) => x.name.length > 2), names);
const tabbable = await evalJs(`(() => { const f = document.querySelector('.dm-own-file'); return f.tabIndex === -1 && f.getAttribute('aria-hidden') === 'true'; })()`);
check('AC-7 hidden file input stays out of the tab order', tabbable, '');

// 4. Regression: labels from meta.json, OSM credit, the limits that must stay visible, filters
await go('');
const meta = await evalJs(`dash.data('meta').data`);
const labels = await evalJs(`[...document.querySelectorAll('[data-label]')].map((e) => [e.dataset.label, e.textContent])`);
check('Labels come from meta.json', labels.length > 5 && labels.every(([k, t]) => meta[k] === t), labels.filter(([k, t]) => meta[k] !== t).slice(0, 5));
const page = await evalJs('document.body.textContent');
check('OpenStreetMap credit kept on the page', page.includes('© OpenStreetMap contributors') && page.includes('Open Database Licence'), '');
check('Limits stay visible: pandemic year, ages for household type, offices not dentists, pins about a third complete',
  page.includes('a pandemic year') && page.includes('Age groups are a stand-in for household type') && page.includes('not dentists') && page.includes('about a third complete'), '');
const rowsBefore = await evalJs(`document.querySelectorAll('tbody[data-draw=mtable] tr').length`);
await evalJs(`(() => { const s = document.getElementById('dm-min'); s.value = '500000'; s.dispatchEvent(new Event('change', {bubbles: true})); })()`); await wait(800);
const rowsAfter = await evalJs(`document.querySelectorAll('tbody[data-draw=mtable] tr').length`);
check('Filters still work (500,000 people or more leaves fewer markets)', rowsBefore > 0 && rowsAfter > 0 && rowsAfter < rowsBefore, {rowsBefore, rowsAfter});
await evalJs(`document.querySelector('.dm-reset').click()`); await wait(500);

// 5. Light and dark at 375 px: no horizontal scrolling on the Competition tab with a photo
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await go('?hub=45.39869,-71.93327#competition');
  await until(blockOf('hub-photo'), (v) => !v.text.startsWith('Loading'), 15000);
  const m = await evalJs(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})`);
  check(`AC-7.1/7.2 ${theme} 375 px: no horizontal scroll`, m.sw <= m.cw, m);
}
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});

check('No console errors or warnings from page code during the whole check', errors.length === 0, errors.slice(0, 3).map((e) => JSON.stringify(e.params).slice(0, 200)));
await evalJs('localStorage.clear()');
console.log(`\n${pass}/${n} passed`);
ws.close();
if (pass !== n) process.exitCode = 1;
