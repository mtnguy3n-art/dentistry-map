// QA check, iteration 2 increment 6: N-W5 (private / loopback / link-local IPv4 refused) in both site/assets/web.js
// (safeUrl) and pipeline/work/weblink.py (clean_website), parity between them, the 1,692 real values unchanged, and an
// independent recount of the 20-sample website coverage (3 / 15 / 2) straight from the data, without linkFor.
// Fictive hosts only (fictive.ca, example.*, documentation and private IPv4 ranges); the only real data read is the
// public OpenStreetMap listing file site/data/dentists.json.
// Run from the project root: node tests/qa/qa-web-inc6.mjs   (needs .venv/bin/python)
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
await import(path.join(ROOT, 'site/assets/photo.js'));
await import(path.join(ROOT, 'site/assets/web.js'));
const W = globalThis.dmWeb;
let pass = 0, fail = 0;
const ok = (c, label, extra = '') => { if (c) pass++; else { fail++; console.log('FAIL', label, extra); } };
const py = (vals) => JSON.parse(execFileSync(path.join(ROOT, '.venv/bin/python'), [path.join(ROOT, 'tests/qa/qa_web_inc2_clean.py')],
  {input: JSON.stringify(vals), maxBuffer: 1 << 28}).toString());

// 1. Range edges: refused (private) and kept (public, just outside each range)
const refused = ['0.0.0.0', '0.255.255.255', '10.0.0.0', '10.255.255.255', '127.0.0.1', '127.255.255.254', '169.254.0.1',
  '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.168.0.1', '192.168.255.255', '127.0.0.1.', '10.0.0.1:8080'];
const kept = ['1.0.0.1', '9.255.255.255', '11.0.0.1', '126.255.255.255', '128.0.0.1', '169.253.0.1', '169.255.0.1',
  '172.15.255.255', '172.32.0.1', '192.167.0.1', '192.169.0.1', '192.0.2.1', '198.51.100.7', '203.0.113.9', '8.8.8.8',
  '10.fictive.ca', '127.fictive.ca', '192.168.fictive.ca', '169.254.example.org', '172.16.example.com', 'fictive.ca'];
const odd = ['127.1', '127.0.1', '0x7f.0.0.1', '0177.0.0.1', '2130706433', '127.0.0.0x1', '[::1]', '[::ffff:127.0.0.1]', 'localhost',
  'localhost.', '１２７.０.０.１', '%31%32%37.0.0.1', '010.0.0.1', '192.168.1', '127.000.0.1'];
const url = (h, p = '/') => `http://${h}${p}`;
const all = [...refused, ...kept, ...odd].map((h) => url(h));
const P = py(all);
for (const [i, s] of all.entries()) {
  const h = s.slice(7, -1);
  const want = kept.includes(h);
  ok((W.safeUrl(s) === s) === want, `safeUrl ${want ? 'keeps' : 'refuses'} ${h}`, W.safeUrl(s));
  ok((P[i] === s) === want, `weblink.py ${want ? 'keeps' : 'refuses'} ${h}`, JSON.stringify(P[i]));
}
// whatever is kept must never resolve in the browser's URL parser to a private / loopback address
const PRIV = /^((0|10|127)\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|\[.*|localhost)$/;
for (const s of all) if (W.safeUrl(s)) ok(!PRIV.test(new URL(s).hostname), `kept ${s} does not parse to a private host`, new URL(s).hostname);
ok(W.siteName('http://10.fictive.ca/') === '10.fictive.ca', 'siteName of 10.fictive.ca');
ok(W.linkFor({lat: 46.8, lon: -71.2, name: 'Clinique Fictive', web: 'http://192.168.0.1/'}, {town: 'Fictiveville'}).kind !== 'site',
  'linkFor never offers a private-address website');

// 2. Real data: all 1,692 values unchanged by both sides
const D = JSON.parse(readFileSync(path.join(ROOT, 'site/data/dentists.json'), 'utf8'));
const webs = D.filter((r) => r.web).map((r) => r.web);
ok(webs.length === 1692, 'real: 1,692 stored websites', webs.length);
ok(webs.every((u) => W.safeUrl(u) === u), 'real: safeUrl keeps every stored value');
const PW = py(webs);
ok(PW.every((v, i) => v === webs[i]), 'real: weblink.py keeps every stored value', PW.filter((v, i) => v !== webs[i]).slice(0, 3));
ok(webs.every((u) => !/^\d+\.\d+\.\d+\.\d+$/.test(new URL(u).hostname)), 'real: no stored value is an IPv4 address');

// 3. 20-sample coverage recount, independent of linkFor: web present -> site; else generic unnamed with no address -> listed
const md = readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8');
const rows = md.split('\n').filter((l) => /^\s*\| \d+ \| (Québec City|Montréal|Regions) \|/.test(l)).slice(0, 20);
ok(rows.length === 20, '20 sample rows');
const t = {site: 0, search: 0, listed: 0, missing: 0};
for (const l of rows) {
  const [, , , name, at] = l.split('|').map((x) => x.trim()).slice(1);
  const [la, lo] = at.split(',').map(Number);
  const r = D.find((x) => Math.abs(x.lat - la) < 6e-5 && Math.abs(x.lon - lo) < 6e-5 && (name.startsWith('Dentist (unnamed') || x.name === name));
  if (!r) { t.missing++; continue; }
  if (r.web && W.safeUrl(r.web)) t.site++;
  else if (W.isGeneric(r.name || '') && !r.address) t.listed++;
  else t.search++;
}
ok(t.site === 3 && t.search === 15 && t.listed === 2 && t.missing === 0, 'coverage 3 website / 15 search / 2 not listed', JSON.stringify(t));

console.log(`\nqa-web-inc6: ${pass} / ${pass + fail} pass`);
process.exit(fail ? 1 : 0);
