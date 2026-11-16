// Website coverage of the 20 sample Québec listings (iteration 1 sample, docs/CHANGELOG.md "Clinic photo, increment 6").
// Uses the page's own rules (site/assets/web.js, linkFor) with no saved clinic, so it prints what Thu sees for each
// listing at the Competition centre: "site" (Website: ...), "search" (Website not listed · Search the web) or
// "listed" (Website not listed, generic name with no address). Offline: reads site/data/dentists.json only.
// Run: node tests/coverage/website-sample.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
await import(path.join(ROOT, 'site/assets/photo.js'));
await import(path.join(ROOT, 'site/assets/web.js'));
const W = globalThis.dmWeb;

const md = fs.readFileSync(path.join(ROOT, 'docs/CHANGELOG.md'), 'utf8');
const sample = md.split('\n').filter((l) => /^\s*\| \d+ \| (Québec City|Montréal|Regions) \|/.test(l)).slice(0, 20)
  .map((l) => l.split('|').map((x) => x.trim()).slice(1))
  .map(([n, group, town, name, at]) => ({n, group, town, name, lat: Number(at.split(',')[0]), lon: Number(at.split(',')[1])}));
if (sample.length !== 20) throw new Error(`expected 20 sample rows in the CHANGELOG, found ${sample.length}`);

const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/dentists.json'), 'utf8'));
const tally = {site: 0, search: 0, listed: 0, none: 0, missing: 0};
for (const s of sample) {
  const unnamed = s.name.startsWith('Dentist (unnamed');
  const r = D.find((x) => Math.abs(x.lat - s.lat) < 6e-5 && Math.abs(x.lon - s.lon) < 6e-5 && (unnamed || x.name === s.name));
  const k = r ? W.linkFor(r, {town: s.town, listings: D}).kind : 'missing';
  tally[k]++;
  console.log(`${s.n.padStart(2)} | ${s.group.padEnd(11)} | ${s.town.padEnd(14)} | ${s.name.padEnd(44)} | ${k}`);
}
console.log(`\nWebsite ${tally.site} · Search the web ${tally.search} · Website not listed only ${tally.listed}` +
  (tally.none || tally.missing ? ` · nothing ${tally.none} · not in the data ${tally.missing}` : ''));
