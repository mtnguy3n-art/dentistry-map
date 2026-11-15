// QA browser check, clinic photo increment 1. Not part of `node --test` (file name does not match its patterns).
// Needs: python3 -m http.server 8123 --directory site, and Chrome started with --headless=new --remote-debugging-port=9333.
// Run: node tests/qa/qa-photo-inc1.mjs
// Updated for increment 3: Panoramax lookups are allowed for clinics other than the saved one; other outside hosts are not.
// Fake clinic names only. Coordinates are public OpenStreetMap listings already in site/data/dentists.json.
const BASE = 'http://localhost:8123/';
const CDP = 'http://localhost:9333';

const tgt = await (await fetch(`${CDP}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, {once: true}));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', (m) => {
  const j = JSON.parse(m.data);
  if (j.id && pending.has(j.id)) { pending.get(j.id)(j); pending.delete(j.id); } else { events.push(j); if (j.method === 'Network.requestWillBeSent') everyReq.push(j.params.request.url); }
});
const everyReq = []; // all requests of the whole run (events is cleared on each load)
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id: i, method, params})); });
const evalJs = async (expr) => { const r = await send('Runtime.evaluate', {expression: expr, awaitPromise: true, returnByValue: true}); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info) => { results.push({name, ok: !!ok, info}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`); };

await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.enable');
const load = async (url) => { events.length = 0; await send('Page.navigate', {url}); await wait(2500); };
const consoleErrors = () => events.filter((e) => (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') || e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error')).map((e) => JSON.stringify(e.params).slice(0, 200));
const outside = () => events.filter((e) => e.method === 'Network.requestWillBeSent' && !/^(http:\/\/localhost:8123|data:|blob:|about:)/.test(e.params.request.url)).map((e) => e.params.request.url);

const block = (name) => `(() => { const el = document.querySelector('[data-draw="${name}"]'); const a = el.querySelector('a');
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el.querySelector('p') || el);
  return {hidden: el.hidden, visible: !el.hidden && r.height > 0, text: el.textContent, ps: el.querySelectorAll('p').length,
    href: a && a.getAttribute('href'), target: a && a.target, rel: a && a.rel, prev: el.previousElementSibling && el.previousElementSibling.tagName + ':' + el.previousElementSibling.textContent.slice(0, 60),
    color: cs.color, bg: getComputedStyle(document.body).backgroundColor, linkColor: a && getComputedStyle(a).color, imgs: el.querySelectorAll('img').length}; })()`;

const HUB = '46.75949,-70.95007';
const PRIV = 'Photos are not looked up automatically for your clinic, so its location stays private.';

// 1. No clinic chosen
await load(BASE + '#competition'); await evalJs('localStorage.clear()'); await load(BASE + '#competition');
let b = await evalJs(block('hub-photo'));
check('AC-1.3 hub photo hidden with no centre', b.hidden && !b.visible && b.text === '', b);
b = await evalJs(block('clinic-photo'));
check('AC-2.3 card photo hidden with no saved clinic (form open)', b.hidden && b.text === '', b);

// 2. Centre from shared link
await load(`${BASE}?hub=${HUB}#competition`);
const title0 = await evalJs(`document.querySelector('[data-draw="hub-name"]').textContent`);
b = await evalJs(block('hub-photo'));
check('AC-1.1 placement: block directly under "Competition around ..." title', b.visible && b.prev.startsWith('H2:Competition around'), {title: title0, prev: b.prev});
check('AC-3.1 text exactly "Photo not available" then link', b.text === 'Photo not available · View on Google Maps', b.text);
check('R6 href coords only, 5 decimals', b.href === 'https://www.google.com/maps/search/?api=1&query=46.75949,-70.95007', b.href);
check('AC-4.2 target _blank, rel noopener noreferrer', b.target === '_blank' && /noopener/.test(b.rel) && /noreferrer/.test(b.rel), {t: b.target, rel: b.rel});
check('D2 no privacy line for a non-own clinic', !b.text.includes('private') && b.ps === 1, b.ps);
check('AC-3.3 no img element (no broken icon)', b.imgs === 0);

// 3. Switch centre (AC-1.2 / AC-1.4): click a competing clinic dot on the map (dense area: the rural HUB has no competitors)
await load(`${BASE}?hub=45.52429,-73.55307#competition`);
const title = await evalJs(`document.querySelector('[data-draw="hub-name"]').textContent`);
const before = (await evalJs(block('hub-photo'))).href;
const clicked = await evalJs(`(() => { const c = [...document.querySelectorAll('#competition svg circle')].find((x) => x.style.cursor === 'pointer'); if (!c) return null; c.dispatchEvent(new MouseEvent('click', {bubbles: true})); return true; })()`);
await wait(800);
b = await evalJs(block('hub-photo'));
const title2 = await evalJs(`document.querySelector('[data-draw="hub-name"]').textContent`);
const hubParam = await evalJs(`new URLSearchParams(location.search).get('hub')`);
const [hl, hn] = hubParam.split(',').map(Number);
check('AC-1.4 map click moves centre and link follows new centre', clicked && b.href !== before && b.href.endsWith(`${hl.toFixed(5)},${hn.toFixed(5)}`) && title2 !== title, {title2, href: b.href, hubParam});

// 3b. Pick via suggestion list (AC-1.2)
await evalJs(`(() => { const i = document.getElementById('dm-hub'); i.focus(); i.value = 'cl'; i.dispatchEvent(new Event('input')); })()`);
await wait(300);
const picked = await evalJs(`(() => { const li = document.querySelector('#dm-hub-list li[role=option]'); if (!li) return null; const n = li.firstChild.textContent; li.dispatchEvent(new MouseEvent('mousedown', {bubbles: true})); return n; })()`);
await wait(800);
b = await evalJs(block('hub-photo'));
const title3 = await evalJs(`document.querySelector('[data-draw="hub-name"]').textContent`);
const hp3 = await evalJs(`new URLSearchParams(location.search).get('hub')`);
check('AC-1.2 suggestion pick: title and link match the new clinic', picked && title3 === `Competition around ${picked}` && b.href.endsWith(hp3), {picked, title3, href: b.href, hp3});

// 4. Own clinic saved (fake name, at the listing coordinates)
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Clinic', lat: 46.759491234, lon: -70.950071234}))`);
const savedAt = everyReq.length; // from here on the clinic at HUB is Thu's saved clinic (in section 2 it was not saved yet, so a lookup was allowed)
await load(`${BASE}?hub=${HUB}#competition`);
b = await evalJs(block('hub-photo'));
check('D2 privacy line when own clinic is the centre', b.text.includes(PRIV) && b.ps === 2, b.text);
check('Own clinic centre link rounded to 5 decimals', b.href === 'https://www.google.com/maps/search/?api=1&query=46.75949,-70.95007', b.href);
await load(`${BASE}#clinic`);
b = await evalJs(block('clinic-photo'));
check('AC-4.1 card: link and "Photo not available" under clinic name', b.visible && b.text.startsWith('Photo not available · View on Google Maps') && b.prev.startsWith('P:'), b);
check('D2 card privacy line', b.text.includes(PRIV));
check('Card link coords 5 decimals, no name', b.href === 'https://www.google.com/maps/search/?api=1&query=46.75949,-70.95007' && !b.href.includes('QA'), b.href);
const nameAbove = await evalJs(`document.querySelector('[data-draw="clinic-photo"]').parentElement.querySelector('h2').textContent`);
check('Card: block sits in the same column as clinic name', nameAbove === 'QA Fake Clinic', nameAbove);

// 5. "Use your clinic" (AC-2.4) — from fresh page without hub
await load(`${BASE}#competition`);
await evalJs(`(() => { const b = [...document.querySelectorAll('#competition .dm-hub-mine')][0]; b && b.click(); return !!b; })()`);
await wait(800);
b = await evalJs(block('hub-photo'));
check('AC-2.4 "Use your clinic" shows same block with privacy line', b.text.includes(PRIV) && b.href.endsWith('46.75949,-70.95007'), b.text);

// 6. Change (form open) -> hidden; Remove -> hidden
await load(`${BASE}#clinic`);
await evalJs(`document.querySelector('.dm-clinic-edit').click()`); await wait(500);
b = await evalJs(block('clinic-photo'));
check('Form open after "Change": card block hidden', b.hidden && b.text === '', b.hidden);
await evalJs(`(() => { const f = document.querySelector('.dm-clinic-form'); f.elements.name.value = 'QA Fake Clinic 2'; f.elements.spot.value = '45.50000, -73.60000'; f.requestSubmit(); })()`); await wait(600);
b = await evalJs(block('clinic-photo'));
check('AC-2.2 after saving new location, link matches new location', b.visible && b.href.endsWith('45.50000,-73.60000'), b.href);
await evalJs(`document.querySelector('.dm-clinic-remove').click()`); await wait(500);
b = await evalJs(block('clinic-photo'));
check('AC-2.3 "Remove": card block hidden', b.hidden && b.text === '', b);

// 7. Light/dark, 375 px, console, outside calls
await evalJs(`localStorage.setItem('dm-clinic', JSON.stringify({name: 'QA Fake Clinic', lat: 46.75949, lon: -70.95007}))`);
const lum = (c) => { const [r, g, bb] = c.match(/[\d.]+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * bb; };
const contrast = (a, c) => { const [x, y] = [lum(a), lum(c)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const allErr = [], allOut = [];
for (const theme of ['light', 'dark']) {
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: theme}]});
  for (const width of [1280, 375]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 800, deviceScaleFactor: 1, mobile: width < 500});
    for (const hash of ['competition', 'clinic']) {
      await load(`${BASE}?hub=${HUB}#${hash}`);
      const card = await evalJs(`(() => { const el = document.querySelector('[data-draw="${hash === 'clinic' ? 'clinic-photo' : 'hub-photo'}"]'); let n = el, bg = 'rgba(0, 0, 0, 0)'; while (n && /rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; } return {bg, note: getComputedStyle(el.querySelector('p')).color, link: getComputedStyle(el.querySelector('a')).color}; })()`);
      const sw = await evalJs(`({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})`);
      const cN = contrast(card.note, card.bg), cL = contrast(card.link, card.bg);
      check(`AC-7.1 ${theme} ${width}px #${hash}: contrast note ${cN.toFixed(2)} link ${cL.toFixed(2)} (>=4.5)`, cN >= 4.5 && cL >= 4.5, card);
      if (width === 375) check(`AC-7.2 ${theme} 375px #${hash}: no horizontal scroll`, sw.sw <= sw.cw, sw);
      allErr.push(...consoleErrors()); allOut.push(...outside());
    }
  }
}
check('AC-7.5 no console errors on any load', allErr.length === 0, allErr.slice(0, 5));
// Increment 3: lookups are legitimate now, but in section 7 the centre is always the saved own clinic, so still zero outside calls (R1)
check('R1 no outside network calls while the centre is the saved own clinic (8 loads)', allOut.length === 0, [...new Set(allOut)].slice(0, 5));
const others = everyReq.filter((u) => !/^(http:\/\/localhost:8123|data:|blob:|about:)/.test(u));
const notPx = others.filter((u) => !/^https:\/\/([a-z0-9-]+\.)*panoramax\.(xyz|fr|openstreetmap\.fr|ign\.fr)\//.test(u) && !/^https:\/\/panoramax\.[a-z0-9.-]+\//.test(u));
check('Increment 3: the only outside hosts over the whole run are Panoramax hosts', notPx.length === 0, {hosts: [...new Set(others.map((u) => new URL(u).host))], notPx: notPx.slice(0, 5)});
const ownBox = {own: '46.75949,-70.95007', requestsAfterSave: everyReq.slice(savedAt).filter((u) => /panoramax/.test(u))};
check('Increment 3: once saved, no Panoramax search ever covers the own clinic point', !everyReq.slice(savedAt).some((u) => { const m = u.match(/bbox=([-\d.,]+)/); if (!m) return false; const [w, s2, e, n] = m[1].split(',').map(Number); return 46.75949 >= s2 && 46.75949 <= n && -70.95007 >= w && -70.95007 <= e; }), ownBox);

await evalJs('localStorage.clear()');
ws.close(); await fetch(`${CDP}/json/close/${tgt.id}`);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
