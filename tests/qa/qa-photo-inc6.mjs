// QA browser check, clinic photo increment 6: final accessibility / layout checks and the N-15 fix.
// Independent of the developer's tests/browser/photo-inc6.mjs, and stricter: alt text must match the clinic shown in the
// title, keyboard order is walked with real Tab key presses, the 375 px checks require the street photo to be visible.
// Needs: python3 -m http.server 8123 --directory site, and Chrome started with --headless=new --remote-debugging-port=9333.
// Run: node tests/qa/qa-photo-inc6.mjs   (uses the live Panoramax service for the Sherbrooke control listing)
// Fake clinic names only; the own photo is a coloured rectangle drawn by Chrome. Coordinates are public OSM listings or made up.
const BASE = 'http://localhost:8123/', CDP = 'http://localhost:9333';
const HUB = '?hub=45.39869,-71.93327#competition'; // public OSM listing with a known Panoramax photo (control)
const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(), errs = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); return; }
  if (j.method === 'Runtime.exceptionThrown' || (j.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(j.params.type))
    || (j.method === 'Log.entryAdded' && j.params.entry.level === 'error' && j.params.entry.source !== 'network')) errs.push(JSON.stringify(j.params).slice(0, 300));
});
const evalJs = async (e) => { const r = await send('Runtime.evaluate', {expression: e, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (expr, fn, ms = 10000) => { const t = Date.now(); let v; while (Date.now() - t < ms) { v = await evalJs(expr); if (fn(v)) return v; await wait(100); } return v; };
const results = [];
const check = (name, ok, info) => { results.push({name, ok: !!ok}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ' + JSON.stringify(info).slice(0, 400) : ''}`); };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
const go = async (q) => {
  await send('Page.navigate', {url: 'about:blank'}); await wait(150);
  await send('Page.navigate', {url: BASE + q}); await wait(300);
  await until(`!!window.dash && dash.data('dentists').status === 'ok' && dash.data('meta').status === 'ok'`, (v) => v, 20000).catch(() => {});
  await wait(600);
};
const photoReady = (name) => `(() => { const b = document.querySelector('[data-draw="${name}"]'), i = b.querySelector('img');
  return {text: b.textContent, shown: !!(i && !i.hidden && i.complete && i.naturalWidth > 0)}; })()`;
const tab = async () => { for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', {type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9}); };
/* luminance contrast of an element's text against its first opaque ancestor background */
const contrastOf = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)});
  const rgb = (s) => s.match(/[\\d.]+/g).map(Number); const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  let bg = null; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > .9) { if (c.length >= 3 && !(c.length === 4 && c[3] === 0)) { bg = c.slice(0, 3); break; } } }
  bg = bg || [255, 255, 255]; const fg = rgb(getComputedStyle(el).color).slice(0, 3); const a = lum(fg), b = lum(bg);
  return {fg: fg.join(','), bg: bg.join(','), ratio: Math.round(100 * (Math.max(a, b) + .05) / (Math.min(a, b) + .05)) / 100}; })()`;

// 1. Street photo: alt names the clinic shown in the title; credit, date, note, link (AC-6.1 to 6.3, AC-7.3, AC-4.2)
await go(HUB);
await until(photoReady('hub-photo'), (v) => v.shown || v.text.startsWith('Photo not available'), 15000);
let s = await evalJs(`(() => { const b = document.querySelector('[data-draw="hub-photo"]'), i = b.querySelector('img'), a = [...b.querySelectorAll('a')];
  return {title: document.querySelector('[data-draw="hub-name"]').textContent, alt: i && i.alt, text: b.textContent,
    links: a.map((x) => ({t: x.textContent, target: x.target, rel: x.rel, href: x.href.slice(0, 60)}))}; })()`);
const clinicName = s.title.replace(/^Competition around /, '');
check('AC-7.3 street photo alt is exactly "Street view of " + the clinic name in the title', s.alt === `Street view of ${clinicName}` && clinicName.length > 2, {alt: s.alt, title: s.title});
check('AC-6.1/6.2 credit "Photo: ... via Panoramax, <licence> · Photo taken <Month YYYY>"', /Photo: .*via Panoramax, \S+ · Photo taken [A-Z][a-z]+ \d{4}/.test(s.text), s.text.slice(0, 200));
check('AC-6.3 note text exact', s.text.includes('The photo shows the location, not necessarily the clinic’s current sign.') || s.text.includes("The photo shows the location, not necessarily the clinic's current sign."), s.text.slice(0, 300));
check('AC-4.2 every link in the photo block opens a new tab with noopener noreferrer', s.links.length >= 2 && s.links.every((l) => l.target === '_blank' && /noopener/.test(l.rel) && /noreferrer/.test(l.rel)), s.links);
check('AC-4.1 "View on Google Maps" link present', s.links.some((l) => l.t === 'View on Google Maps' && l.href.startsWith('https://www.google.com/maps/search/?api=1&query=')), s.links);

// 2. 375 px, light and dark: photo visible, fits, keeps proportions, about 200 px high, readable text, colours follow theme
const themeColours = {};
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  await send('Emulation.setDeviceMetricsOverride', {width: 375, height: 800, deviceScaleFactor: 1, mobile: true});
  await go(HUB);
  const r = await until(photoReady('hub-photo'), (v) => v.shown || v.text.startsWith('Photo not available'), 15000);
  const m = await evalJs(`(() => { const b = document.querySelector('[data-draw="hub-photo"]'), i = b.querySelector('img'), ir = i.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, iw: ir.width, ih: ir.height, bw: br.width, bl: br.left, ir: ir.right,
      nat: i.naturalWidth / i.naturalHeight, fit: getComputedStyle(i).objectFit, osm: document.body.textContent.includes('© OpenStreetMap contributors')}; })()`);
  const shownRatio = m.iw / m.ih;
  check(`AC-7.2 ${theme} 375 px: street photo is visible`, r.shown, r.text.slice(0, 80));
  check(`AC-7.2 ${theme} 375 px: no horizontal scroll, photo inside the viewport`, m.sw <= m.cw && m.ir <= m.cw + 0.5, m);
  check(`AC-7.2 ${theme} 375 px: proportions kept (rendered ratio = natural ratio, or object-fit contain/cover)`, Math.abs(shownRatio - m.nat) / m.nat < 0.03 || ['contain', 'cover'].includes(m.fit), {shownRatio, nat: m.nat, fit: m.fit});
  check(`AC-7.4 ${theme}: photo height about 200 px or less`, m.ih > 20 && m.ih <= 210, m.ih);
  check(`AC-7.5 ${theme} 375 px: OpenStreetMap credit still on the page`, m.osm, '');
  const c = await evalJs(contrastOf('[data-draw="hub-photo"]'));
  themeColours[theme] = c;
  check(`AC-7.1 ${theme}: photo block text contrast at least 4.5`, c.ratio >= 4.5, c);
}
check('AC-7.1 photo block colours change with the theme', themeColours.light.fg !== themeColours.dark.fg && themeColours.light.bg !== themeColours.dark.bg, themeColours);
await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'light'}]});
await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 900, deviceScaleFactor: 1, mobile: false});

// 3. Own photo + N-15: clinic saved at whole-number coordinates, rename only, photo kept (fake data)
await go('#clinic');
await evalJs(`(async () => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 400, 300);
  localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Whole Clinic', lat: 46, lon: -71}));
  localStorage.setItem('dm-clinic-photo', JSON.stringify({key: dmPhoto.ownKey({lat: 46, lon: -71}), img: c.toDataURL('image/jpeg', .8)})); })()`);
await go('#clinic');
let own = await until(photoReady('clinic-photo'), (v) => v.shown, 5000);
let card = await evalJs(`(() => { const b = document.querySelector('[data-draw="clinic-photo"]'); return {alt: b.querySelector('img') && b.querySelector('img').alt, text: b.textContent,
  add: document.querySelector('.dm-own-add').textContent, note: document.querySelector('.dm-own').textContent}; })()`);
check('AC-7.3 own photo alt is exactly "Your photo of QA Fake Whole Clinic"', own.shown && card.alt === 'Your photo of QA Fake Whole Clinic', card);
check('AC-6.4 own photo labelled "Your photo", not a source credit', card.text.includes('Your photo') && !/via (Panoramax|Mapillary)/.test(card.text), card.text);
check('AC-5.1/5.4 "Replace photo" and "Saved in this browser only." shown', card.add === 'Replace photo' && card.note.includes('Saved in this browser only.'), card);

// keyboard: real Tab presses from the top of the page; the file input is never focused, the card controls are reached in order
await evalJs(`document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0)`);
const seen = [];
for (let k = 0; k < 400; k++) {
  await tab();
  const a = await evalJs(`(() => { const e = document.activeElement; if (!e || e === document.body) return null;
    return {cls: e.className || '', tag: e.tagName, txt: (e.textContent || '').trim().slice(0, 30), type: e.type || '', inCard: !!e.closest('#clinic-card') || !!e.closest('.dm-own') || !!e.closest('[data-draw="clinic-photo"]')}; })()`);
  if (!a) continue;
  if (seen.length && seen[0].cls === a.cls && seen[0].txt === a.txt && seen.length > 5) break; // wrapped around
  seen.push(a);
}
const idx = (f) => seen.findIndex(f);
const iMaps = idx((a) => a.inCard && a.txt === 'View on Google Maps'), iRep = idx((a) => /dm-own-add/.test(a.cls)), iRem = idx((a) => /dm-own-remove/.test(a.cls));
check('AC-7 keyboard: the file input is never focused by Tab', !seen.some((a) => a.type === 'file'), seen.filter((a) => a.type === 'file'));
check('AC-7 keyboard: card "View on Google Maps", "Replace photo", "Remove photo" reached in that order', iMaps >= 0 && iRep > iMaps && iRem > iRep, {iMaps, iRep, iRem, n: seen.length});

// N-15: "Change" then save with only a new name
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(300);
const filled = await evalJs(`document.querySelector('.dm-clinic-form').elements.spot.value`);
check('N-15 "Change" fills "46.0, -71.0" for a whole-number clinic', filled === '46.0, -71.0', filled);
await evalJs(`(() => { const fm = document.querySelector('.dm-clinic-form'); fm.elements.name.value = 'QA Fake Renamed Clinic'; fm.requestSubmit(); })()`);
own = await until(photoReady('clinic-photo'), (v) => v.shown, 5000);
const after = await evalJs(`({c: JSON.parse(localStorage.getItem('dm-clinic')), p: !!localStorage.getItem('dm-clinic-photo'), bad: [...document.querySelectorAll('.dm-clinic-bad')].some((e) => !e.hidden),
  alt: (document.querySelector('[data-draw="clinic-photo"] img') || {}).alt})`);
check('N-15 rename-only saved, same location, photo kept, no "No location found"', after.c.name === 'QA Fake Renamed Clinic' && after.c.lat === 46 && after.c.lon === -71 && after.p && !after.bad && own.shown && after.alt === 'Your photo of QA Fake Renamed Clinic', after);
// moving the location still drops the photo (N-15 must not have weakened AC-2.2)
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(300);
await evalJs(`(() => { const fm = document.querySelector('.dm-clinic-form'); fm.elements.spot.value = '46.5, -71.0'; fm.requestSubmit(); })()`); await wait(500);
const moved = await evalJs(`({p: localStorage.getItem('dm-clinic-photo'), text: document.querySelector('[data-draw="clinic-photo"]').textContent})`);
check('AC-2.2 changing the location still deletes the own photo', moved.p === null && moved.text.startsWith('Photo not available'), moved);
await evalJs(`localStorage.clear()`);

check('AC-7.5 no console errors or warnings during the whole check', errs.length === 0, errs.slice(0, 3));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await fetch(`${CDP}/json/close/${tgt.id}`).catch(() => {});
ws.close();
process.exitCode = failed ? 1 : 0;
