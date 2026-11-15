// Developer browser check, clinic photo increment 5: own photo for "Your clinic", plus QA notes N-8 and N-9.
// Needs Chrome started with --headless=new --remote-debugging-port=9333. No local web server is needed: the page is
// served from site/ through the DevTools Fetch domain at http://dm.test/. Test images are drawn by Chrome itself and
// written to a temporary folder, then given to the real file input. Only the N-9 check uses the live Panoramax service.
// Run: node tests/browser/photo-inc5.mjs   (not part of `node --test`, because it needs Chrome)
// Fake clinic name only ("Fake Test Clinic"); coordinates are public OpenStreetMap listings in Sherbrooke.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');
const BASE = 'http://dm.test/', CDP = 'http://localhost:9333';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-inc5-'));
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

const blockOf = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'); const img = el.querySelector('img');
  return {hidden: el.hidden, text: el.textContent, img: img && {alt: img.alt, hidden: img.hidden, complete: img.complete, w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 30)}}; })()`;
const own = `(() => { const b = document.querySelector('.dm-own'), add = b.querySelector('.dm-own-add'), rm = b.querySelector('.dm-own-remove'), er = b.querySelector('.dm-own-error');
  let st = null; try { st = JSON.parse(localStorage.getItem('dm-clinic-photo')); } catch (e) { st = 'unreadable'; }
  return {hidden: b.hidden, add: add.textContent, addVisible: !add.hidden && add.offsetWidth > 0, remove: !rm.hidden, err: er.hidden ? '' : er.textContent, role: er.getAttribute('role'),
    where: b.querySelector('#dm-own-where').textContent, stored: st && st.key ? {key: st.key, head: st.img.slice(0, 23), len: st.img.length} : st}; })()`;
const until = async (expr, fn, ms = 8000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(expr); if (fn(v)) return v; await wait(100); } return v; };
/* a fresh page load every time (a change of only the #part would not reload) */
const go = async (q) => { await send('Page.navigate', {url: 'about:blank'}); await wait(200); await send('Page.navigate', {url: `${BASE}${q}`}); await wait(300); await until(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`, (v) => v === true, 20000); await wait(800); };
const outside = () => events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/dm\.test\/|data:|blob:)/.test(e.params.request.url)).map((e) => e.params.request.url);
const pick = async (file) => {
  const doc = await send('DOM.getDocument', {depth: -1});
  const q = await send('DOM.querySelector', {nodeId: doc.result.root.nodeId, selector: '.dm-own-file'});
  await send('DOM.setFileInputFiles', {nodeId: q.result.nodeId, files: [file]});
};
/* a fake test picture drawn by Chrome: coloured shapes, no people, no real place */
const drawPicture = async (w, h, type) => {
  const data = await evalJs(`(() => { const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h}; const g = c.getContext('2d');
    for (let i = 0; i < 400; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 50) + '%)'; g.fillRect((i * 97) % ${w}, (i * 53) % ${h}, 40 + i % 200, 30 + i % 150); }
    return c.toDataURL('${type}', 0.95).split(',')[1]; })()`);
  return Buffer.from(data, 'base64');
};
const CLINIC = {name: 'Fake Test Clinic', lat: 45.39869, lon: -71.93327}; /* a Sherbrooke listing that has a Panoramax photo */
const HUB = `${CLINIC.lat.toFixed(5)},${CLINIC.lon.toFixed(5)}`;

// 0. Fake test files
await go('');
const bigPng = path.join(TMP, 'front.png'); fs.writeFileSync(bigPng, await drawPicture(3000, 2000, 'image/png'));
const tallJpg = path.join(TMP, 'tall.jpg'); fs.writeFileSync(tallJpg, await drawPicture(900, 1600, 'image/jpeg'));
const notImage = path.join(TMP, 'notes.txt'); fs.writeFileSync(notImage, 'not a photo');
const fakeJpg = path.join(TMP, 'broken.jpg'); fs.writeFileSync(fakeJpg, 'this is not really a jpeg');
const hugeJpg = path.join(TMP, 'huge.jpg'); fs.writeFileSync(hugeJpg, Buffer.concat([fs.readFileSync(tallJpg), Buffer.alloc(21 * 1024 * 1024)]));

// 1. Saved clinic, no own photo yet
await evalJs(`localStorage.clear(); localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(CLINIC)}))`);
events.length = 0;
await go('#clinic');
let o = await evalJs(own);
check('AC-5.1 "Add your own photo" shown, no "Remove photo"', !o.hidden && o.add === 'Add your own photo' && o.addVisible && !o.remove, o);
check('AC-5.4 "Saved in this browser only." next to the action', o.where === 'Saved in this browser only.', o.where);
const a11y = await evalJs(`(() => { const add = document.querySelector('.dm-own-add'), f = document.querySelector('.dm-own-file');
  return {tag: add.tagName, type: add.type, desc: add.getAttribute('aria-describedby'), fileTab: f.tabIndex, fileHidden: f.hidden, accept: f.accept}; })()`);
check('AC-7 controls are real buttons; the file input is out of the tab order; JPEG/PNG only', a11y.tag === 'BUTTON' && a11y.type === 'button' && a11y.desc === 'dm-own-where' && a11y.fileTab === -1 && a11y.accept === 'image/jpeg,image/png', a11y);
let card = await evalJs(blockOf('clinic-photo'));
check('D2 card without own photo: "Photo not available" and privacy line', card.text.startsWith('Photo not available') && card.text.includes('stays private') && !card.img, card.text);

// 2. Add a large PNG: shrunk to 800 px, saved as JPEG, shown at once, nothing sent anywhere
await pick(bigPng);
card = await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
o = await evalJs(own);
check('AC-5.2 own photo shown in the card with "Your photo" and the link', !!card.img && !card.img.hidden && card.text === 'Your photo · View on Google Maps', card);
check('AC-7.3 alt "Your photo of [clinic name]"', card.img && card.img.alt === 'Your photo of Fake Test Clinic', card.img && card.img.alt);
check('R7 shrunk to 800 px on the longer side', card.img && card.img.w === 800 && card.img.h === 533, card.img);
check('R7 stored as JPEG with the location key, well under 1 MB', o.stored && o.stored.key === HUB && o.stored.head === 'data:image/jpeg;base64,' && o.stored.len < 1000000, o.stored);
check('AC-5.1 button now "Replace photo", "Remove photo" shown', o.add === 'Replace photo' && o.remove && !o.err, o);
check('AC-5.7 no request to any outside address while adding', outside().length === 0, outside());

// 3. Close and reopen: still there (AC-5.3)
await go('#clinic');
card = await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
check('AC-5.3 own photo kept after reopening the page', !!card.img && card.img.w === 800, card.img);
check('AC-5.7 own photo never in the page address', !(await evalJs('location.href')).includes('data:'), await evalJs('location.href'));

// 4. Competition tab with her clinic at the centre: own photo, no lookup (AC-2.4)
events.length = 0;
await evalJs(`document.querySelector('#clinic-card .dm-hub-mine').click()`);
let hub = await until(blockOf('hub-photo'), (v) => v.img && !v.img.hidden);
await wait(1500);
check('AC-2.4 / AC-5.2 own photo under the competition title', !!hub.img && hub.img.alt === 'Your photo of Fake Test Clinic' && hub.text === 'Your photo · View on Google Maps', hub);
check('R1 no Panoramax request for her clinic', outside().length === 0, outside());
check('AC-5.8 no own-photo buttons in the Competition tab', await evalJs(`!document.querySelector('#competition .dm-own, #competition input[type=file]')`), '');

// 5. Bad files: clear message, previous photo stays (AC-5.6)
await go('#clinic');
for (const [label, file, why] of [['not an image', notImage, 'Choose a JPEG or PNG image.'], ['corrupt JPEG', fakeJpg, 'could not be read as an image'], ['over 20 MB', hugeJpg, 'larger than 20 MB']]) {
  await pick(file);
  o = await until(own, (v) => v.err.includes(why));
  card = await evalJs(blockOf('clinic-photo'));
  check(`AC-5.6 ${label}: message, previous photo stays`, o.err.startsWith('This photo could not be saved in this browser.') && o.err.includes(why) && o.role === 'alert'
    && o.stored && o.stored.len > 1000 && card.img && !card.img.hidden, {err: o.err, stored: o.stored});
}
// storage full or blocked
await evalJs(`(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'dm-clinic-photo') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; })()`);
const before = (await evalJs(own)).stored;
await pick(tallJpg);
o = await until(own, (v) => v.err.includes('storage'));
check('AC-5.6 storage full: message, previous photo stays', o.err === "This photo could not be saved in this browser. This browser's storage is full or blocked." && o.stored.len === before.len, o);

// 6. Replace with a portrait JPEG (works again after reload, storage back to normal)
await go('#clinic');
await pick(tallJpg);
card = await until(blockOf('clinic-photo'), (v) => v.img && v.img.h === 800);
o = await evalJs(own);
check('AC-5.2 replace: new photo shown, error gone, 450 x 800', card.img && card.img.w === 450 && card.img.h === 800 && !o.err, card.img);

// 7. Light and dark at 375 px with the own photo and buttons
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await wait(500);
  const m = await evalJs(`(() => { const r = document.querySelector('[data-draw="clinic-photo"] img').getBoundingClientRect(), b = document.querySelector('.dm-own-add').getBoundingClientRect(),
    cs = getComputedStyle(document.querySelector('.dm-own-add'));
    return {sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, w: Math.round(r.width), h: Math.round(r.height), btnRight: Math.round(b.right), fg: cs.color, bg: cs.backgroundColor}; })()`);
  check(`AC-7.1/7.2 ${theme} 375 px: no horizontal scroll, photo and buttons fit`, m.sw <= m.cw && m.w > 0 && m.w <= m.cw && m.h <= 201 && m.btnRight <= m.cw && m.fg !== m.bg, m);
  await evalJs(`document.querySelector('#clinic-card').scrollIntoView()`); await wait(200);
  const shot = await send('Page.captureScreenshot', {format: 'jpeg', quality: 60});
  if (process.env.SHOTS) fs.writeFileSync(path.join(process.env.SHOTS, `inc5-${theme}-375.jpg`), Buffer.from(shot.result.data, 'base64'));
}
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// 8. Change only the name: photo kept. Change the location: photo deleted (AC-2.2)
const resave = (name, spot) => `(() => { document.querySelector('.dm-clinic-edit').click(); const f = document.querySelector('.dm-clinic-form');
  f.elements.name.value = ${JSON.stringify(name)}; f.elements.spot.value = ${JSON.stringify(spot)}; f.requestSubmit(); })()`;
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(400);
const editing = await evalJs(`({own: document.querySelector('.dm-own').hidden, photo: document.querySelector('[data-draw=clinic-photo]').hidden})`);
check('While "Change" is open, the photo and its buttons are hidden', editing.own === true && editing.photo === true, editing);
await evalJs(`document.querySelector('.dm-clinic-form').requestSubmit()`); await wait(500);
await evalJs(resave('Fake Renamed Clinic', `${CLINIC.lat}, ${CLINIC.lon}`)); await wait(800);
card = await evalJs(blockOf('clinic-photo'));
check('Change name only: photo kept', card.img && card.img.alt === 'Your photo of Fake Renamed Clinic' && (await evalJs(own)).stored, card.img);

// 9. N-8: her clinic is the centre, then she changes its location: no lookup of the old location
events.length = 0;
await evalJs(`dash.setParams({hub: '${HUB}'})`); await wait(500);
await evalJs(resave('Fake Test Clinic', '45.50170, -73.56730')); await wait(3000);
o = await evalJs(own);
check('AC-2.2 location changed: own photo deleted', o.stored === null && o.add === 'Add your own photo' && !o.remove, o);
hub = await evalJs(blockOf('hub-photo'));
check('N-8 Change while her old clinic is the centre: no lookup, "Photo not available"', outside().length === 0 && hub.text.startsWith('Photo not available') && !hub.img, {req: outside(), text: hub.text});

// 10. N-8: her clinic is the centre, then she removes it: no lookup of the old location
await evalJs(`dash.setParams({hub: '45.50170,-73.56730'})`); await wait(500);
events.length = 0;
await evalJs(`document.querySelector('.dm-clinic-remove').click()`); await wait(3000);
hub = await evalJs(blockOf('hub-photo'));
check('N-8 Remove while her clinic is the centre: no lookup', outside().length === 0 && !hub.text.startsWith('Loading'), {req: outside(), text: hub.text});
check('AC-2.3 / AC-5.5 Remove clinic: photo deleted, block and buttons hidden', await evalJs(`localStorage.getItem('dm-clinic-photo') === null && document.querySelector('[data-draw=clinic-photo]').hidden && document.querySelector('.dm-own').hidden`), '');

// 11. Remove photo: back to "Photo not available", focus on the add button (AC-5.5)
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(CLINIC)}))`);
await go('#clinic');
await pick(tallJpg); await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
await evalJs(`document.querySelector('.dm-own-remove').click()`); await wait(500);
card = await evalJs(blockOf('clinic-photo')); o = await evalJs(own);
check('AC-5.5 Remove photo: "Photo not available" again, storage cleared', card.text.startsWith('Photo not available') && !card.img && o.stored === null && !o.remove, {card: card.text, o});
check('Focus moves to "Add your own photo" after removing', await evalJs(`document.activeElement === document.querySelector('.dm-own-add')`), '');

// 12. N-9: a free photo is downloaded once, and its credit never shows before the image
await evalJs('localStorage.clear()');
events.length = 0;
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Page.navigate', {url: `${BASE}?hub=${HUB}#competition`});
let early = false, s;
const t0 = Date.now();
while (Date.now() - t0 < 15000) {
  s = await evalJs(`(() => { const el = document.querySelector('[data-draw="hub-photo"]'); if (!el) return {}; const img = el.querySelector('img');
    return {credit: /Photo: |Photo via /.test(el.textContent), shown: !!img && !img.hidden && img.complete && img.naturalWidth > 0, src: img ? img.src : ''}; })()`);
  if (s.credit && !s.shown) early = true;
  if (s.shown) break;
  await wait(20);
}
await wait(1000);
const imgReqs = events.filter((e) => e.method === 'Network.requestWillBeSent' && s.src && e.params.request.url === s.src);
check('N-9 photo shown (live Panoramax)', !!s.shown, s);
check('N-9 credit line never appears before the image', s.shown && !early, {early});
check('N-9 the image is downloaded once (cache off)', imgReqs.length === 1, imgReqs.length);
await send('Network.setCacheDisabled', {cacheDisabled: false});

check('No console errors from page code during the whole check', errors.length === 0, errors.slice(0, 3).map((e) => JSON.stringify(e.params).slice(0, 200)));
await evalJs('localStorage.clear()');
fs.rmSync(TMP, {recursive: true, force: true});
console.log(`\n${pass}/${n} passed`);
ws.close();
