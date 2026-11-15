// Clinic photo block rules. Run with: node --test
// Fake clinics and made-up coordinates only.
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../site/assets/photo.js');
const {mapsUrl, view} = globalThis.dmPhoto;

test('R6: Google Maps link uses coordinates only, rounded to 5 decimals', () => {
  assert.equal(mapsUrl(45.123456789, -73.987654321), 'https://www.google.com/maps/search/?api=1&query=45.12346,-73.98765');
  assert.equal(mapsUrl(45.5, -73.5), 'https://www.google.com/maps/search/?api=1&query=45.50000,-73.50000');
});

test('AC-4.3 / D3: the link never contains the clinic name', () => {
  const v = view({name: 'Clinique Dentaire Exemple', lat: 46.81, lon: -71.21});
  assert.ok(!v.link.includes('Exemple'));
  assert.ok(v.link.startsWith('https://www.google.com/maps/search/?api=1&query='));
});

test('AC-1.3 / AC-2.3: hidden when no clinic is chosen', () => {
  assert.equal(view(null), null);
  assert.equal(view(undefined), null);
  assert.equal(view({name: 'No location'}), null);
});

test('AC-3.1 / AC-4.1: other clinic shows "Photo not available" with the link, no privacy line', () => {
  const v = view({name: 'Fake Dental Centre', lat: 46.8, lon: -71.2});
  assert.equal(v.state, 'none');
  assert.equal(v.text, 'Photo not available');
  assert.equal(v.link, 'https://www.google.com/maps/search/?api=1&query=46.80000,-71.20000');
  assert.equal(v.privacy, '');
});

test('D2: own clinic adds the privacy line', () => {
  const v = view({name: 'My Test Clinic', lat: 45.4, lon: -73.6, mine: true});
  assert.equal(v.text, 'Photo not available');
  assert.equal(v.privacy, 'Photos are not looked up automatically for your clinic, so its location stays private.');
});

// ---- QA-1: unusable coordinates keep the block hidden ----

test('QA-1: null, empty, non-finite or out-of-range coordinates keep the block hidden', () => {
  for (const [lat, lon] of [[null, null], ['', ''], [' ', -73.5], [45.5, null], [NaN, -73.5], [Infinity, 0], [45.5, -Infinity],
    ['abc', -73.5], [91, -73.5], [-90.0001, 0], [45.5, 180.0001], [45.5, -181], [91, 200], [undefined, -73.5]]) {
    assert.equal(view({name: 'Fake Dental Centre', lat, lon}), null, `lat=${lat} lon=${lon}`);
  }
});

test('QA-1: edge values and numeric strings are still accepted', () => {
  assert.equal(view({name: 'Fake Pole Clinic', lat: 90, lon: 180}).link, 'https://www.google.com/maps/search/?api=1&query=90.00000,180.00000');
  assert.equal(view({name: 'Fake Pole Clinic', lat: -90, lon: -180}).link, 'https://www.google.com/maps/search/?api=1&query=-90.00000,-180.00000');
  assert.equal(view({name: 'Fake String Clinic', lat: '46.8', lon: '-71.2'}).link, 'https://www.google.com/maps/search/?api=1&query=46.80000,-71.20000');
});

// ---- Increment 2: pure photo rules ----
const P = globalThis.dmPhoto;
// made-up clinic point, and helper to place a point at a distance (m) and compass bearing (deg) from it
const C = {lat: 46.8, lon: -71.2};
const at = (m, deg, from = C) => {
  const R = 6371000, b = deg * Math.PI / 180, la = from.lat * Math.PI / 180, lo = from.lon * Math.PI / 180, d = m / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI};
};
// a photo standing m metres away in direction deg from the clinic, with the camera turned off degrees away from the clinic
const photo = (id, m, deg, off, year, extra = {}) => ({id, ...at(m, deg), angle: ((deg + 180 + off) % 360 + 360) % 360,
  pano: false, taken: Date.UTC(year, 5, 15), ...extra});
const NOW = Date.UTC(2026, 10, 14);

test('distance and bearing', () => {
  assert.ok(Math.abs(P.dist(C.lat, C.lon, at(100, 0).lat, at(100, 0).lon) - 100) < 0.01);
  assert.ok(Math.abs(P.dist(0, 0, 0, 1) - 111195) < 1);
  assert.ok(Math.abs(P.bearing(C.lat, C.lon, at(30, 90).lat, at(30, 90).lon) - 90) < 0.01);
  assert.ok(Math.abs(P.bearing(C.lat, C.lon, at(30, 270).lat, at(30, 270).lon) - 270) < 0.01);
  assert.equal(P.angleOff(350, 10), 20);
  assert.equal(P.angleOff(10, 190), 180);
});

test('R2 spec example: A looks away, B is older than 5 years, C is chosen', () => {
  const A = photo('A', 12, 0, 80, 2024), B = photo('B', 30, 90, 20, 2016), Cc = photo('C', 40, 180, 10, 2023);
  assert.equal(P.pickPhoto([A, B, Cc], C.lat, C.lon, NOW).id, 'C');
});

test('R2: panoramas, too close, too far and looking away are rejected', () => {
  assert.equal(P.pickPhoto([photo('pano', 20, 0, 0, 2025, {pano: true})], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([photo('close', 4, 0, 0, 2025)], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([photo('far', 51, 0, 0, 2025)], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([photo('away', 20, 0, 51, 2025)], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([photo('away2', 20, 0, -51, 2025)], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([photo('noangle', 20, 0, 0, 2025, {angle: NaN})], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto([], C.lat, C.lon, NOW), null);
  assert.equal(P.pickPhoto(null, C.lat, C.lon, NOW), null);
});

test('R2: limits 5 m, 50 m and 50 degrees are inside', () => {
  assert.equal(P.pickPhoto([photo('a', 5.01, 0, 0, 2025)], C.lat, C.lon, NOW).id, 'a');
  assert.equal(P.pickPhoto([photo('b', 49.99, 0, 0, 2025)], C.lat, C.lon, NOW).id, 'b');
  assert.equal(P.pickPhoto([photo('c', 20, 0, 49.9, 2025)], C.lat, C.lon, NOW).id, 'c');
  assert.equal(P.pickPhoto([photo('d', 20, 300, -49.9, 2025)], C.lat, C.lon, NOW).id, 'd');
});

test('R2: closest wins; within 5 m the most recent wins', () => {
  assert.equal(P.pickPhoto([photo('far', 30, 0, 0, 2025), photo('near', 20, 90, 0, 2024)], C.lat, C.lon, NOW).id, 'near');
  assert.equal(P.pickPhoto([photo('near', 20, 0, 0, 2023), photo('tie', 24, 90, 0, 2025)], C.lat, C.lon, NOW).id, 'tie');
});

test('R2: only old photos -> the closest old one (AC-6.2, shown with its date)', () => {
  assert.equal(P.pickPhoto([photo('o1', 30, 0, 0, 2012), photo('o2', 15, 90, 0, 2014)], C.lat, C.lon, NOW).id, 'o2');
  const noDate = photo('nd', 15, 0, 0, 2020, {taken: NaN});
  assert.equal(P.pickPhoto([noDate], C.lat, C.lon, NOW).id, 'nd');
  assert.equal(P.pickPhoto([noDate, photo('r', 40, 90, 0, 2025)], C.lat, C.lon, NOW).id, 'r');
});

test('R1: no lookup within 100 m of the saved clinic, normal lookup further away', () => {
  const saved = {name: 'My Test Clinic', lat: C.lat, lon: C.lon};
  const own = {name: 'Fake OSM Listing', ...at(20, 45)}, plaza = {name: 'Fake Plaza Dental', ...at(70, 120)}, far = {name: 'Fake Far Dental', ...at(400, 200)};
  assert.equal(P.lookupAllowed(own, saved), false);
  assert.equal(P.lookupAllowed(plaza, saved), false);
  assert.equal(P.lookupAllowed(far, saved), true);
  assert.equal(P.lookupAllowed({name: 'Edge', ...at(99, 10)}, saved), false);
  assert.equal(P.lookupAllowed({name: 'Edge', ...at(101, 10)}, saved), true);
  assert.equal(P.lookupAllowed(far, null), true);
  assert.equal(P.lookupAllowed({...saved, mine: true}, null), false);
  assert.equal(P.lookupAllowed(null, saved), false);
  assert.equal(P.lookupAllowed({name: 'Bad', lat: null, lon: null}, saved), false);
  // the block: own listing (30 m match) gets the privacy line; the plaza neighbour does not, but is still not looked up
  assert.deepEqual([view(own, saved).privacy !== '', view(own, saved).lookup], [true, false]);
  assert.deepEqual([view(plaza, saved).privacy, view(plaza, saved).lookup], ['', false]);
  assert.deepEqual([view(far, saved).privacy, view(far, saved).lookup], ['', true]);
  // before Thu saves her clinic, her listing is treated like any other (documented limit of R1)
  assert.equal(view(own).lookup, true);
});

test('Mapillary parser: common shape, bad rows dropped, https only', () => {
  const j = {data: [
    {id: '111', thumb_1024_url: 'https://example.test/m1.jpg', captured_at: Date.UTC(2023, 5, 3), computed_compass_angle: 370, compass_angle: 12,
      geometry: {type: 'Point', coordinates: [-71.2, 46.8]}, is_pano: false, creator: {username: 'fakeuser', id: '9'}},
    {id: '222', thumb_1024_url: 'http://example.test/insecure.jpg', geometry: {type: 'Point', coordinates: [-71.2, 46.8]}},
    {id: '333', thumb_1024_url: 'javascript:alert(1)'},
    {id: '444', thumb_1024_url: 'https://example.test/m4.jpg', compass_angle: 90, is_pano: true, geometry: {coordinates: [-71.2, 46.8]}},
    null, 'junk',
  ]};
  const r = P.parseMapillary(j);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {src: 'Mapillary', url: 'https://example.test/m1.jpg', lat: 46.8, lon: -71.2, angle: 10, pano: false,
    taken: Date.UTC(2023, 5, 3), by: 'fakeuser', licence: 'CC BY-SA 4.0', page: 'https://www.mapillary.com/app/?pKey=111'});
  assert.equal(r[1].angle, 90);
  assert.equal(r[1].pano, true);
  assert.equal(r[1].by, '');
  assert.ok(Number.isNaN(r[1].taken));
  for (const bad of [null, undefined, {}, {data: 'x'}, 'oops', 42]) assert.deepEqual(P.parseMapillary(bad), []);
});

test('Panoramax parser: common shape, 360 photos marked as panoramas, licence from the source', () => {
  const j = {type: 'FeatureCollection', features: [
    {id: 'abc-1', geometry: {type: 'Point', coordinates: [-71.21, 46.81]},
      properties: {datetime: '2022-09-10T14:00:00Z', 'view:azimuth': 45, 'pers:interior_orientation': {field_of_view: 70}, license: 'etalab-2.0'},
      providers: [{name: 'Fake Contributor', roles: ['producer']}], assets: {sd: {href: 'https://example.test/p1.jpg'}}},
    {id: 'abc-2', geometry: {coordinates: [-71.21, 46.81]},
      properties: {datetime: 'not a date', 'view:azimuth': 10, 'pers:interior_orientation': {field_of_view: 360}, license: 'CC-BY-SA-4.0'},
      assets: {sd: {href: 'https://example.test/p2.jpg'}}},
    {id: 'abc-3', properties: {}, assets: {sd: {href: 'ftp://example.test/p3.jpg'}}},
    {id: 'abc-4', properties: {}, assets: {}},
  ]};
  const r = P.parsePanoramax(j);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], {src: 'Panoramax', url: 'https://example.test/p1.jpg', lat: 46.81, lon: -71.21, angle: 45, pano: false,
    taken: Date.parse('2022-09-10T14:00:00Z'), by: 'Fake Contributor', licence: 'etalab-2.0', page: 'https://api.panoramax.xyz/#focus=pic&pic=abc-1'});
  assert.equal(r[1].pano, true);
  assert.equal(r[1].by, '');
  assert.ok(Number.isNaN(r[1].taken));
  for (const bad of [null, {}, {features: {}}, 'oops']) assert.deepEqual(P.parsePanoramax(bad), []);
});

test('parsed photos feed straight into pickPhoto', () => {
  const p = at(20, 0); // photo standing 20 m north, facing south at the clinic
  const j = {data: [{id: '7', thumb_1024_url: 'https://example.test/x.jpg', captured_at: Date.UTC(2025, 0, 1), computed_compass_angle: 180,
    geometry: {coordinates: [p.lon, p.lat]}, is_pano: false}]};
  assert.equal(P.pickPhoto(P.parseMapillary(j), C.lat, C.lon, NOW).page, 'https://www.mapillary.com/app/?pKey=7');
});

test('Panoramax search box is about 50 m around the point', () => {
  const [w, s, e, n] = P.bbox(C.lat, C.lon);
  assert.ok(w < C.lon && e > C.lon && s < C.lat && n > C.lat);
  assert.ok(Math.abs(P.dist(C.lat, w, C.lat, C.lon) - 50) < 0.5);
  assert.ok(Math.abs(P.dist(n, C.lon, C.lat, C.lon) - 50) < 0.5);
});

test('R5 credit line', () => {
  const m = {src: 'Mapillary', by: 'jdupont', taken: Date.UTC(2023, 5, 3), page: 'https://www.mapillary.com/app/?pKey=1'};
  assert.equal(P.creditText(m), 'Photo: jdupont via Mapillary, CC BY-SA 4.0 · Photo taken June 2023');
  assert.deepEqual(P.credit(m), {before: 'Photo: jdupont via ', source: 'Mapillary', after: ', CC BY-SA 4.0 · Photo taken June 2023', page: 'https://www.mapillary.com/app/?pKey=1'});
  assert.equal(P.creditText({src: 'Mapillary', by: '', taken: NaN}), 'Photo via Mapillary, CC BY-SA 4.0');
  assert.equal(P.creditText({src: 'Panoramax', by: 'Fake Contributor', licence: 'etalab-2.0', taken: Date.UTC(2012, 0, 31)}),
    'Photo: Fake Contributor via Panoramax, etalab-2.0 · Photo taken January 2012');
  assert.equal(P.creditText({src: 'Panoramax', licence: 'CC-BY-SA-4.0'}), 'Photo via Panoramax, CC-BY-SA-4.0');
  assert.equal(P.credit({src: 'Panoramax', page: 'javascript:alert(1)'}).page, '');
});

// ---- Increment 3: QA-2 to QA-5 fixes ----

test('QA-2: booleans, arrays, objects and hex or exponent text are not coordinates', () => {
  for (const [lat, lon] of [[true, false], [false, false], [[], []], [[45.5], [-73.5]], [{}, {}], ['0x10', '0x20'], ['1e1', '-7e1'],
    ['0b1', '0o7'], ['45,5', '-73,5'], ['45.5abc', '-73.5'], [new Number(45), -73.5]]) {
    assert.equal(view({name: 'Fake Dental Centre', lat, lon}), null, `lat=${JSON.stringify(lat)} lon=${JSON.stringify(lon)}`);
    assert.equal(P.okPoint(lat, lon), false);
  }
  assert.equal(view({name: 'Fake Text Clinic', lat: ' +45.5 ', lon: '-73.50'}).link, 'https://www.google.com/maps/search/?api=1&query=45.50000,-73.50000');
  assert.equal(view({name: 'Fake Text Clinic', lat: '.5', lon: '-1.'}).link, 'https://www.google.com/maps/search/?api=1&query=0.50000,-1.00000');
});

test('QA-3: a photo dated in the future counts as undated: never recent, no "taken" date', () => {
  const real = photo('real', 20, 0, 0, 2025), future = photo('future', 24, 90, 0, 2099);
  assert.equal(P.pickPhoto([future, real], C.lat, C.lon, NOW).id, 'real');
  // when it is the only choice the future one is kept, but as undated
  const only = P.pickPhoto([future], C.lat, C.lon, NOW);
  assert.equal(only.id, 'future');
  assert.ok(Number.isNaN(only.taken));
  assert.equal(P.creditText({...only, src: 'Panoramax', by: '', licence: 'etalab-2.0'}, NOW), 'Photo via Panoramax, etalab-2.0');
  // a recent photo beats the undated future one even when the future one is closer
  assert.equal(P.pickPhoto([photo('f2', 10, 0, 0, 2099), photo('r2', 45, 90, 0, 2024)], C.lat, C.lon, NOW).id, 'r2');
  // credit line hides a future date even if it is given directly
  const pf = {src: 'Panoramax', by: 'Fake Person', licence: 'etalab-2.0', taken: Date.UTC(2099, 0, 15)};
  assert.equal(P.creditText(pf, NOW), 'Photo: Fake Person via Panoramax, etalab-2.0');
  // within a day of now (clock differences) is still a real date
  assert.equal(P.creditText({...pf, taken: NOW + 12 * 3600 * 1000}, NOW), 'Photo: Fake Person via Panoramax, etalab-2.0 · Photo taken November 2026');
  assert.equal(P.pickPhoto([photo('soon', 20, 0, 0, 2000, {taken: NOW + 3600 * 1000})], C.lat, C.lon, NOW).taken, NOW + 3600 * 1000);
});

test('QA-4: Panoramax photos without a licence are skipped (AC-6.1)', () => {
  const row = (id, license) => ({id, geometry: {coordinates: [-71.2, 46.8]}, properties: {'view:azimuth': 0, license},
    assets: {sd: {href: `https://example.test/${id}.jpg`}}});
  const r = P.parsePanoramax({features: [row('ok', 'CC-BY-SA-4.0'), row('none'), row('empty', ''), row('space', '  '), row('num', 4), row('obj', {name: 'x'})]});
  assert.deepEqual(r.map((x) => x.licence), ['CC-BY-SA-4.0']);
});

test('QA-5: the capture month is the Quebec month (America/Toronto), not the UTC month', () => {
  const t = (s) => P.creditText({src: 'Panoramax', by: 'Fake', licence: 'etalab-2.0', taken: Date.parse(s)}, NOW);
  assert.equal(t('2023-06-30T21:30:00-04:00'), 'Photo: Fake via Panoramax, etalab-2.0 · Photo taken June 2023'); // 01:30 UTC on July 1
  assert.equal(t('2024-01-01T03:00:00Z'), 'Photo: Fake via Panoramax, etalab-2.0 · Photo taken December 2023'); // 22:00 EST on Dec 31
  assert.equal(t('2024-01-01T06:00:00Z'), 'Photo: Fake via Panoramax, etalab-2.0 · Photo taken January 2024');
  assert.equal(P.monthYear(NaN), '');
});

// ---- Increment 3: Panoramax lookup with fake fetch and fake image loader (no network) ----
// a fake Panoramax answer with one photo standing m metres north of point c, camera facing it
const answer = (c, rows) => ({type: 'FeatureCollection', features: rows.map(([id, m, deg, off, iso, extra = {}]) => {
  const p = at(m, deg, c);
  return {id, geometry: {type: 'Point', coordinates: [p.lon, p.lat]}, providers: [{name: 'Fake Contributor'}],
    properties: {datetime: iso, 'view:azimuth': ((deg + 180 + off) % 360 + 360) % 360, 'pers:interior_orientation': {field_of_view: 70}, license: 'CC-BY-SA-4.0', ...extra},
    assets: {sd: {href: `https://example.test/${id}/sd.jpg`}}};
})});
const ok = (j) => ({ok: true, json: async () => j});
const later = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
const NOW_FN = () => NOW;

test('lookup: loading first, then the chosen photo; asks Panoramax for a 50 m box with no referrer', async () => {
  const calls = [], imgs = [];
  const L = P.createLookup({now: NOW_FN,
    fetch: async (url, opt) => { calls.push({url, opt}); return ok(answer(C, [['near', 20, 0, 0, '2025-06-01T12:00:00Z'], ['away', 15, 90, 120, '2025-06-01T12:00:00Z']])); },
    loadImage: async (url) => { imgs.push(url); return true; }});
  const first = L.get({name: 'Fake Dental Centre', ...C});
  assert.equal(first.state, 'loading');
  await first.done;
  const r = L.get({name: 'Fake Dental Centre', ...C});
  assert.equal(r.state, 'photo');
  assert.equal(r.photo.page, 'https://api.panoramax.xyz/#focus=pic&pic=near');
  assert.equal(P.creditText(r.photo, NOW), 'Photo: Fake Contributor via Panoramax, CC-BY-SA-4.0 · Photo taken June 2025');
  assert.deepEqual(imgs, ['https://example.test/near/sd.jpg']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.panoramax.xyz/api/search?bbox=${P.bbox(C.lat, C.lon).join(',')}&limit=50`);
  assert.equal(calls[0].opt.referrerPolicy, 'no-referrer');
  assert.ok(!calls[0].url.includes('Fake'), 'the clinic name is never sent');
});

test('R9: one lookup per location per visit, found or not', async () => {
  let n = 0;
  const L = P.createLookup({now: NOW_FN, fetch: async () => { n++; return ok(answer(C, [])); }, loadImage: async () => true});
  await L.get(C).done;
  assert.equal(L.get(C).state, 'none');
  assert.equal(L.get({lat: C.lat + 0.000001, lon: C.lon}).state, 'none'); // same point to 5 decimals
  assert.equal(n, 1);
});

test('AC-3.1 / AC-3.2 / AC-3.3: errors, bad answers, no candidate or a broken image give "none", never an error', async () => {
  const cases = {
    'network error': {fetch: async () => { throw new TypeError('Failed to fetch'); }},
    'HTTP 500': {fetch: async () => ({ok: false, status: 500, json: async () => ({})})},
    'rate limited': {fetch: async () => ({ok: false, status: 429})},
    'not JSON': {fetch: async () => ({ok: true, json: async () => { throw new SyntaxError('bad json'); }})},
    'odd JSON': {fetch: async () => ok({features: 'nope'})},
    'nothing suitable': {fetch: async () => ok(answer(C, [['pano', 20, 0, 0, '2025-01-01T00:00:00Z', {'pers:interior_orientation': {field_of_view: 360}}]]))},
    'no licence': {fetch: async () => ok(answer(C, [['nolic', 20, 0, 0, '2025-01-01T00:00:00Z', {license: ''}]]))},
    'image fails': {fetch: async () => ok(answer(C, [['broken', 20, 0, 0, '2025-01-01T00:00:00Z']])), loadImage: async () => false},
    'image loader throws': {fetch: async () => ok(answer(C, [['boom', 20, 0, 0, '2025-01-01T00:00:00Z']])), loadImage: async () => { throw new Error('x'); }},
  };
  for (const [name, deps] of Object.entries(cases)) {
    const L = P.createLookup({now: NOW_FN, loadImage: async () => true, ...deps});
    const e = await L.get(C).done;
    assert.equal(e.state, 'none', name);
    assert.equal(L.get(C).photo, null, name);
  }
});

test('R4: the search plus the image download stop after the time limit', async () => {
  let aborted = 0;
  const hang = (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => { aborted++; rej(new Error('aborted')); }));
  const slowSearch = P.createLookup({timeoutMs: 40, now: NOW_FN, fetch: (u, o) => hang(o.signal), loadImage: async () => true});
  const t0 = Date.now(), e1 = await slowSearch.get(C).done;
  assert.equal(e1.state, 'none');
  assert.ok(Date.now() - t0 < 1000);
  const slowImage = P.createLookup({timeoutMs: 40, now: NOW_FN, fetch: async () => ok(answer(C, [['slow', 20, 0, 0, '2025-01-01T00:00:00Z']])),
    loadImage: (u, signal) => hang(signal)});
  assert.equal((await slowImage.get(C).done).state, 'none');
  assert.equal(aborted, 2, 'pending requests are cancelled');
  assert.equal(P.LIMIT_MS, 10000);
  // an answer arriving after the limit does not bring the photo back
  const late = P.createLookup({timeoutMs: 30, now: NOW_FN, fetch: () => later(80, ok(answer(C, [['late', 20, 0, 0, '2025-01-01T00:00:00Z']]))), loadImage: async () => true});
  assert.equal((await late.get(C).done).state, 'none');
  await later(100);
  assert.equal(late.get(C).state, 'none');
});

test('AC-1.2: switching clinics quickly never shows the old clinic\'s photo for the new one', async () => {
  const A = {name: 'Fake Clinic A', ...C}, B = {name: 'Fake Clinic B', ...at(2000, 90)}, done = [];
  const L = P.createLookup({now: NOW_FN, onDone: (k) => done.push(k), loadImage: async () => true,
    fetch: (url) => (url.includes(P.bbox(A.lat, A.lon).join(','))
      ? later(60, ok(answer(A, [['photoA', 20, 0, 0, '2025-01-01T00:00:00Z']])))
      : later(5, ok(answer(B, [['photoB', 20, 0, 0, '2025-01-01T00:00:00Z']]))))});
  const a = L.get(A);                // A chosen: loading
  assert.equal(a.state, 'loading');
  const b = L.get(B);                // user switches to B before A answers
  await b.done;
  assert.equal(L.get(B).photo.page, 'https://api.panoramax.xyz/#focus=pic&pic=photoB');
  assert.equal(L.get(A).state, 'loading');
  await a.done;                      // A answers late
  assert.equal(L.get(B).photo.page, 'https://api.panoramax.xyz/#focus=pic&pic=photoB', 'B still shows its own photo');
  assert.equal(L.get(A).photo.page, 'https://api.panoramax.xyz/#focus=pic&pic=photoA', 'A is kept for later (R9)');
  assert.deepEqual(done, [L.key(B), L.key(A)]);
});

test('fail(): an image the page could not show after all turns into "none"', async () => {
  const L = P.createLookup({now: NOW_FN, fetch: async () => ok(answer(C, [['x', 20, 0, 0, '2025-01-01T00:00:00Z']])), loadImage: async () => true});
  await L.get(C).done;
  assert.equal(L.get(C).state, 'photo');
  L.fail(C);
  assert.deepEqual([L.get(C).state, L.get(C).photo], ['none', null]);
  assert.equal(L.get({lat: true, lon: []}).state, 'none');
});

test('R1: the block never asks for a lookup for Thu\'s clinic or anything within 100 m of it', () => {
  const saved = {name: 'My Test Clinic', ...C};
  assert.equal(view({...saved, mine: true}, saved).lookup, false);
  assert.equal(view({name: 'Fake Plaza Dental', ...at(99, 45)}, saved).lookup, false);
  assert.equal(view({name: 'Fake Far Dental', ...at(150, 45)}, saved).lookup, true);
});

// ---- Increment 5: own photo (R7, US-5), QA N-8 and N-9 ----

const FAKE_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const MINE = {name: 'Fake Test Clinic', lat: 46.8, lon: -71.2};

test('N-9: the lookup hands back the loaded image itself, so the page does not download it twice', async () => {
  const fakeImg = {fake: 'loaded image'};
  let loads = 0;
  const L = P.createLookup({now: NOW_FN, fetch: async () => ok(answer(C, [['near', 20, 0, 0, '2025-06-01T12:00:00Z']])),
    loadImage: async () => { loads++; return fakeImg; }});
  await L.get(C).done;
  const r = L.get(C);
  assert.equal(r.state, 'photo');
  assert.equal(r.image, fakeImg);
  assert.equal(loads, 1);
  L.fail(C);
  assert.equal(L.get(C).image, null);
  // a loader that only says "true" still works, the page then shows the image itself
  const T = P.createLookup({now: NOW_FN, fetch: async () => ok(answer(C, [['near', 20, 0, 0, '2025-06-01T12:00:00Z']])), loadImage: async () => true});
  await T.get(C).done;
  assert.equal(T.get(C).state, 'photo');
  assert.equal(T.get(C).image, null);
});

test('N-8: a location saved earlier in the visit stays private after "Remove" or "Change"', () => {
  const old = {lat: 46.8, lon: -71.2};
  const sameSpot = {name: 'Fake Old Listing', lat: 46.80005, lon: -71.2}; // about 6 m away
  const plaza = {name: 'Fake Plaza Rival', lat: 46.8006, lon: -71.2}; // about 67 m away
  const far = {name: 'Fake Far Rival', lat: 46.805, lon: -71.2}; // about 556 m away
  // after Remove: no saved clinic, but the old location is in the guard list
  assert.equal(P.view(sameSpot, null, {guard: [old]}).lookup, false);
  assert.equal(P.view(plaza, null, {guard: [old]}).lookup, false);
  assert.equal(P.view(far, null, {guard: [old]}).lookup, true);
  // after Change to a new location: both stay private
  const moved = {name: 'Fake Test Clinic', lat: 46.9, lon: -71.3};
  assert.equal(P.view(sameSpot, moved, {guard: [old, moved]}).lookup, false);
  assert.equal(P.view(far, moved, {guard: [old, moved]}).lookup, true);
  // without a guard list nothing changes (increment 3 behaviour)
  assert.equal(P.view(sameSpot, null).lookup, true);
  assert.equal(P.lookupAllowed(sameSpot, null, 'not a list'), true);
});

test('AC-5.2 / AC-2.4: own photo is shown for Thu\'s clinic only, in the card and as the centre, with its labels', () => {
  const card = P.view({...MINE, mine: true}, MINE, {own: FAKE_JPEG});
  assert.equal(card.state, 'own');
  assert.equal(card.text, 'Your photo');
  assert.equal(card.img, FAKE_JPEG);
  assert.equal(card.alt, 'Your photo of Fake Test Clinic');
  assert.equal(card.privacy, '');
  assert.equal(card.lookup, false);
  assert.equal(card.link, 'https://www.google.com/maps/search/?api=1&query=46.80000,-71.20000');
  // the same clinic as the competition centre (the 30 m match)
  const hub = P.view({name: 'Fake Test Clinic', lat: 46.80010, lon: -71.2}, MINE, {own: FAKE_JPEG});
  assert.equal(hub.state, 'own');
  // AC-5.8: a rival 70 m away never gets her photo, and is not looked up either (R1)
  const rival = P.view({name: 'Fake Plaza Rival', lat: 46.8006, lon: -71.2}, MINE, {own: FAKE_JPEG});
  assert.equal(rival.state, 'none');
  assert.equal(rival.img, '');
  assert.equal(rival.lookup, false);
  // no own photo: back to "Photo not available" with the privacy line (AC-5.5)
  const none = P.view({...MINE, mine: true}, MINE, {own: ''});
  assert.equal(none.state, 'none');
  assert.equal(none.text, 'Photo not available');
  assert.ok(none.privacy);
  // anything that is not a JPEG data address made by the page is ignored
  for (const bad of ['https://example.test/x.jpg', 'data:image/png;base64,AAAA', 'data:image/jpeg;base64,<script>', 42, null]) {
    assert.equal(P.view({...MINE, mine: true}, MINE, {own: bad}).state, 'none', String(bad));
  }
});

test('AC-2.2 / AC-5.3: the stored photo only belongs to the saved location; a new name keeps it', () => {
  const stored = {key: P.ownKey(MINE), img: FAKE_JPEG};
  assert.equal(stored.key, '46.80000,-71.20000');
  assert.equal(P.ownPhotoFor(stored, MINE), FAKE_JPEG);
  assert.equal(P.ownPhotoFor(stored, {...MINE, name: 'Fake Renamed Clinic'}), FAKE_JPEG);
  assert.equal(P.ownPhotoFor(stored, {...MINE, lat: 46.81}), '');
  assert.equal(P.ownPhotoFor(stored, null), '');
  assert.equal(P.ownPhotoFor(null, MINE), '');
  assert.equal(P.ownPhotoFor({key: stored.key, img: 'https://example.test/x.jpg'}, MINE), '');
  assert.equal(P.ownPhotoFor({key: stored.key, img: 'data:image/jpeg;base64,' + 'A'.repeat(P.OWN.maxStored)}, MINE), '');
  assert.equal(P.ownKey({lat: 'x', lon: 1}), '');
});

test('AC-5.6: only JPEG or PNG files up to 20 MB are read', () => {
  const MB = 1024 * 1024;
  assert.equal(P.ownFileProblem({name: 'front.jpg', type: 'image/jpeg', size: 3 * MB}), '');
  assert.equal(P.ownFileProblem({name: 'front.png', type: 'image/png', size: 20 * MB}), '');
  assert.equal(P.ownFileProblem({name: 'FRONT.JPEG', type: '', size: 1000}), ''); // no type given: the name decides
  assert.equal(P.ownFileProblem({name: 'front.gif', type: 'image/gif', size: 1000}), 'type');
  assert.equal(P.ownFileProblem({name: 'notes.pdf', type: 'application/pdf', size: 1000}), 'type');
  assert.equal(P.ownFileProblem({name: 'fake.jpg', type: 'text/plain', size: 1000}), 'type');
  assert.equal(P.ownFileProblem({name: 'front.heic', type: '', size: 1000}), 'type');
  assert.equal(P.ownFileProblem({name: 'huge.jpg', type: 'image/jpeg', size: 20 * MB + 1}), 'size');
  assert.equal(P.ownFileProblem({name: 'empty.jpg', type: 'image/jpeg', size: 0}), 'read');
  assert.equal(P.ownFileProblem(null), 'read');
});

test('AC-5.6: error messages start with the exact sentence from the spec and say why', () => {
  assert.equal(P.OWN_ERROR, 'This photo could not be saved in this browser.');
  for (const why of ['type', 'size', 'read', 'big', 'storage']) {
    const m = P.ownError(why);
    assert.ok(m.startsWith('This photo could not be saved in this browser. '), why);
    assert.ok(m.length > P.OWN_ERROR.length + 10, why);
  }
  assert.equal(P.ownError('type'), 'This photo could not be saved in this browser. Choose a JPEG or PNG image.');
  assert.equal(P.ownError('size'), 'This photo could not be saved in this browser. The file is larger than 20 MB. Choose a smaller photo.');
  assert.equal(P.ownError('unknown'), 'This photo could not be saved in this browser.');
});

test('R7: photos are shrunk to at most 800 px on the longer side, never enlarged', () => {
  assert.deepEqual(P.fitSize(4032, 3024), {w: 800, h: 600});
  assert.deepEqual(P.fitSize(3024, 4032), {w: 600, h: 800});
  assert.deepEqual(P.fitSize(640, 480), {w: 640, h: 480});
  assert.deepEqual(P.fitSize(10000, 10), {w: 800, h: 1});
  assert.equal(P.fitSize(0, 100), null);
  assert.equal(P.fitSize(NaN, 100), null);
});

test('R7: the JPEG is re-encoded at lower quality until it fits the storage budget, else refused', () => {
  const asked = [];
  const sized = (n) => (q) => { asked.push(q); return 'data:image/jpeg;base64,' + 'A'.repeat(Math.round(n * q)); };
  assert.equal(P.encodeWithin(sized(1000), 2000).length, 'data:image/jpeg;base64,'.length + 850);
  assert.deepEqual(asked, [0.85]);
  asked.length = 0;
  const r = P.encodeWithin(sized(1000), 600);
  assert.ok(r.length <= 600);
  assert.deepEqual(asked, [0.85, 0.7, 0.55]);
  assert.equal(P.encodeWithin(sized(1e6), 600), ''); // too big even at the lowest quality
  assert.equal(P.encodeWithin(() => 'data:image/png;base64,AAAA'), ''); // browser could not make a JPEG
  assert.equal(P.encodeWithin(() => { throw new Error('canvas blocked'); }), '');
  assert.ok(P.OWN.maxStored <= 1000000, 'well under the ~5 MB browser storage limit');
});
