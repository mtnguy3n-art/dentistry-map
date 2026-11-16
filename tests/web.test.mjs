// Clinic website link rules (iteration 2, increment 2). Run with: node --test
// Fake clinics, fake websites, fake addresses and made-up coordinates only.
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../site/assets/photo.js');
await import('../site/assets/web.js');
const W = globalThis.dmWeb;

const C = {lat: 46.8, lon: -71.2};
const at = (m, deg, from = C) => {
  const R = 6371000, b = deg * Math.PI / 180, la = from.lat * Math.PI / 180, lo = from.lon * Math.PI / 180, d = m / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI};
};

// ---- WR1b: safety check in the page ----

test('WR1b: http and https addresses with a dotted host are kept as they are', () => {
  for (const u of ['https://www.cliniquexyz.ca/fr/accueil', 'http://xyz.ca', 'HTTPS://Fictive.CA', 'https://xyz.ca:8080/a',
    'https://fictive.ca/#@x', 'https://m.facebook.com/fakeclinic', 'https://192.0.2.1/', 'https://fictive.ca.',
    'https://ma-clinique.fictive.ca/?a=1&b=2', 'https://xyz.ca:65535/', 'https://xyz.ca:1']) assert.equal(W.safeUrl(u), u, u);
});

test('WR1b / AC-13.1: other schemes, e-mails, text and empty values are not links', () => {
  for (const u of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' https://xyz.ca', 'https://xyz.ca ', 'java\tscript:alert(1)',
    'data:text/html,hi', 'mailto:info@xyz.ca', 'tel:+15555550100', 'ftp://xyz.ca', '//xyz.ca', 'xyz.ca', 'www.xyz.ca',
    'http:/xyz.ca', 'https:xyz.ca', 'http:\\\\xyz.ca', 'info@xyz.ca', 'Clinique XYZ', 'https://', 'https:///xyz.ca',
    'https://xyz', 'https://[::1]/', 'https://fictivé.ca', 'https://fic tive.ca', 'https://xyz.ca/\x07bell', 'https://xyz.ca\x00',
    '', null, undefined, 42, {}, ['https://xyz.ca'], 'https://' + 'a'.repeat(495) + '.ca']) assert.equal(W.safeUrl(u), '', String(u));
});

test('WR1b / AC-13.4: a user name or password part is refused', () => {
  for (const u of ['https://good.ca@evil.com', 'https://user:pw@xyz.ca/', 'https://good.ca%40evil.com@x.ca', 'https://xyz.ca\\@evil.com'])
    assert.equal(W.safeUrl(u), '', u);
});

test('QA-W1: hosts with empty or dash-only parts are refused', () => {
  for (const u of ['https://.', 'https://..', 'https://-.-', 'https://a..ca', 'https://.ca', 'https://-xyz.ca', 'https://xyz-.ca', 'https://a.'])
    assert.equal(W.safeUrl(u), '', u);
});

test('QA-W2: port must be ASCII digits from 1 to 65535; siteName and safeUrl never throw', () => {
  for (const u of ['https://xyz.ca:²', 'https://xyz.ca:٣', 'https://xyz.ca:0', 'https://xyz.ca:65536', 'https://xyz.ca:99999',
    'https://xyz.ca:', 'https://xyz.ca:-1', 'https://xyz.ca:80:80', 'https://xyz.ca:abc']) {
    assert.doesNotThrow(() => W.safeUrl(u)); assert.doesNotThrow(() => W.siteName(u));
    assert.equal(W.safeUrl(u), '', u); assert.equal(W.siteName(u), '', u);
  }
});

// ---- WR2: site name ----

test('WR2: site name is the host, lower case, without "www.", port, path or query (spec examples)', () => {
  assert.equal(W.siteName('https://www.CliniqueXYZ.ca/fr/accueil'), 'cliniquexyz.ca');
  assert.equal(W.siteName('https://m.facebook.com/xyz'), 'm.facebook.com');
  assert.equal(W.siteName('http://xyz.ca:8080/a'), 'xyz.ca');
  assert.equal(W.siteName('https://macliniquefictive.ca?x=1#y'), 'macliniquefictive.ca');
  assert.equal(W.siteName('https://fictive.ca./'), 'fictive.ca');
  assert.equal(W.siteName('https://www.facebook.com/fakeclinic'), 'facebook.com'); // AC-13.5
});

test('WR2 / AC-13.4: the name shown is the site the link opens, never a trick part', () => {
  assert.equal(W.siteName('https://fictive.ca/#@evil.com'), 'fictive.ca');
  assert.equal(W.siteName('https://fictive.ca/evil.com'), 'fictive.ca');
  assert.equal(W.siteName('https://good.ca@evil.com'), '');
  assert.equal(W.siteName('javascript:alert(1)'), '');
  assert.equal(W.siteName(null), '');
});

// ---- WR4, WR5: search text and link ----

test('WR4: generic names are recognised, ignoring case, accents and punctuation', () => {
  for (const n of ['Dentist', 'Dental Office', 'Clinique dentaire', 'Centre Dentaire', 'CLINIQUE DENTAIRE', 'Centre de soins dentaire',
    'Dentiste', 'Denturologiste', 'The Dental Clinic', 'Dental-Care', 'Cabinet dentaire.', 'Dentistes', '', '  ']) assert.ok(W.isGeneric(n), n);
  for (const n of ['Clinique Dentaire Couture', 'Altima Dental', 'Centre Dentaire Fictif', 'Dentist 2', 'Clinique dentaire Élan'])
    assert.ok(!W.isGeneric(n), n);
});

test('WR4: named listing = name + town; generic with address = name + address + town', () => {
  assert.equal(W.searchText({name: 'Clinique Dentaire Fictive', address: '1 rue Imaginaire'}, 'Rimouski'), 'Clinique Dentaire Fictive Rimouski');
  assert.equal(W.searchText({name: 'Dentist', address: '292 Fake Road'}, "St. John's"), "Dentist 292 Fake Road St. John's");
  assert.equal(W.searchText({name: 'Dental Office', address: ''}, 'Calgary'), '');
  assert.equal(W.searchText({name: 'Clinique dentaire'}, 'Laval'), '');
});

test('WR4: empty parts are left out and spaces collapsed; town not found -> name (and address) only', () => {
  assert.equal(W.searchText({name: '  Fake   Smile  Dental '}, ''), 'Fake Smile Dental');
  assert.equal(W.searchText({name: 'Dentist', address: ' 12  Fake  Street '}, undefined), 'Dentist 12 Fake Street');
  assert.equal(W.searchText({name: 'Fake Dental', address: '1 Fake St'}, '  Sherbrooke  '), 'Fake Dental Sherbrooke');
  assert.equal(W.searchText(null, 'Laval'), '');
});

test('WR5 / AC-10.4: search link is Google with the encoded search text only', () => {
  assert.equal(W.searchUrl("Dentist 292 Fake Road St. John's"), "https://www.google.com/search?q=Dentist%20292%20Fake%20Road%20St.%20John's");
  assert.equal(W.searchUrl('Clinique Élan & Fils #2'), 'https://www.google.com/search?q=Clinique%20%C3%89lan%20%26%20Fils%20%232');
  assert.equal(W.searchUrl(''), '');
  assert.equal(W.searchUrl(null), '');
});

// ---- W10, WR6, W11: Thu's clinic and its surroundings ----

const saved = {name: 'My Test Clinic', lat: C.lat, lon: C.lon};
const A = {name: 'Ma Clinique Fictive', address: '1 rue Fausse', ...at(12, 45), web: 'https://macliniquefictive.ca'};
const B = {name: 'Fake Plaza Dental', address: '3 Fake Plaza', ...at(70, 120)};
const Cfar = {name: 'Fake Far Dental', address: '9 Fake Avenue', ...at(400, 200)};
const listings = [B, A, Cfar];

test('W10: own listing is the closest listing within 30 m of the saved clinic', () => {
  const A2 = {name: 'Fake Same Building', ...at(25, 90)};
  assert.equal(W.ownListing(saved, [A2, A, B]), A);
  assert.equal(W.ownListing(saved, [A2, B]), A2);
  assert.equal(W.ownListing(saved, [B, Cfar]), null);
  assert.equal(W.ownListing(null, listings), null);
  assert.equal(W.ownListing(saved, null), null);
  assert.equal(W.ownListing({name: 'Bad', lat: null, lon: null}, listings), null);
  assert.equal(W.ownListing(saved, [null, {name: 'No spot'}, A]), A);
});

test('WR6 spec example: 12 m listing with a website, 70 m without, 400 m without', () => {
  const card = W.cardLink(saved, listings);
  assert.deepEqual([card.kind, card.label, card.url], ['site', 'Website: macliniquefictive.ca', 'https://macliniquefictive.ca']);
  const mine = W.linkFor({...saved, mine: true}, {saved, listings, town: 'Québec'});
  assert.deepEqual([mine.kind, mine.label], ['site', 'Website: macliniquefictive.ca']);
  const a = W.linkFor(A, {saved, listings, town: 'Québec'}); // her listing chosen from the suggestions
  assert.deepEqual([a.kind, a.label], ['site', 'Website: macliniquefictive.ca']);
  assert.equal(W.linkFor(B, {saved, listings, town: 'Québec'}).kind, 'none');
  const c = W.linkFor(Cfar, {saved, listings, town: 'Québec'});
  assert.deepEqual([c.kind, c.note, c.label, c.aria], ['search', 'Website not listed', 'Search the web', 'Search the web for Fake Far Dental']);
  assert.equal(c.url, 'https://www.google.com/search?q=Fake%20Far%20Dental%20Qu%C3%A9bec');
});

test('AC-11.2: card and own centre never show a search or "not listed"; nothing when the listing has no website', () => {
  const noWeb = [{...A, web: undefined}, B];
  assert.equal(W.cardLink(saved, noWeb).kind, 'none');
  assert.equal(W.linkFor({...saved, mine: true}, {saved, listings: noWeb, town: 'Québec'}).kind, 'none');
  assert.equal(W.linkFor(noWeb[0], {saved, listings: noWeb}).kind, 'none'); // her listing, no website, near her: nothing
  assert.equal(W.cardLink(saved, [B, Cfar]).kind, 'none'); // saved by a Google Maps link, no listing within 30 m
  assert.equal(W.cardLink(null, listings).kind, 'none');
  assert.equal(W.cardLink(saved, [{...A, web: 'javascript:alert(1)'}]).kind, 'none');
});

test('W11: a neighbour within 100 m shows its own website if it has one, otherwise nothing', () => {
  const withWeb = {...B, web: 'https://www.fakeplaza.ca/'};
  assert.deepEqual([W.linkFor(withWeb, {saved, listings}).kind, W.linkFor(withWeb, {saved, listings}).label], ['site', 'Website: fakeplaza.ca']);
  assert.equal(W.linkFor({name: 'Fake Edge', ...at(99, 10)}, {saved, listings, town: 'Québec'}).kind, 'none');
  assert.equal(W.linkFor({name: 'Fake Edge', ...at(101, 10)}, {saved, listings, town: 'Québec'}).kind, 'search');
});

test('W11 / N-8: no search near a clinic location saved earlier this visit', () => {
  const old = {lat: 45.5, lon: -73.6}, near = {name: 'Fake Old Neighbour', address: '5 Fake Rd', ...at(60, 0, old)};
  assert.equal(W.linkFor(near, {saved: null, guard: [old], town: 'Laval'}).kind, 'none');
  assert.equal(W.linkFor(near, {saved: null, guard: [], town: 'Laval'}).kind, 'search');
  assert.equal(W.linkFor(near, {saved: null, guard: 'not a list', town: 'Laval'}).kind, 'search');
});

test('2.1.1: other clinics -> website, search, or "Website not listed" for a generic name with no address', () => {
  const ctx = {saved: null, listings: [], town: 'Calgary'};
  const s = W.linkFor({name: 'Fake Smile', ...at(5000, 0), web: 'https://www.FakeSmile.ca/fr'}, ctx);
  assert.deepEqual(s, {kind: 'site', url: 'https://www.FakeSmile.ca/fr', label: 'Website: fakesmile.ca', aria: 'Website: fakesmile.ca', note: ''});
  const g = W.linkFor({name: 'Dentist', address: '292 Fake Road', ...at(5000, 0)}, ctx);
  assert.equal(g.url, 'https://www.google.com/search?q=Dentist%20292%20Fake%20Road%20Calgary');
  assert.equal(g.aria, 'Search the web for Dentist');
  const l = W.linkFor({name: 'Dental Office', ...at(5000, 0)}, ctx);
  assert.deepEqual([l.kind, l.url, l.note], ['listed', '', 'Website not listed']);
  const bad = W.linkFor({name: 'Fake Bad Web', ...at(5000, 0), web: 'https://.'}, ctx); // unsafe stored value -> as if none
  assert.equal(bad.kind, 'search');
});

test('2.1.1 / AC-9.4: no clinic or no usable location -> none; ctx may be missing', () => {
  assert.equal(W.linkFor(null).kind, 'none');
  assert.equal(W.linkFor({name: 'Fake', lat: null, lon: null}).kind, 'none');
  assert.equal(W.linkFor({name: 'Fake Lone Dental', ...at(5000, 0)}).kind, 'search');
  assert.equal(W.linkFor({name: 'Fake Lone Dental', ...at(5000, 0)}, null).kind, 'search');
});

test('AC-10.4 / W6: the search link never holds anything about Thu\'s saved clinic', () => {
  const secret = {name: 'Zzsecret Test Clinic', lat: C.lat, lon: C.lon};
  for (const deg of [0, 90, 180, 270]) for (const m of [0, 15, 50, 99]) {
    const r = W.linkFor({name: 'Fake Neighbour', address: '1 Fake St', ...at(m, deg)}, {saved: secret, listings, town: 'Québec'});
    assert.notEqual(r.kind, 'search', `${m} m`);
  }
  const far = W.linkFor({...Cfar, mine: false}, {saved: secret, listings, town: 'Québec'});
  assert.ok(!far.url.includes('Zzsecret') && !far.url.includes('46.8'));
});

// ---- Fix round 1: QA-W5, QA-W4, QA-W3, PM decision on WR4 ----

test('QA-W5 / AC-9.3: another clinic within 30 m of Thu\'s clinic never gets her website', () => {
  const mineA = {...C, name: 'Ma Clinique Fictive', web: 'https://macliniquefictive.ca'};
  const nb = {...at(20, 0), name: 'Clinique Voisine Fictive', web: 'https://voisinefictive.ca'};
  const nbNoWeb = {...at(20, 0), name: 'Clinique Voisine Fictive Deux'};
  // QA's reproduction: B 20 m away with its own website shows its own website
  const r1 = W.linkFor(nb, {saved, listings: [mineA, nb]});
  assert.deepEqual([r1.kind, r1.label, r1.url], ['site', 'Website: voisinefictive.ca', 'https://voisinefictive.ca']);
  // without a website: nothing (W11, no search near Thu), never her website
  assert.equal(W.linkFor(nbNoWeb, {saved, listings: [mineA, nbNoWeb]}).kind, 'none');
  // Thu's listing without website, neighbour with one: the neighbour keeps its own website
  const r3 = W.linkFor(nb, {saved, listings: [{...mineA, web: undefined}, nb]});
  assert.equal(r3.label, 'Website: voisinefictive.ca');
  // "Use your clinic" centre (marked mine) and the saved clinic itself: her W10 listing's website, as in the card
  assert.equal(W.linkFor({...saved, mine: true}, {saved, listings: [mineA, nb]}).url, 'https://macliniquefictive.ca');
  assert.equal(W.linkFor(saved, {saved, listings: [mineA, nb]}).url, 'https://macliniquefictive.ca');
  // her listing chosen from the suggestions: its own website, which is the card's
  assert.equal(W.linkFor(mineA, {saved, listings: [mineA, nb]}).url, 'https://macliniquefictive.ca');
});

test('QA-W4: searchUrl and linkFor never throw on lone surrogates; the bad halves are dropped', () => {
  for (const t of ['Clinique \ud800', '\udc00 Fake', 'a\ud800\ud800b', '\ud800']) {
    assert.doesNotThrow(() => W.searchUrl(t));
  }
  assert.equal(W.searchUrl('Clinique \ud800'), 'https://www.google.com/search?q=Clinique');
  assert.equal(W.searchUrl('\ud800'), '');
  assert.equal(W.searchUrl('Fake \ud83d\ude00 Dental'), 'https://www.google.com/search?q=Fake%20%F0%9F%98%80%20Dental'); // a whole pair is kept
  const r = W.linkFor({...at(5000, 0), name: 'Clinique Fictive \ud800', address: '1 rue \udc00'}, {town: 'L\u00e9vis\ud800'});
  assert.deepEqual([r.kind, r.url, r.aria], ['search', 'https://www.google.com/search?q=Clinique%20Fictive%20L%C3%A9vis', 'Search the web for Clinique Fictive']);
});

test('QA-W3: numeric last host part refused unless a plain IPv4 address; U+0085 and U+FEFF refused', () => {
  for (const u of ['https://999.999.999.999', 'https://fictive.123', 'https://a.9', 'https://1.2.3', 'https://256.1.1.1',
    'https://010.1.1.1', 'https://0x7f.1', 'https://a.0x7f', 'https://fictive.ca/\u0085', 'https://fictive.ca/\ufeff',
    'https://fictive.ca/\u00a0', 'https://fictive.ca/\u2028']) assert.equal(W.safeUrl(u), '', u);
  for (const u of ['https://192.0.2.1', 'https://0.0.0.0/x', 'https://fictive.ca/\u00e9', 'https://123.fictive.ca'])
    assert.equal(W.safeUrl(u), u, u);
});

test('WR4 (PM decision, fix round 1): plurals and English generic names are generic too', () => {
  for (const n of ['Cliniques dentaires', 'Soins dentaires', 'Centre de soins dentaires', 'Denture Clinic', 'Denture Centre',
    'Dentures', 'Family Dentistry', 'Family Dental', 'Family Dental Care', 'Dentisterie familiale', 'Clinique dentaire familiale',
    'Denturiste', 'Family Dental Clinics']) assert.ok(W.isGeneric(n), n);
  for (const n of ['Fake Family Dentistry', 'Denture Clinic Fictive', 'Cliniques dentaires Fictives']) assert.ok(!W.isGeneric(n), n);
  assert.equal(W.searchText({name: 'Denture Clinic', address: '7 Fake Street'}, 'Calgary'), 'Denture Clinic 7 Fake Street Calgary');
  assert.equal(W.searchText({name: 'Family Dentistry'}, 'Calgary'), '');
});
