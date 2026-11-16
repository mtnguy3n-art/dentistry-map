// QA check, iteration 2 increment 2: the pure website-link rules in site/assets/web.js (global dmWeb).
// Independent of the developer's tests/web.test.mjs. Fake clinics, fake websites (fictive.ca, example.*),
// made-up coordinates; the only real data read is the public OpenStreetMap listing file site/data/dentists.json.
// Run from the project root: node tests/qa/qa-web-inc2.mjs   (needs .venv/bin/python for the parity part)
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await import(path.join(ROOT, 'site/assets/photo.js'));
await import(path.join(ROOT, 'site/assets/web.js'));
const W = globalThis.dmWeb;

let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) pass++; else { fail++; console.log('FAIL', label, extra); }
};
const eq = (a, b, label) => ok(Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b), label, `got ${JSON.stringify(a)} expected ${JSON.stringify(b)}`);

const C = {lat: 46.8, lon: -71.2};
const at = (m, deg, from = C) => {
  const R = 6371000, b = deg * Math.PI / 180, la = from.lat * Math.PI / 180, lo = from.lon * Math.PI / 180, d = m / R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return {lat: la2 * 180 / Math.PI, lon: lo2 * 180 / Math.PI};
};
const py = (vals) => JSON.parse(execFileSync(path.join(ROOT, '.venv/bin/python'), [path.join(ROOT, 'tests/qa/qa_web_inc2_clean.py')],
  {input: JSON.stringify(vals), maxBuffer: 1 << 28}).toString());

// ---------- 1. Real data: all stored websites pass both checks unchanged ----------
const rows = JSON.parse(readFileSync(path.join(ROOT, 'site/data/dentists.json'), 'utf8'));
const real = rows.filter((r) => 'web' in r).map((r) => r.web);
eq(real.length, 1692, 'real: 1,692 listings carry a web value');
const realPy = py(real);
let jsBad = 0, pyBad = 0, nameBad = 0;
real.forEach((u, i) => {
  if (W.safeUrl(u) !== u) jsBad++;
  if (realPy[i] !== u) pyBad++;
  const h = new URL(u).hostname.toLowerCase().replace(/\.$/, '');
  if (W.siteName(u) !== (h.startsWith('www.') ? h.slice(4) : h) || !W.siteName(u)) nameBad++;
});
eq(jsBad, 0, 'real: safeUrl keeps all 1,692 values unchanged');
eq(pyBad, 0, 'real: weblink.clean_website keeps all 1,692 values unchanged');
eq(nameBad, 0, 'real: siteName = browser host without www. for all 1,692');

// ---------- 2. Parity of the two checks on adversarial and random stored values ----------
const hand = [
  'https://.', 'https://..', 'https://-.-', 'https://a..ca', 'https://.ca', 'https://fictive.ca.', 'https://fictive.ca..',
  'https://-fictive.ca', 'https://fictive-.ca', 'https://fic--tive.ca', 'https://fictive.ca:99999', 'https://fictive.ca:65535',
  'https://fictive.ca:65536', 'https://fictive.ca:0', 'https://fictive.ca:00080', 'https://fictive.ca:²', 'https://fictive.ca:',
  'https://fictive.ca:-1', 'https://fictive.ca:+80', 'https://fictive.ca:8 0', 'https://fictive.ca/\x07', 'https://fictive.ca/\x7f',
  'https://fictive.ca/\x00', 'https://fictive.ca/\u0085', 'https://fictive.ca/ ', 'https://fictive.ca/ ',
  'https://fictive.ca/﻿', 'https://fictive.ca/​', 'https://fictive.ca/é', 'https://fictivé.ca', 'https://xn--fictiv-gva.ca',
  'https://good.ca@evil.example', 'https://good.ca%40evil.example', 'https://evil.example#@good.ca', 'https://evil.example?@good.ca',
  'https://evil.example/@good.ca', 'https://fictive.ca\\@evil.example', 'HTTPS://FICTIVE.CA', 'hTTp://fictive.ca',
  'https://192.0.2.1', 'https://999.999.999.999', 'https://fictive.123', 'https://0x7f.1', 'https://1.2.3', 'https://256.1.1.1',
  'https://[::1]', 'https://fictive.ca/' + 'a'.repeat(480), 'https://fictive.ca/' + 'a'.repeat(482),
  'javascript://fictive.ca/%0aalert(1)', 'https://fictive.ca/<script>', 'https://fictive.ca/"onmouseover="x',
  'https:///fictive.ca', 'https:/fictive.ca', 'https://fictive.ca/a;b', 'https://www.', 'https://www.ca',
];
const ALPHA = ['a', 'b', 'Z', '0', '9', '-', '.', ':', '/', '?', '#', '@', '%', '_', '~', 'é', '²', '\t', ' ', '\x01', '\\', '[', ']', '8', '0'];
let seed = 12345;
const rnd = (n) => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed % n; };
const fuzz = [];
for (let i = 0; i < 30000; i++) {
  const pre = ['https://', 'http://', 'HTTPS://', 'https://www.', 'https://a.', 'ftp://', ''][rnd(7)];
  let s = '';
  const n = 1 + rnd(14);
  for (let k = 0; k < n; k++) s += ALPHA[rnd(ALPHA.length)];
  if (rnd(3) === 0) s += ['.ca', '.com', ':80', ':0', ':65536', '/x', '.ca:443/p'][rnd(7)];
  fuzz.push(pre + s);
}
const corpus = [...new Set([...hand, ...fuzz])];
const corpusPy = py(corpus);
const disagree = [];
let thrown = 0;
corpus.forEach((s, i) => {
  let js;
  try { js = W.safeUrl(s) !== ''; } catch { thrown++; return; }
  const p = corpusPy[i];
  if (p && typeof p === 'object') { disagree.push({s, why: 'python error ' + p.error}); return; }
  const pyKeeps = p === s;
  if (js !== pyKeeps) disagree.push({s, js, py: p});
  if (js) { try { const n = W.siteName(s); if (!n) disagree.push({s, why: 'safe but no siteName'}); } catch { thrown++; } }
});
eq(thrown, 0, 'parity: safeUrl/siteName never throw on 30,000+ values');
console.log(`parity corpus: ${corpus.length} values, js accepts ${corpus.filter((s) => W.safeUrl(s)).length}, disagreements ${disagree.length}`);
for (const d of disagree.slice(0, 40)) console.log('  DIFF', JSON.stringify(d));
// Classify: QA-W3 (numeric last host label, or U+0085 / U+FEFF) is a known Low defect, reported once;
// ';' and spaces never reach the data (the refresh splits on ';' and refuses spaces); anything else fails.
const lastLabelNumeric = (s) => { const n = s.replace(/^https?:\/\//i, '').split(/[/?#]/, 1)[0].split(':')[0].replace(/\.$/, '');
  return /^[0-9]+$/.test(n.split('.').pop()) || /^0x/i.test(n.split('.').pop()); };
const cat = {numericHost: 0, c1orBom: 0, semicolonOrSpace: 0, other: 0};
for (const d of disagree) {
  if (/[;\s]/.test(d.s) && !/[\u0085\ufeff]/.test(d.s)) cat.semicolonOrSpace++;
  else if (/[\u0085\ufeff]/.test(d.s)) cat.c1orBom++;
  else if (lastLabelNumeric(d.s)) cat.numericHost++;
  else { cat.other++; console.log('  UNEXPLAINED DIFF', JSON.stringify(d)); }
}
console.log('parity disagreements by kind:', JSON.stringify(cat));
eq(cat.other, 0, 'parity: no unexplained disagreement');
ok(cat.numericHost === 0 && cat.c1orBom === 0, 'QA-W3: page and refresh agree on numeric last host label, U+0085 and U+FEFF',
  `numericHost=${cat.numericHost} c1orBom=${cat.c1orBom}`);

// ---------- 3. Never throws, odd inputs ----------
const odd = [undefined, null, 0, NaN, true, {}, [], () => 1, Symbol('x'), 10n, new String('https://fictive.ca'),
  {toString() { throw new Error('boom'); }}, '\ud800', 'https://fictive.ca/\ud800', 'x'.repeat(1e6)];
let oddThrow = 0;
for (const v of odd) {
  for (const f of ['safeUrl', 'siteName', 'isGeneric', 'searchUrl']) { try { W[f](v); } catch (e) { oddThrow++; console.log('  throws', f, String(e)); } }
  try { W.searchText({name: v, address: v}, v); } catch (e) { oddThrow++; console.log('  throws searchText', String(e)); }
  try { W.linkFor({lat: 46.8, lon: -71.2, name: v, web: v, address: v}, {town: v}); } catch (e) { oddThrow++; console.log('  throws linkFor', String(e)); }
  try { W.cardLink(v, v); W.ownListing(v, [v]); W.linkFor(v, v); } catch (e) { oddThrow++; console.log('  throws ownListing/cardLink/linkFor', String(e)); }
}
eq(oddThrow, 0, 'odd inputs: no function throws');
eq(W.safeUrl(new String('https://fictive.ca')), '', 'String object is not a website');

// ---------- 4. WR2 site name, AC-13.4 / AC-13.5 ----------
eq(W.siteName('https://www.CliniqueXYZ.ca/fr/accueil'), 'cliniquexyz.ca', 'WR2 spec example 1');
eq(W.siteName('https://m.facebook.com/xyz'), 'm.facebook.com', 'WR2 spec example 2');
eq(W.siteName('http://xyz.ca:8080/a'), 'xyz.ca', 'WR2 spec example 3');
eq(W.siteName('https://www.facebook.com/fictive'), 'facebook.com', 'AC-13.5 facebook');
eq(W.siteName('https://evil.example#@good.ca'), 'evil.example', 'AC-13.4 fragment trick shows real host');
eq(W.siteName('https://evil.example?x=@good.ca'), 'evil.example', 'AC-13.4 query trick');
eq(W.siteName('https://good.ca.evil.example/'), 'good.ca.evil.example', 'AC-13.4 subdomain trick shows full host');
eq(W.siteName('https://good.ca@evil.example'), '', 'AC-13.4 user part: no name');
eq(W.siteName('https://fictive.ca.'), 'fictive.ca', 'trailing dot dropped in name');
eq(W.siteName('https://WWW.Fictive.CA:443/'), 'fictive.ca', 'upper-case WWW and port');
eq(W.siteName('https://www2.fictive.ca'), 'www2.fictive.ca', 'only "www." is removed');
eq(W.siteName('javascript:alert(1)'), '', 'unsafe -> no name');

// ---------- 5. WR4 generic names and search text ----------
for (const n of ['Dentist', 'Dental Office', 'Clinique dentaire', 'Centre Dentaire', 'CLINIQUE-DENTAIRE', 'Clinique Dentaire.',
  'Dentisterie'.slice(0, 0) + 'Dentistes', 'Cabinet de dentiste', 'Soins dentaires'.replace('dentaires', 'dentaire'), 'Centre de soins dentaire',
  'Dental Care', 'The Dental Clinic', 'Dentiste', 'Clinique Dentaire', 'Denturologiste', 'DENTURIST', '  dentist  ', 'Dentist!', 'Centré dentaire'])
  ok(W.isGeneric(n), `WR4 generic: ${n}`);
for (const n of ['Clinique Dentaire Couture', 'Altima Dental', 'Dentist 2', 'Dr Fictif', 'Clinique Dentaire Rosemont', 'Centre Dentaire Fictif & Fils',
  'Dentisterie Fictive'])
  ok(!W.isGeneric(n), `WR4 not generic: ${n}`);
eq(W.searchText({name: 'Clinique Dentaire Couture', address: '1 rue Fictive'}, 'Rimouski'), 'Clinique Dentaire Couture Rimouski', 'WR4 named: name + town, address ignored');
eq(W.searchText({name: 'Dentist', address: '292 Freshwater Road'}, "St. John's"), "Dentist 292 Freshwater Road St. John's", 'WR4 spec example generic');
eq(W.searchText({name: 'Dentist', address: ''}, 'Rimouski'), '', 'AC-10.3 generic, no address -> nothing');
eq(W.searchText({name: 'Dentist', address: '   '}, 'Rimouski'), '', 'AC-10.3 generic, blank address -> nothing');
eq(W.searchText({name: '  Clinique   Fictive ', address: ''}, '  Lévis  '), 'Clinique Fictive Lévis', 'spaces collapsed, accents kept');
eq(W.searchText({name: 'Clinique Fictive', address: ''}, ''), 'Clinique Fictive', 'town not found -> name only');
const su = W.searchUrl('Clinique Fictive & Fils #2 Lévis +test');
eq(su, 'https://www.google.com/search?q=' + encodeURIComponent('Clinique Fictive & Fils #2 Lévis +test'), 'WR5 encoded');
const u = new URL(su);
eq([...u.searchParams.keys()], ['q'], 'WR5 only the q parameter');
eq(u.searchParams.get('q'), 'Clinique Fictive & Fils #2 Lévis +test', 'WR5 q round-trips (&, #, +, accent)');
eq(W.searchUrl(''), '', 'WR5 empty text -> no link');
eq(W.searchUrl('   '), '', 'WR5 blank text -> no link');

// ---------- 6. W10 own listing, W11 / WR6 link states (geometry) ----------
const L = (m, deg, extra = {}) => ({...at(m, deg), name: 'Clinique Fictive ' + m, address: '', ...extra});
const saved = {...C, name: 'Ma Clinique Fictive Privée'};
const a12 = L(12, 0, {web: 'https://macliniquefictive.ca'});
const b70 = L(70, 90, {name: 'Clinique Voisine Fictive'});
const c400 = L(400, 180, {name: 'Clinique Loin Fictive'});
const listings = [a12, b70, c400];
eq(W.ownListing(saved, listings), a12, 'W10 12 m listing is mine');
eq(W.cardLink(saved, listings).label, 'Website: macliniquefictive.ca', 'card shows 12 m website');
eq(W.linkFor(a12, {saved, listings}).label, 'Website: macliniquefictive.ca', 'centre = my listing -> same as card');
eq(W.linkFor(b70, {saved, listings}).kind, 'none', 'WR6 70 m no website -> none');
eq(W.linkFor(c400, {saved, listings, town: 'Québec'}).kind, 'search', 'WR6 400 m -> search');
eq(W.linkFor(c400, {saved, listings, town: 'Québec'}).note, 'Website not listed', 'search state note text');
eq(W.linkFor(c400, {saved, listings, town: 'Québec'}).label, 'Search the web', 'search label text');
eq(W.linkFor(c400, {saved, listings, town: 'Québec'}).aria, 'Search the web for Clinique Loin Fictive', 'search aria text');
// closest wins, 30 m boundary
const near5 = L(5, 270, {web: 'https://plusproche.fictive.ca'});
eq(W.ownListing(saved, [a12, near5]), near5, 'W10 closest of two within 30 m');
eq(W.ownListing(saved, [L(29.5, 45)])?.name, 'Clinique Fictive 29.5', 'W10 29.5 m counts');
eq(W.ownListing(saved, [L(30.5, 45)]), null, 'W10 30.5 m does not count');
eq(W.cardLink(saved, [L(10, 0)]).kind, 'none', 'card: own listing without website -> none');
eq(W.cardLink(saved, [L(10, 0, {web: 'javascript:alert(1)'})]).kind, 'none', 'card: unsafe website -> none');
eq(W.cardLink(saved, [L(50, 0, {web: 'https://voisin.fictive.ca'})]).kind, 'none', 'card: 50 m listing is not mine');
eq(W.cardLink(null, listings).kind, 'none', 'card: nothing saved -> none');
// 100 m boundary, saved and guard
for (const [m, kind] of [[95, 'none'], [105, 'search']]) {
  eq(W.linkFor(L(m, 30), {saved, listings}).kind, kind, `W11 ${m} m from saved -> ${kind}`);
  eq(W.linkFor(L(m, 30), {saved: null, guard: [C], listings}).kind, kind, `W11 ${m} m from earlier location -> ${kind}`);
}
eq(W.linkFor(L(95, 30, {name: 'Dentist'}), {saved, listings}).kind, 'none', 'W11 generic no address near saved -> none, not "listed"');
eq(W.linkFor(L(95, 30, {web: 'https://voisin.fictive.ca'}), {saved, listings}).label, 'Website: voisin.fictive.ca', 'W11 neighbour with website keeps it');
eq(W.linkFor(L(500, 30, {name: 'Dentist'}), {saved, listings}).kind, 'listed', 'generic no address far -> listed');
eq(W.linkFor(L(500, 30, {name: 'Dentist', address: '1 rue Fictive'}), {saved, listings, town: 'Lévis'}).url,
  W.searchUrl('Dentist 1 rue Fictive Lévis'), 'generic with address far -> search with address and town');
eq(W.linkFor({...L(500, 30), mine: true}, {listings}).kind, 'none', 'centre marked mine, no saved: no search');
eq(W.linkFor(L(500, 30), {saved, guard: [null, {lat: 'x'}, {lat: 999, lon: 0}], listings}).kind, 'search', 'bad guard entries ignored');
eq(W.linkFor(L(500, 30), {saved, guard: 'not an array', listings}).kind, 'search', 'guard not an array ignored');
// string coordinates (the page data are numbers, but okPoint accepts decimal text)
eq(W.linkFor({lat: String(at(50, 0).lat), lon: String(at(50, 0).lon), name: 'Clinique Fictive'}, {saved, listings}).kind, 'none', 'string coords within 100 m -> none');
// Privacy property, random positions: never a search or "listed" within 100 m of saved or any guard point
const G2 = at(3000, 45);
let leak = 0, n = 0;
for (let i = 0; i < 4000; i++) {
  const from = i % 2 ? C : G2, m = rnd(1000) / 10;  // 0 .. 99.9 m
  const c = {...at(m, rnd(360), from), name: ['Dentist', 'Clinique Fictive', ''][rnd(3)], address: rnd(2) ? '1 rue Fictive' : ''};
  const r = W.linkFor(c, {saved: {...C}, guard: [G2], listings, town: 'Lévis'});
  n++;
  if (r.kind === 'search' || r.kind === 'listed') leak++;
  if (r.url && r.url.includes('Priv')) leak++;
}
eq(leak, 0, `privacy: 0 search/listed links in ${n} random centres within 100 m`);

// ---------- 6b. QA-W5: a different clinic in Thu's building (within 30 m) chosen as centre ----------
// AC-9.3: "Clinic A's website is never shown with clinic B's name". Fake listings 20 m apart.
{
  const mineA = {...C, name: 'Ma Clinique Fictive', web: 'https://macliniquefictive.ca'};
  const nb = {...at(20, 0), name: 'Clinique Voisine Fictive', web: 'https://voisinefictive.ca'};
  const nbNoWeb = {...at(20, 0), name: 'Clinique Voisine Fictive Deux'};
  const r1 = W.linkFor(nb, {saved, listings: [mineA, nb]});
  ok(r1.url !== mineA.web, 'QA-W5: neighbour 20 m away never shows Thu\'s website', r1.label);
  const r2 = W.linkFor(nbNoWeb, {saved, listings: [mineA, nbNoWeb]});
  ok(r2.url !== mineA.web, 'QA-W5: neighbour 20 m away without website never shows Thu\'s website', r2.label);
  ok(r2.kind === 'none', 'QA-W5: neighbour without website near Thu -> nothing (W11)', r2.kind);
  const r3 = W.linkFor({...saved, mine: true}, {saved, listings: [mineA, nb]});
  eq(r3.url, mineA.web, '"Use your clinic" centre (the saved point) shows her own listing website');
}

// ---------- 7. Real listings, no saved clinic: every listing gets a sane state ----------
const kinds = {site: 0, search: 0, listed: 0, none: 0};
let realBad = 0;
for (const r of rows) {
  const k = W.linkFor(r, {listings: rows, town: 'Ville'});
  kinds[k.kind]++;
  if (k.kind === 'site' && k.url !== r.web) realBad++;
  if (k.kind === 'search' && !k.url.startsWith('https://www.google.com/search?q=')) realBad++;
  if (k.kind === 'none') realBad++; // no saved clinic: never "none" for a real listing
  if (k.kind === 'listed' && (!W.isGeneric(r.name) || r.address)) realBad++;
}
console.log('real listings, no saved clinic:', JSON.stringify(kinds));
eq(realBad, 0, 'real listings: site = stored web, search = Google, listed only for generic without address, never none');
eq(kinds.site, 1692, 'real listings: 1,692 in Website state');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
