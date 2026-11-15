// QA browser check, clinic photo increment 5: Thu's own photo for "Your clinic", plus the N-8 and N-9 fixes.
// Independent of the developer's tests/browser/photo-inc5.mjs.
// Needs: python3 -m http.server 8123 --directory site, and Chrome started with --headless=new --remote-debugging-port=9333.
// Run: node tests/qa/qa-photo-inc5.mjs   (the N-8 and N-9 parts use the live Panoramax service; some requests are held on purpose)
// Fake clinic names only ("QA Fake Clinic", "QA Fake Clinique Élégance"); test pictures are coloured shapes or noise drawn by
// Chrome, and the GPS data written into the test JPEG is made up. Coordinates are public OpenStreetMap listings or points near them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'http://localhost:8123/', CDP = 'http://localhost:9333';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-inc5-'));
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); let events = []; const chooser = [], allErrs = [];
// image mode for Panoramax image downloads: 'live' | {delayMs} | 'fail'
let imageMode = 'live';
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const isSearch = (u) => u.startsWith('https://api.panoramax.xyz/api/search');
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  events.push(j);
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))) allErrs.push(JSON.stringify(j.params).slice(0, 300));
  if (j.method === 'Page.fileChooserOpened') chooser.push(j.params);
  if (j.method !== 'Fetch.requestPaused') return;
  const {requestId, request} = j.params, u = request.url;
  if (isSearch(u) || imageMode === 'live') send('Fetch.continueRequest', {requestId});
  else if (imageMode === 'fail') send('Fetch.failRequest', {requestId, errorReason: 'ConnectionRefused'});
  else { const d = imageMode.delayMs; setTimeout(() => send('Fetch.continueRequest', {requestId}), d); }
});
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({name, ok: !!ok}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); };
const note = (name, info) => console.log(`INFO  ${name}  ${JSON.stringify(info).slice(0, 400)}`);
await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable'); await send('DOM.enable');
await send('Fetch.enable', {patterns: [{urlPattern: '*panoramax*', requestStage: 'Request'}]});
await send('Network.setCacheDisabled', {cacheDisabled: true});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});
// record, with timestamps, when the competition credit appears and when its image is visible (N-9)
await send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__log = []; document.addEventListener('DOMContentLoaded', () => {
  const b = document.querySelector('[data-draw="hub-photo"]'); if (!b) return;
  const rec = () => { const i = b.querySelector('img'); window.__log.push({t: performance.now(), credit: /via Panoramax/.test(b.textContent),
    shown: !!(i && !i.hidden && !b.hidden && i.complete && i.naturalWidth > 0), broken: !!(i && !i.hidden && i.complete && i.naturalWidth === 0)}); };
  new MutationObserver(rec).observe(b, {subtree: true, childList: true, characterData: true, attributes: true}); });`});

const go = async (q) => {
  await send('Page.navigate', {url: 'about:blank'}); await wait(150);
  await send('Page.navigate', {url: BASE + q}); await wait(300);
  const t = Date.now();
  while (Date.now() - t < 20000) { if (await evalJs(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`).catch(() => false)) break; await wait(100); }
  await wait(600);
};
const blockOf = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'), img = el.querySelector('img');
  return {hidden: el.hidden, text: el.textContent, title: document.querySelector('[data-draw="${name === 'hub-photo' ? 'hub-name' : 'clinic-name'}"]').textContent,
    img: img && {alt: img.alt, hidden: img.hidden, w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 40)}}; })()`;
const own = `(() => { const b = document.querySelector('.dm-own'), add = b.querySelector('.dm-own-add'), rm = b.querySelector('.dm-own-remove'), er = b.querySelector('.dm-own-error');
  let st = null; try { st = JSON.parse(localStorage.getItem('dm-clinic-photo')); } catch (e) { st = 'unreadable'; }
  return {hidden: b.hidden, add: add.textContent, remove: !rm.hidden, err: er.hidden ? '' : er.textContent, role: er.getAttribute('role'),
    focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName),
    stored: st && st.key ? {key: st.key, len: st.img.length, head: st.img.slice(0, 23)} : st}; })()`;
const until = async (expr, fn, ms = 10000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(expr); if (fn(v)) return v; await wait(100); } return v; };
const outside = () => events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/localhost:8123\/|data:|blob:)/.test(e.params.request.url)).map((e) => e.params.request.url);
const allReqs = () => events.filter((e) => e.method === 'Network.requestWillBeSent').map((e) => e.params.request);
const searches = () => outside().filter(isSearch);
const pageErrors = () => events.filter((e) => (e.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(e.params.type)) || e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && e.params.entry.source !== 'network')).map((e) => JSON.stringify(e.params).slice(0, 200));
const pick = async (file) => {
  const doc = await send('DOM.getDocument', {depth: -1});
  const q = await send('DOM.querySelector', {nodeId: doc.result.root.nodeId, selector: '.dm-own-file'});
  await send('DOM.setFileInputFiles', {nodeId: q.result.nodeId, files: [file]});
};
const save = (c) => evalJs(`localStorage.setItem('dm-clinic', JSON.stringify(${JSON.stringify(c)}))`);
const formSave = (name, spot) => evalJs(`(() => { const fm = document.querySelector('.dm-clinic-form'); fm.elements.name.value = ${JSON.stringify(name)}; fm.elements.spot.value = ${JSON.stringify(spot)}; fm.requestSubmit(); })()`);
const click = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)}).click()`);

// ---------- test files ----------
await go('');
const draw = async (w, h, type, noise = false) => Buffer.from(await evalJs(`(() => { const c = document.createElement('canvas'); c.width = ${w}; c.height = ${h}; const g = c.getContext('2d');
  if (${noise}) { const d = g.createImageData(${w}, ${h}); for (let i = 0; i < d.data.length; i++) d.data[i] = (i % 4 === 3) ? 255 : Math.random() * 256; g.putImageData(d, 0, 0); }
  else { g.fillStyle = '#3366cc'; g.fillRect(0, 0, ${w}, ${h}); g.fillStyle = '#ffcc00'; g.fillRect(0, 0, ${w} / 2, ${h} / 4); }
  return c.toDataURL('${type}', 0.95).split(',')[1]; })()`), 'base64');
// a JPEG with an Exif block: made-up GPS position, a text marker, and Orientation 6 (rotate 90 degrees, as phones write it)
const MARK = 'QA-FAKE-EXIF-MARKER';
const withExif = (jpeg) => {
  const le = (n, b) => { const x = Buffer.alloc(b); b === 2 ? x.writeUInt16LE(n) : x.writeUInt32LE(n); return x; };
  const ent = (tag, type, count, val) => Buffer.concat([le(tag, 2), le(type, 2), le(count, 4), Buffer.isBuffer(val) ? Buffer.concat([val, Buffer.alloc(4 - val.length)]) : le(val, 4)]);
  const ifd0Off = 8, ifd0Len = 2 + 3 * 12 + 4, gpsOff = ifd0Off + ifd0Len, gpsLen = 2 + 4 * 12 + 4, dataOff = gpsOff + gpsLen;
  const desc = Buffer.from(MARK + '\0'), latOff = dataOff + desc.length, lonOff = latOff + 24;
  const rat = (a) => Buffer.concat(a.flatMap((v) => [le(v, 4), le(1, 4)]));
  const ifd0 = Buffer.concat([le(3, 2), ent(0x010e, 2, desc.length, dataOff), Buffer.concat([le(0x0112, 2), le(3, 2), le(1, 4), le(6, 2), Buffer.alloc(2)]), ent(0x8825, 4, 1, gpsOff), le(0, 4)]);
  const gps = Buffer.concat([le(4, 2), ent(1, 2, 2, Buffer.from('N\0')), ent(2, 5, 3, latOff), ent(3, 2, 2, Buffer.from('W\0')), ent(4, 5, 3, lonOff), le(0, 4)]);
  const tiff = Buffer.concat([Buffer.from('II*\0'), le(8, 4), ifd0, gps, desc, rat([45, 12, 34]), rat([71, 56, 7])]);
  const body = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const seg = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(body.length + 2) >> 8, (body.length + 2) & 255]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), seg, jpeg.subarray(2)]);
};
const F = (name, buf) => { const f = path.join(TMP, name); fs.writeFileSync(f, buf); return f; };
const landJpg = await draw(1200, 600, 'image/jpeg');
const files = {
  exif: F('phone.jpg', withExif(landJpg)),
  big: F('front.png', await draw(4000, 3000, 'image/png')),
  small: F('small.png', await draw(300, 200, 'image/png')),
  noise: F('noise.png', await draw(2400, 2400, 'image/png', true)),
  gif: F('anim.gif', Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary')),
  webp: F('pic.webp', Buffer.from(await evalJs(`(() => { const c = document.createElement('canvas'); c.width = 20; c.height = 20; return c.toDataURL('image/webp').split(',')[1]; })()`), 'base64')),
  svg: F('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'),
  txtPng: F('fake.png', 'plain text pretending to be a png'),
  pngAsJpg: F('mislabelled.jpg', await draw(500, 400, 'image/png')),
  empty: F('empty.jpg', Buffer.alloc(0)),
};
const MB20 = 20 * 1024 * 1024;
files.exact20 = F('exact20.jpg', Buffer.concat([landJpg, Buffer.alloc(MB20 - landJpg.length)]));
files.over20 = F('over20.jpg', Buffer.concat([landJpg, Buffer.alloc(MB20 - landJpg.length + 1)]));
check('test JPEG really carries the Exif block (marker, GPS IFD)', fs.readFileSync(files.exif).includes(MARK) && fs.readFileSync(files.exif).includes('Exif'), fs.statSync(files.exif).size);

const A = {lat: 45.39869, lon: -71.93327, hub: '45.39869,-71.93327'}; // Sherbrooke listing with a Panoramax photo
const B = {hub: '45.39606,-71.94475'}; // another listing 943 m away
const north = (m) => ({lat: Number((A.lat + m / 111320).toFixed(6)), lon: A.lon});
const CL = {name: 'QA Fake Clinic', lat: A.lat, lon: A.lon};

// ---------- 1. Add with a phone JPEG: Exif and GPS gone, orientation applied, 800 px, JPEG, nothing sent ----------
await evalJs('localStorage.clear()'); await save(CL);
await go('#clinic'); events = [];
await send('Page.setInterceptFileChooserDialog', {enabled: true});
// keyboard path: Tab to the button and press Enter; the file chooser must open
await evalJs(`document.querySelector('.dm-own-add').focus()`);
await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13});
await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13});
await wait(500);
check('Keyboard: Enter on "Add your own photo" opens the file chooser (JPEG/PNG only, one file)', chooser.length === 1 && chooser[0].mode === 'selectSingle', chooser[0]);
if (chooser[0]) await send('DOM.setFileInputFiles', {backendNodeId: chooser[0].backendNodeId, files: [files.exif]});
await send('Page.setInterceptFileChooserDialog', {enabled: false});
let card = await until(blockOf('clinic-photo'), (v) => v.img && !v.img.hidden);
let o = await evalJs(own);
const img = await evalJs(`JSON.parse(localStorage.getItem('dm-clinic-photo')).img`);
const bytes = Buffer.from(img.split(',')[1], 'base64');
check('AC-5.2 own photo shown at once in the card, "Your photo · View on Google Maps"', card.img && !card.img.hidden && card.text === 'Your photo · View on Google Maps', card);
check('R7 Exif block, GPS and text marker removed from the stored JPEG', !bytes.includes('Exif') && !bytes.includes(MARK) && !bytes.includes(Buffer.from([0xff, 0xe1])), {len: bytes.length, jfif: bytes.subarray(6, 10).toString()});
check('R7 stored as image/jpeg data, starts with JPEG magic bytes', img.startsWith('data:image/jpeg;base64,') && bytes[0] === 0xff && bytes[1] === 0xd8, img.slice(0, 30));
check('R7 phone orientation applied before re-encoding (1200x600 with Orientation 6 -> 400x800)', card.img && card.img.w === 400 && card.img.h === 800, card.img);
check('Focus stays on the photo button after adding', /dm-own-add/.test(o.focus), o.focus);
check('AC-5.7 zero outside requests while adding and showing', outside().length === 0, outside());
check('AC-5.7 no POST / no request carrying the photo', allReqs().filter((r) => !r.url.startsWith('data:')).every((r) => r.method === 'GET' && !r.url.includes(img.slice(30, 80))), allReqs().map((r) => r.method + ' ' + r.url.slice(0, 60)));
check('AC-5.7 photo not in the page address', !(await evalJs('location.href')).includes('base64'), await evalJs('location.href'));

// ---------- 2. Sizes ----------
for (const [label, f, w, h] of [['4000x3000 PNG', files.big, 800, 600], ['300x200 PNG not enlarged', files.small, 300, 200], ['PNG content named .jpg', files.pngAsJpg, 500, 400]]) {
  await pick(f);
  card = await until(blockOf('clinic-photo'), (v) => v.img && v.img.w === w && v.img.h === h);
  o = await evalJs(own);
  check(`R7 ${label} -> ${w}x${h}, JPEG, no error`, card.img && card.img.w === w && card.img.h === h && o.stored.head === 'data:image/jpeg;base64,' && !o.err, {img: card.img, st: o.stored});
}
await pick(files.noise);
o = await until(own, (v) => v.stored && v.stored.len !== undefined && (v.err || true) && v.stored.len > 300000, 15000);
note('R7 worst case: 2400x2400 random noise stored length (limit 1,000,000)', {len: o.stored && o.stored.len, err: o.err});
check('R7 worst-case noise photo saved within the 1,000,000 character budget, or refused with the "too detailed" reason', (o.stored && o.stored.len <= 1000000 && !o.err) || /too detailed/.test(o.err), o);
await pick(files.exact20);
o = await until(own, (v) => v.err || (v.stored && v.stored.len < 300000), 15000);
check('Exactly 20 MB is accepted (only over 20 MB is refused)', !o.err && o.stored && o.stored.len < 300000, o);

// ---------- 3. Refusals: exact first sentence, reason, role=alert, previous photo kept ----------
const keep = await evalJs(`localStorage.getItem('dm-clinic-photo')`);
const shownBefore = (await evalJs(`document.querySelector('[data-draw="clinic-photo"] img').src`)).length;
for (const [label, f, why] of [['GIF', files.gif, 'Choose a JPEG or PNG image.'], ['WebP', files.webp, 'Choose a JPEG or PNG image.'], ['SVG', files.svg, 'Choose a JPEG or PNG image.'],
  ['text named .png', files.txtPng, 'could not be read as an image'], ['empty .jpg', files.empty, 'could not be read'], ['20 MB + 1 byte', files.over20, 'larger than 20 MB']]) {
  await pick(f);
  o = await until(own, (v) => v.err.includes(why));
  const same = (await evalJs(`localStorage.getItem('dm-clinic-photo')`)) === keep;
  card = await evalJs(blockOf('clinic-photo'));
  check(`AC-5.6 ${label}: "This photo could not be saved in this browser." + reason, role=alert, previous photo kept`,
    o.err.startsWith('This photo could not be saved in this browser. ') && o.err.includes(why) && o.role === 'alert' && same && card.img && !card.img.hidden
    && (await evalJs(`document.querySelector('[data-draw="clinic-photo"] img').src`)).length === shownBefore, o.err);
}
// real storage quota: fill localStorage, then replace
await evalJs(`(() => { let i = 0; for (let size = 1024 * 1024; size >= 1; size = Math.floor(size / 2)) { const s = 'x'.repeat(size); for (;;) { try { localStorage.setItem('qa-fill-' + (i++), s); } catch (e) { break; } } } return i; })()`);
await pick(files.big);
o = await until(own, (v) => v.err.includes('storage'), 15000);
check('AC-5.6 real quota exceeded: storage reason shown, previous photo kept', o.err === "This photo could not be saved in this browser. This browser's storage is full or blocked." && (await evalJs(`localStorage.getItem('dm-clinic-photo')`)) === keep, o.err);
await evalJs(`Object.keys(localStorage).filter((k) => k.startsWith('qa-fill-')).forEach((k) => localStorage.removeItem(k))`);
await pick(files.small);
o = await until(own, (v) => !v.err && v.stored && v.stored.len !== JSON.parse(keep).img.length);
check('Message cleared after a successful add', !o.err, o);
await pick(files.gif); await until(own, (v) => !!v.err);
await click('.dm-own-remove');
/* wait for the redraw after "Remove photo" (inc6 QA: an immediate read was flaky) */
o = await until(own, (v) => v.stored === null && !v.remove && v.add === 'Add your own photo' && /dm-own-add/.test(v.focus), 5000);
check('AC-5.5 "Remove photo": storage cleared, message cleared, focus on "Add your own photo"', o.stored === null && !o.err && o.add === 'Add your own photo' && !o.remove && /dm-own-add/.test(o.focus), o);
card = await until(blockOf('clinic-photo'), (v) => v.text.startsWith('Photo not available') && !v.img, 5000);
check('AC-5.5 back to "Photo not available" + privacy line', card.text.startsWith('Photo not available · View on Google Maps') && card.text.includes('stays private') && !card.img, card.text);

// ---------- 4. Tampered storage: nothing shown, nothing requested, no error ----------
for (const [label, val] of [['https image', {key: A.hub, img: 'https://example.invalid/x.jpg'}], ['SVG data', {key: A.hub, img: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='}],
  ['attribute injection', {key: A.hub, img: 'data:image/jpeg;base64,AAAA" onerror="alert(1)'}], ['other location', {key: '45.00000,-71.00000', img: 'data:image/jpeg;base64,' + bytes.toString('base64')}], ['not JSON', '{oops']]) {
  await evalJs(`localStorage.setItem('dm-clinic-photo', ${JSON.stringify(typeof val === 'string' ? val : JSON.stringify(val))})`);
  events = [];
  await go('#clinic');
  card = await evalJs(blockOf('clinic-photo')); o = await evalJs(own);
  check(`Tampered storage (${label}): no image, "Add your own photo", no outside request, no console error`, !card.img && o.add === 'Add your own photo' && outside().length === 0 && pageErrors().length === 0, {t: card.text.slice(0, 30), out: outside(), err: pageErrors()});
}
await evalJs(`localStorage.removeItem('dm-clinic-photo')`);

// ---------- 5. Competition tab: hers only; other clinics never ----------
await go('#clinic'); await pick(files.small); await until(own, (v) => v.remove);
events = [];
await click('#clinic-card .dm-hub-mine');
let hub = await until(blockOf('hub-photo'), (v) => v.img && !v.img.hidden);
await wait(1200);
check('AC-2.4 own photo under "Competition around QA Fake Clinic", alt "Your photo of QA Fake Clinic", 0 outside requests', hub.img && hub.title === 'Competition around QA Fake Clinic' && hub.img.alt === 'Your photo of QA Fake Clinic' && outside().length === 0, {hub, out: outside()});
check('AC-5.8 no add/replace/remove controls in the Competition tab', await evalJs(`!document.querySelector('#competition .dm-own, #competition .dm-own-add, #competition input[type=file]')`));
events = [];
await evalJs(`dash.setParams({hub: '${B.hub}', svc: ''})`);
hub = await until(blockOf('hub-photo'), (v) => !/Loading/.test(v.text), 15000);
check('AC-5.8 another clinic (943 m) as centre: never the own photo', !(hub.img && hub.img.src.startsWith('data:')) && !hub.text.includes('Your photo'), hub);
// saved clinic 60 m from listing A, with an own photo; A as centre is a different clinic
await save({name: 'QA Fake Clinic', ...north(60)}); await evalJs(`localStorage.removeItem('dm-clinic-photo')`);
await go('#clinic'); await pick(files.small); await until(own, (v) => v.remove);
events = [];
await evalJs(`dash.setParams({hub: '${A.hub}', svc: ''})`); await wait(1500);
hub = await evalJs(blockOf('hub-photo'));
check('AC-5.8 neighbour listing 60 m away as centre: not her photo, "Photo not available", no lookup (R1)', !hub.img && hub.text === 'Photo not available · View on Google Maps' && searches().length === 0, {hub, s: searches()});
// accents
await formSave('QA Fake Clinique Élégance', `${north(60).lat}, ${north(60).lon}`); await wait(500);
await evalJs(`dash.setParams({hub: '${north(60).lat.toFixed(5)},${north(60).lon.toFixed(5)}', svc: ''})`); await wait(500);
hub = await evalJs(blockOf('hub-photo'));
check('Accents: title and alt "Your photo of QA Fake Clinique Élégance"; name-only change kept the photo', hub.img && hub.img.alt === 'Your photo of QA Fake Clinique Élégance' && hub.title.endsWith('Élégance'), hub);

// ---------- 6. Change / Remove keep or delete the photo ----------
await click('.dm-clinic-edit'); await wait(300);
check('While "Change" is open: photo block and buttons hidden', await evalJs(`document.querySelector('[data-draw="clinic-photo"]').hidden && document.querySelector('.dm-own').hidden`));
await evalJs(`document.querySelector('.dm-clinic-form').requestSubmit()`); await wait(400); // unchanged values
o = await evalJs(own);
check('Change saved with the same values: photo kept', o.remove && o.stored, o.stored);
await formSave('QA Fake Clinique Élégance', 'https://www.google.com/maps/place/x/@' + north(60).lat + ',' + north(60).lon + ',17z'); await wait(400);
o = await evalJs(own);
check('Same location re-entered as a Google Maps link: photo kept', o.remove && o.stored, o.stored);
await formSave('QA Fake Clinique Élégance', `${north(60).lat + 0.0003}, ${north(60).lon}`); await wait(400);
o = await evalJs(own);
check('AC-2.2 location moved about 33 m: photo deleted from storage and screen', o.stored === null && !o.remove && o.add === 'Add your own photo' && !(await evalJs(blockOf('clinic-photo'))).img, o);
await pick(files.small); await until(own, (v) => v.remove);
await click('.dm-clinic-remove'); await wait(400);
check('AC-5.5 / AC-2.3 "Remove" clinic: photo deleted, block and buttons hidden', (await evalJs(`localStorage.getItem('dm-clinic-photo')`)) === null && await evalJs(`document.querySelector('[data-draw="clinic-photo"]').hidden && document.querySelector('.dm-own').hidden`));
// race: a large file is being read when the clinic is removed
await save(CL); await go('#clinic');
await pick(files.big); await click('.dm-clinic-remove'); await wait(4000);
check('Race: clinic removed while a photo is being read -> nothing saved', (await evalJs(`localStorage.getItem('dm-clinic-photo')`)) === null);
await save(CL); await go('#clinic');
await pick(files.big); await formSave('QA Fake Clinic', '45.5, -73.6'); await wait(4000);
check('Race: location changed while a photo is being read -> nothing saved for the new location', (await evalJs(`localStorage.getItem('dm-clinic-photo')`)) === null);

// ---------- 7. Light / dark, 375 px with photo and error message ----------
await save(CL); await go('#clinic'); await pick(files.big); await until(own, (v) => v.remove, 15000); await pick(files.gif); await until(own, (v) => !!v.err);
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await wait(500);
  const m = await evalJs(`(() => { const lum = (c) => { const v = c.match(/[\\d.]+/g).slice(0, 3).map((x) => { x = x / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const bgOf = (e) => { while (e) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(b)) return b; e = e.parentElement; } return 'rgb(255,255,255)'; };
    const ratio = (e) => { const a = lum(getComputedStyle(e).color), b = lum(bgOf(e)); return +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); };
    const er = document.querySelector('.dm-own-error'), add = document.querySelector('.dm-own-add'), wh = document.querySelector('#dm-own-where'), im = document.querySelector('[data-draw="clinic-photo"] img').getBoundingClientRect();
    const r = [er, add, wh].map((e) => e.getBoundingClientRect().right);
    return {sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, err: ratio(er), btn: ratio(add), where: ratio(wh), maxRight: Math.max(...r, im.right), imgW: Math.round(im.width), imgH: Math.round(im.height)}; })()`);
  check(`AC-7.1/7.2 ${theme} 375 px with photo + error: no horizontal scroll, contrast >= 4.5`, m.sw === m.cw && m.maxRight <= 375 && m.err >= 4.5 && m.btn >= 4.5 && m.where >= 4.5 && m.imgH <= 201, m);
}
await send('Emulation.setEmulatedMedia', {features: []});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// ---------- 8. N-8: every location saved during the visit stays private ----------
const fresh = async (c, q) => { await go(''); await evalJs('localStorage.clear()'); if (c) await save(c); await go(q); events = []; };
await fresh(CL, `?hub=${A.hub}#competition`);
await click('.dm-clinic-remove'); await wait(3000);
hub = await evalJs(blockOf('hub-photo'));
check('N-8 Remove while her clinic (a listing) is the centre: 0 searches, "Photo not available", no privacy line', searches().length === 0 && hub.text === 'Photo not available · View on Google Maps', {s: searches(), hub});
await fresh(CL, `?hub=${A.hub}#competition`);
await click('.dm-clinic-edit'); await formSave('QA Fake Clinic', '45.5, -73.6'); await wait(3000);
hub = await evalJs(blockOf('hub-photo'));
check('N-8 Change location while her old clinic is the centre: 0 searches, "Photo not available"', searches().length === 0 && hub.text === 'Photo not available · View on Google Maps', {s: searches(), hub});
await fresh({name: 'QA Fake Clinic', ...north(60)}, '#competition');
await click('.dm-clinic-remove'); await evalJs(`dash.setParams({hub: '${A.hub}', svc: ''})`); await wait(3000);
check('N-8 clinic loaded with the page (60 m from A), removed, then A picked: 0 searches', searches().length === 0, searches());
await fresh(null, '#competition');
await formSave('QA Fake Clinic', `${north(80).lat}, ${north(80).lon}`); await wait(300);
await click('.dm-clinic-edit'); await formSave('QA Fake Clinic', '45.5, -73.6'); await wait(300);
await evalJs(`dash.setParams({hub: '${A.hub}', svc: ''})`); await wait(3000);
check('N-8 clinic saved in this visit 80 m from A, then moved away, then A picked: 0 searches', searches().length === 0, searches());
await evalJs(`dash.setParams({hub: '${B.hub}', svc: ''})`); await wait(4000);
check('N-8 control: a listing 943 m away is still looked up (guard not too wide)', searches().length === 1, searches());
await go(''); await evalJs('localStorage.clear()'); events = []; await go(`?hub=${A.hub}#competition`); await wait(3000);
note('N-8 documented limit: after reopening the page with no clinic saved, A is looked up like any listing', searches().length);

// ---------- 9. N-9: one download inside the 10 s limit, credit never before the image ----------
const imgReqs = () => outside().filter((u) => !isSearch(u));
const runN9 = async (mode, label, waitMs) => {
  imageMode = mode;
  await fresh(null, '#competition');
  await evalJs(`window.__log = []; window.__t0 = performance.now(); dash.setParams({hub: '${A.hub}', svc: ''})`);
  await wait(waitMs);
  const log = await evalJs(`window.__log.map((x) => ({...x, t: Math.round(x.t - window.__t0)}))`);
  return {log, final: await evalJs(blockOf('hub-photo')), imgs: imgReqs()};
};
let r = await runN9('live', 'live', 9000);
const firstCredit = r.log.find((x) => x.credit), firstShown = r.log.find((x) => x.shown);
check('N-9 live (cache off): exactly one image download', r.imgs.length === 1, r.imgs);
check('N-9 live: photo and credit shown, credit never without the image, never broken', r.final.img && !r.final.img.hidden && r.log.every((x) => !x.credit || x.shown) && !r.log.some((x) => x.broken), {firstCredit, firstShown});
await evalJs(`dash.setParams({hub: '${B.hub}', svc: ''})`); await wait(3000);
await evalJs(`dash.setParams({hub: '${A.hub}', svc: ''})`); await wait(800);
hub = await evalJs(blockOf('hub-photo'));
check('N-9 / R9 A -> B -> A: same photo shown again, still one download of A\'s image', hub.img && !hub.img.hidden && hub.img.w > 0 && imgReqs().filter((u) => u === r.imgs[0]).length === 1, {img: hub.img, n: imgReqs().length});
r = await runN9({delayMs: 6000}, 'slow', 12000);
check('N-9 image arriving after ~6 s (inside the limit): shown with credit, one download, credit never first', r.final.img && !r.final.img.hidden && r.imgs.length === 1 && r.log.every((x) => !x.credit || x.shown), {n: r.imgs.length, text: r.final.text.slice(0, 60)});
r = await runN9({delayMs: 13000}, 'too slow', 17000);
check('N-9 image arriving after ~13 s (past the limit): "Photo not available", no image, no second download, no credit ever', !r.final.img && r.final.text === 'Photo not available · View on Google Maps' && r.imgs.length === 1 && !r.log.some((x) => x.credit), {n: r.imgs.length, text: r.final.text});
r = await runN9('fail', 'fail', 6000);
check('N-9 image fails: "Photo not available", no broken image', !r.final.img && r.final.text === 'Photo not available · View on Google Maps' && !r.log.some((x) => x.broken), r.final.text);
imageMode = 'live';

check('No console errors or warnings from page code during the whole check', allErrs.length === 0, allErrs);
await evalJs('localStorage.clear()');
fs.rmSync(TMP, {recursive: true, force: true});
await fetch(`${CDP}/json/close/${tgt.id}`);
const p = results.filter((x) => x.ok).length;
console.log(`\n${p}/${results.length} passed`);
process.exit(p === results.length ? 0 : 1);
