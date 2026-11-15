// QA checks, clinic photo increment 2 (pure rules in site/assets/photo.js). Independent of the developer's tests.
// Not part of `node --test` (file name does not match its patterns). Run: node tests/qa/qa-photo-inc2.mjs
// Made-up coordinates and fake names only. No network.
// Updated for increment 3: Panoramax test rows carry a licence (QA-4 decision: unlicensed photos are skipped).
await import('../../site/assets/photo.js');
const P = globalThis.dmPhoto;
const results = [];
const check = (name, ok, info) => { results.push({name, ok: !!ok}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info !== undefined ? '  ' + JSON.stringify(info) : ''}`); };
const safe = (f) => { try { return {v: f()}; } catch (e) { return {err: String(e)}; } };

const C = {lat: 45.55, lon: -73.6}; // made-up clinic point (Montreal-like latitude, different from the dev tests)
const at = (m, deg, from = C) => {
  const R = 6371000, b = deg * Math.PI / 180, la = from.lat * Math.PI / 180, lo = from.lon * Math.PI / 180, d = m / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI};
};
// camera standing m metres away at compass deg from the clinic, turned off degrees away from facing it
const ph = (id, m, deg, off, taken, extra = {}) => ({id, ...at(m, deg), angle: ((deg + 180 + off) % 360 + 360) % 360, pano: false, taken, ...extra});
const NOW = Date.UTC(2026, 10, 14);
const Y = (y, mo = 5) => Date.UTC(y, mo, 15);
const pick = (cs, now = NOW) => { const r = P.pickPhoto(cs, C.lat, C.lon, now); return r ? r.id : null; };

// ---- R2 ----
check('R2 spec example (A away 80 deg, B 2016, C 2023) -> C', pick([ph('A', 12, 10, 80, Y(2024)), ph('B', 30, 100, 20, Y(2016)), ph('C', 40, 200, 10, Y(2023))]) === 'C');
check('R2 exact 5 m kept, 4.9 m dropped', pick([ph('a', 5.0001, 0, 0, Y(2025))]) === 'a' && pick([ph('b', 4.9, 0, 0, Y(2025))]) === null);
check('R2 exact 50 m kept, 50.1 m dropped', pick([ph('a', 49.999, 30, 0, Y(2025))]) === 'a' && pick([ph('b', 50.1, 30, 0, Y(2025))]) === null);
check('R2 50 deg kept both sides, 50.5 dropped', pick([ph('a', 20, 0, 49.99, Y(2025))]) === 'a' && pick([ph('b', 20, 0, -49.99, Y(2025))]) === 'b' && pick([ph('c', 20, 0, 50.5, Y(2025))]) === null);
check('R2 north wrap: camera at 350 deg facing clinic at 10 deg bearing', pick([ph('w', 20, 190, -20, Y(2025))]) === 'w');
check('R2 panorama dropped even when it is the only, closest, newest', pick([ph('p', 10, 0, 0, Y(2026), {pano: true}), ph('o', 45, 90, 0, Y(2010))]) === 'o');
check('R2 recent beats closer old', pick([ph('old', 6, 0, 0, Y(2020)), ph('new', 48, 90, 0, Y(2022))]) === 'new');
check('R2 5-year boundary: 4.9 years is recent, 5.1 is not', pick([ph('in', 40, 0, 0, NOW - 4.9 * 365.25 * 864e5), ph('out', 10, 90, 0, NOW - 5.1 * 365.25 * 864e5)]) === 'in');
check('R2 tie within 5 m -> most recent', pick([ph('n', 20, 0, 0, Y(2023)), ph('t', 24.9, 90, 0, Y(2025, 0))]) === 't');
check('R2 just outside tie (5.2 m) -> closest', pick([ph('n', 20, 0, 0, Y(2023)), ph('t', 25.2, 90, 0, Y(2025))]) === 'n');
check('R2 same date, tie -> closer', pick([ph('far', 23, 0, 0, Y(2024)), ph('near', 21, 90, 0, Y(2024))]) === 'near');
check('R2 no camera direction skipped (dev choice; spec needs direction)', pick([ph('x', 20, 0, 0, Y(2025), {angle: undefined}), ph('y', 20, 0, 0, Y(2025), {angle: '180'})]) === null);
check('R2 undated kept when nothing else', pick([ph('u', 20, 0, 0, NaN)]) === 'u');
check('R2 undated never recent: loses to a farther recent one', pick([ph('u', 8, 0, 0, undefined), ph('r', 45, 90, 0, Y(2024))]) === 'r');
check('R2 undated loses a 5 m tie to a dated old one', pick([ph('u', 20, 0, 0, NaN), ph('o', 22, 90, 0, Y(2012))]) === 'o');
const fut = pick([ph('future', 24, 0, 0, Date.UTC(2099, 0, 1)), ph('real', 20, 90, 0, Y(2025))]);
check('R2 future-dated photo (bad source data) does not beat a real recent one in a tie', fut === 'real', {picked: fut});
check('R2 does not mutate input', (() => { const a = [ph('a', 20, 0, 0, Y(2025)), ph('b', 30, 0, 0, Y(2020))]; const s = JSON.stringify(a); P.pickPhoto(a, C.lat, C.lon, NOW); return JSON.stringify(a) === s; })());
const junk = [null, undefined, 1, 'x', [], {}, {lat: null, lon: null, angle: 0}, {lat: '', lon: '', angle: 0}, {lat: 95, lon: 0, angle: 0}, {lat: C.lat, lon: C.lon, angle: Infinity}];
check('R2 junk candidates never throw and give null', safe(() => P.pickPhoto(junk, C.lat, C.lon, NOW)).v === null);
check('R2 bad clinic point gives null', [[null, null], ['', ''], [NaN, 0], [91, 0]].every(([a, b]) => P.pickPhoto([ph('a', 20, 0, 0, Y(2025))], a, b, NOW) === null));
check('R2 non-array input gives null', [null, undefined, {}, 'abc', 5].every((x) => safe(() => P.pickPhoto(x, C.lat, C.lon)).v === null));
check('R2 default now = Date.now()', P.pickPhoto([ph('a', 20, 0, 0, Date.now() - 1000)], C.lat, C.lon).id === 'a');
check('R2 photo right at clinic (0 m) dropped', pick([{id: 'z', lat: C.lat, lon: C.lon, angle: 0, pano: false, taken: Y(2025)}]) === null);
const many = Array.from({length: 5000}, (_, i) => ph('m' + i, 5 + (i % 45), i % 360, (i % 120) - 60, Y(2010 + (i % 17))));
const t0 = Date.now(); const pm = pick(many); check('R2 5000 candidates under 200 ms', Date.now() - t0 < 200 && pm !== null, {ms: Date.now() - t0});

// ---- R1 ----
const saved = {name: 'QA Fake Saved', ...C};
check('R1 spec: own listing 20 m -> no lookup, privacy line', P.lookupAllowed({...at(20, 10)}, saved) === false && P.view({name: 'x', ...at(20, 10)}, saved).privacy !== '');
check('R1 spec: plaza 70 m -> no lookup, no privacy line', P.lookupAllowed(at(70, 200), saved) === false && P.view({name: 'x', ...at(70, 200)}, saved).privacy === '');
check('R1 spec: 400 m -> lookup', P.lookupAllowed(at(400, 300), saved) === true && P.view({name: 'x', ...at(400, 300)}, saved).lookup === true);
check('R1 100 m boundary (99.9 no, 100.1 yes)', P.lookupAllowed(at(99.9, 45), saved) === false && P.lookupAllowed(at(100.1, 45), saved) === true);
check('R1 isMine 30 m boundary (29.9 yes, 30.1 no)', P.isMine(at(29.9, 0), saved) === true && P.isMine(at(30.1, 0), saved) === false);
check('R1 mine flag alone blocks lookup', P.lookupAllowed({...at(5000, 0), mine: true}, null) === false);
check('R1 saved clinic stored with string coords still guards', P.lookupAllowed(at(50, 0), {name: 's', lat: String(C.lat), lon: String(C.lon)}) === false);
check('R1 no saved clinic -> lookup for valid point', P.lookupAllowed(at(10, 0), null) === true && P.lookupAllowed(at(10, 0), undefined) === true);
const brokenSaved = safe(() => P.lookupAllowed(at(10, 0), {name: 'broken', lat: null, lon: null}));
check('R1 saved clinic with broken coords: no crash (result recorded)', !brokenSaved.err, brokenSaved);
check('R1 invalid centre never looked up', [null, {}, {lat: '', lon: ''}, {lat: 91, lon: 0}].every((c) => P.lookupAllowed(c, saved) === false));
check('R1 guard ignores longitude wrap (saved near 180, centre at -180)', P.lookupAllowed({lat: 0, lon: -179.9999}, {lat: 0, lon: 179.9999}) === false);

// ---- view (QA-1 fix) ----
const bad = [[null, null], ['', ''], [' ', 1], [NaN, 1], [Infinity, 1], [1, -Infinity], [91, 0], [-91, 0], [0, 181], [0, -181], [undefined, 0], ['abc', 0]];
check('QA-1 fix: bad coords -> null', bad.every(([lat, lon]) => P.view({name: 'x', lat, lon}) === null));
const oddTypes = [[true, false], [[], []], [[45], [-73]], ['0x10', '0x20'], ['1e1', '1e1']].filter(([lat, lon]) => P.view({name: 'x', lat, lon}) !== null);
check('QA-1 residual: booleans, arrays and hex strings are not taken as coordinates', oddTypes.length === 0, {acceptedAsCoordinates: oddTypes.map(([a, b]) => `${JSON.stringify(a)},${JSON.stringify(b)} -> ${P.view({lat: a, lon: b}).link.split('query=')[1]}`)});
check('view keeps same output for valid point', P.view({name: 'x', lat: 45.5, lon: -73.6}).link === 'https://www.google.com/maps/search/?api=1&query=45.50000,-73.60000');

// ---- parsers ----
const hostile = [null, undefined, 0, 1, true, 'str', [], {}, {data: null}, {data: {}}, {data: [[]]}, {features: null}, {features: [1, 'a', [], {}]},
  {data: [{id: {}, thumb_1024_url: {}, geometry: 'x', creator: 'x', captured_at: {}}]},
  {data: [{id: 1, thumb_1024_url: 'https://e.test/a.jpg', geometry: {coordinates: 'ab'}, creator: null, captured_at: null}]},
  {features: [{id: 1, properties: 'x', geometry: {coordinates: null}, assets: 'x', providers: 'x'}]},
  {features: [{id: 2, properties: null, assets: {sd: {href: 'https://e.test/b.jpg'}}, providers: [null, 1, {name: 5}, {name: ' '}]}]},
  {features: [{id: 3, properties: {'pers:interior_orientation': 7, datetime: {}}, assets: {sd: {href: 'https://e.test/c.jpg'}}}]}];
const thrown = [];
for (const h of hostile) for (const f of ['parseMapillary', 'parsePanoramax']) { const r = safe(() => P[f](h)); if (r.err || !Array.isArray(r.v)) thrown.push(`${f}(${JSON.stringify(h)}): ${r.err}`); }
check('Parsers never throw on hostile JSON and always return arrays', thrown.length === 0, thrown);
const evilUrls = ['http://e.test/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//e.test/a.jpg', '/a.jpg', 'ftp://e.test/a', ' https://e.test/a.jpg', 'HTTPS://E.TEST/A.JPG', 'https:/e.test/a.jpg', 'blob:https://e.test/x'];
const kept = evilUrls.map((u) => [u, P.parseMapillary({data: [{id: '1', thumb_1024_url: u}]}).map((r) => r.url)[0] || '']).filter(([, k]) => k);
check('Mapillary: only https image addresses kept', kept.every(([, k]) => /^https:/i.test(k.trim())), kept);
const keptX = evilUrls.map((u) => [u, P.parsePanoramax({features: [{id: '1', assets: {sd: {href: u}}, properties: {license: 'CC-BY-SA-4.0'}}]}).map((r) => r.url)[0] || '']).filter(([, k]) => k);
check('Panoramax: only https image addresses kept', keptX.every(([, k]) => /^https:/i.test(k.trim())), keptX);
const pg = P.parsePanoramax({features: [{id: 'a"b<c>/../?x=1#y', assets: {sd: {href: 'https://e.test/a.jpg'}}, properties: {license: 'CC-BY-SA-4.0'}}]})[0].page;
check('Panoramax page id encoded', pg === 'https://api.panoramax.xyz/#focus=pic&pic=a%22b%3Cc%3E%2F..%2F%3Fx%3D1%23y', pg);
const mpg = P.parseMapillary({data: [{id: '1&x=<y>', thumb_1024_url: 'https://e.test/a.jpg'}]})[0].page;
check('Mapillary page id encoded', mpg === 'https://www.mapillary.com/app/?pKey=1%26x%3D%3Cy%3E', mpg);
const ang = P.parseMapillary({data: [{id: '1', thumb_1024_url: 'https://e.test/a.jpg', computed_compass_angle: -30}, {id: '2', thumb_1024_url: 'https://e.test/a.jpg', computed_compass_angle: null, compass_angle: 725}, {id: '3', thumb_1024_url: 'https://e.test/a.jpg', computed_compass_angle: '90'}]}).map((r) => r.angle);
check('Mapillary angles normalised to 0..360, falls back to compass_angle, string angle not trusted', ang[0] === 330 && ang[1] === 5 && Number.isNaN(ang[2]), ang);
const mt = P.parseMapillary({data: [{id: '1', thumb_1024_url: 'https://e.test/a.jpg', captured_at: '2023-06-03T10:00:00Z'}]})[0].taken;
check('Mapillary ISO date string accepted', mt === Date.parse('2023-06-03T10:00:00Z'));
const pp = P.parsePanoramax({features: [{id: 'x', assets: {sd: {href: 'https://e.test/a.jpg'}}, properties: {license: 'CC-BY-SA-4.0', 'pers:interior_orientation': {field_of_view: '360'}}}, {id: 'y', assets: {sd: {href: 'https://e.test/a.jpg'}}, properties: {license: 'CC-BY-SA-4.0'}}]}).map((r) => r.pano);
check('Panoramax 360 as string -> pano; missing fov -> not pano', pp[0] === true && pp[1] === false, pp);
const big = {data: Array.from({length: 20000}, (_, i) => ({id: String(i), thumb_1024_url: `https://e.test/${i}.jpg`, computed_compass_angle: i % 360, geometry: {coordinates: [C.lon, C.lat]}}))};
const t1 = Date.now(); const bl = P.parseMapillary(big).length; check('Mapillary 20000 rows parsed fast', bl === 20000 && Date.now() - t1 < 500, {ms: Date.now() - t1});

// ---- R5 credit ----
check('R5 spec example text', P.creditText({src: 'Mapillary', by: 'jdupont', taken: Date.UTC(2023, 5, 3)}) === 'Photo: jdupont via Mapillary, CC BY-SA 4.0 · Photo taken June 2023');
check('R5 no name', P.creditText({src: 'Mapillary', by: '  ', taken: Date.UTC(2023, 5, 3)}) === 'Photo via Mapillary, CC BY-SA 4.0 · Photo taken June 2023');
check('R5 no date', P.creditText({src: 'Panoramax', by: 'Fake Person', licence: 'CC-BY-SA-4.0', taken: NaN}) === 'Photo: Fake Person via Panoramax, CC-BY-SA-4.0');
check('R5 Mapillary licence cannot be overridden by data', P.creditText({src: 'Mapillary', licence: 'All rights reserved'}) === 'Photo via Mapillary, CC BY-SA 4.0');
check('R5 credit link only https', P.credit({src: 'Mapillary', page: 'http://x.test'}).page === '' && P.credit({src: 'Mapillary', page: 'javascript:alert(1)'}).page === '');
// QA-4 decision (increment 3): Panoramax photos with no licence are skipped by the parser, so no credit without licence is ever shown
const noLic = [undefined, '', '   ', 42, null].map((license) => P.parsePanoramax({features: [{id: 'n', assets: {sd: {href: 'https://e.test/a.jpg'}}, properties: {license}}]}).length);
check('QA-4 Panoramax rows with no / blank / non-text licence are skipped', noLic.every((k) => k === 0), noLic);
check('QA-4 Panoramax row with a licence is kept', P.parsePanoramax({features: [{id: 'l', assets: {sd: {href: 'https://e.test/a.jpg'}}, properties: {license: 'etalab-2.0'}}]}).length === 1);
const tz = P.creditText({src: 'Panoramax', by: 'Fake', licence: 'etalab-2.0', taken: Date.parse('2023-06-30T21:30:00-04:00')});
check('R5 month for an evening photo in Quebec local time (June 30, 21:30 EDT) reads June', tz.endsWith('June 2023'), tz);
check('R5 credit text with markup stays text (no escaping needed for textContent)', P.creditText({src: 'Mapillary', by: '<img src=x onerror=alert(1)>'}).includes('<img'));

// ---- bbox ----
const [w, s, e, n] = P.bbox(C.lat, C.lon);
check('bbox order [minLon,minLat,maxLon,maxLat] about 50 m', w < e && s < n && Math.abs(P.dist(C.lat, w, C.lat, C.lon) - 50) < 0.5 && Math.abs(P.dist(n, C.lon, C.lat, C.lon) - 50) < 0.5, [w, s, e, n]);

// ---- dist / bearing sanity against independent values ----
check('dist Montreal-Quebec approx 233 km', Math.abs(P.dist(45.5017, -73.5673, 46.8139, -71.2080) / 1000 - 233) < 3, P.dist(45.5017, -73.5673, 46.8139, -71.2080));
check('bearing due east/north/south/west', [[0, 1, 90], [1, 0, 0], [-1, 0, 180], [0, -1, 270]].every(([a, b, want]) => Math.abs(P.bearing(0, 0, a, b) - want) < 1e-9));

const fail = results.filter((r) => !r.ok);
console.log(`\n${results.length - fail.length} / ${results.length} pass`);
if (fail.length) { console.log('Failed:'); fail.forEach((f) => console.log(' - ' + f.name)); }
