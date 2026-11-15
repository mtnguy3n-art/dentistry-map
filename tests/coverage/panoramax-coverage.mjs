// Coverage measurement, clinic photo increment 6: how many of 20 sample Québec listings get a usable Panoramax photo
// under rule R2. It uses the page's own rules from site/assets/photo.js (same search box, same parser, same pickPhoto)
// and checks that the chosen image really downloads (same 10 s limit as the page).
// Run: node tests/coverage/panoramax-coverage.mjs   (needs the network; not part of `node --test`)
// Only the coordinates of public OpenStreetMap listings (site/data/dentists.json) are sent, never a name.
// The sample is fixed: listings are sorted by name and picked at evenly spaced positions, so a re-run uses the same 20.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
await import(path.join(ROOT, 'site/assets/photo.js'));
const {panoramaxUrl, parsePanoramax, pickPhoto, dist, bearing, angleOff, monthYear, LIMIT_MS} = globalThis.dmPhoto;

const dentists = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/dentists.json'), 'utf8'));
const towns = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/municipalities.json'), 'utf8')).map((m) => [m.id, m.name]));
const quebec = dentists.filter((d) => String(d.market_id).startsWith('24')).map((d) => ({...d, town: towns[d.city_id] || d.city_id}));

/* 6 Québec City, 6 Montréal, 8 regional towns (one each) */
const PLAN = [
  {group: 'Québec City', towns: ['Québec'], n: 6},
  {group: 'Montréal', towns: ['Montréal'], n: 6},
  ...['Sherbrooke', 'Trois-Rivières', 'Gatineau', 'Drummondville', 'Rimouski', 'Shawinigan', 'Mont-Laurier', 'Magog'].map((t) => ({group: 'Regions', towns: [t], n: 1})),
];
const sample = PLAN.flatMap(({group, towns: ts, n}) => {
  const rows = quebec.filter((d) => ts.includes(d.town)).sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.lat - b.lat);
  return Array.from({length: Math.min(n, rows.length)}, (_, i) => ({...rows[Math.floor((i + 0.5) * rows.length / n)], group}));
});
if (sample.length !== 20) throw new Error(`sample has ${sample.length} listings, expected 20`);
/* control, not counted: a listing known to have a Panoramax photo, so a 0 result cannot come from a broken method */
const control = quebec.find((d) => d.lat === 45.39869 && d.lon === -71.93327);
if (!control) throw new Error('control listing not found');

const withLimit = async (fn) => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), LIMIT_MS);
  try { return await fn(ctl.signal); } finally { clearTimeout(t); }
};
const measure = async (c) => {
  const r = {group: c.group, town: c.town, name: c.name, lat: c.lat, lon: c.lon};
  try {
    await withLimit(async (signal) => {
      const res = await fetch(panoramaxUrl(c.lat, c.lon), {signal});
      if (!res.ok) { r.result = `error ${res.status}`; return; }
      const all = parsePanoramax(await res.json());
      r.near = all.length;
      const flat = all.filter((p) => !p.pano), inRange = flat.filter((p) => { const m = dist(p.lat, p.lon, c.lat, c.lon); return m >= 5 && m <= 50; });
      r.flat = flat.length; r.inRange = inRange.length;
      const p = pickPhoto(all, c.lat, c.lon);
      if (!p) { r.result = 'none'; return; }
      const img = await fetch(p.url, {signal});
      const ok = img.ok && /^image\//.test(img.headers.get('content-type') || '');
      await img.arrayBuffer();
      r.result = ok ? 'photo' : `image failed (${img.status})`;
      r.photo = {m: Math.round(dist(p.lat, p.lon, c.lat, c.lon)), off: Math.round(angleOff(p.angle, bearing(p.lat, p.lon, c.lat, c.lon))),
        taken: monthYear(p.taken), licence: p.licence, by: p.by, host: new URL(p.url).host};
    });
  } catch (e) { r.result = e.name === 'AbortError' ? 'too slow (10 s)' : `error (${e.message})`; }
  return r;
};
const results = [];
for (const c of sample) results.push(await measure(c));
const ctl = await measure({...control, group: 'Control'});

const hits = results.filter((r) => r.result === 'photo').length;
for (const r of [...results, ctl]) {
  const why = r.result === 'photo' ? `PHOTO ${r.photo.m} m, ${r.photo.off}° off, ${r.photo.taken || 'no date'}, ${r.photo.licence}, ${r.photo.host}`
    : r.result === 'none' ? `none (${r.near} Panoramax photos in the box, ${r.flat} not 360°, ${r.inRange} of those 5-50 m away)` : r.result;
  console.log(`${r.group.padEnd(11)} | ${r.town.padEnd(14)} | ${r.name.padEnd(48)} | ${r.lat.toFixed(5)},${r.lon.toFixed(5)} | ${why}`);
}
console.log(`\nUsable Panoramax photo: ${hits} of ${results.length} (${Math.round(100 * hits / results.length)} %), measured ${new Date().toLocaleDateString('en-CA', {timeZone: 'America/Toronto'})}`);
for (const g of ['Québec City', 'Montréal', 'Regions']) {
  const gr = results.filter((r) => r.group === g);
  console.log(`  ${g}: ${gr.filter((r) => r.result === 'photo').length} of ${gr.length}`);
}
console.log(`  Control (not counted), ${control.town}: ${ctl.result === 'photo' ? 'photo found, so the method works' : 'NO PHOTO: check the method or the service'}`);
if (ctl.result !== 'photo') process.exitCode = 1;
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(results, null, 1));
