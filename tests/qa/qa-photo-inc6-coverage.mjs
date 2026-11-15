// QA increment 6: independent spot-check of the Panoramax 0/20 coverage result.
// Does NOT use the page's photo.js: builds its own bbox and query, at 50 m, 200 m and 1 km,
// against the federated catalogue (api.panoramax.xyz) and the OSM-France instance directly.
// Only public OpenStreetMap listing coordinates are sent. Run: node tests/qa/qa-photo-inc6-coverage.mjs (needs network)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dentists = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/data/dentists.json'), 'utf8'));
const pts = [
  ['Control Sherbrooke (expected photo)', 45.39869, -71.93327],
  ['Ma Santé Dentaire, Québec', 46.80909, -71.24817],
  ['Paro Chirurgie Montréal', 45.51704, -73.56813],
  ['Clinique Dentaire Rosemont, Montréal', 45.55648, -73.56143],
  ['Clinique Portland, Sherbrooke', 45.40407, -71.92002],
  ['Clinique Dentaire Touraine, Gatineau', 45.47093, -75.71808],
];
let fail = 0;
for (const [, lat, lon] of pts) {
  if (!dentists.some((d) => Math.abs(d.lat - lat) < 1e-5 && Math.abs(d.lon - lon) < 1e-5)) { console.log(`FAIL point ${lat},${lon} not in dentists.json`); fail++; }
}
const box = (lat, lon, m) => { const a = m / 111320, b = m / (111320 * Math.cos(lat * Math.PI / 180)); return [lon - b, lat - a, lon + b, lat + a].map((v) => v.toFixed(6)).join(','); };
const hosts = ['https://api.panoramax.xyz', 'https://panoramax.openstreetmap.fr'];
const count = async (host, lat, lon, m) => {
  const r = await fetch(`${host}/api/search?bbox=${box(lat, lon, m)}&limit=100`, {signal: AbortSignal.timeout(20000)});
  if (!r.ok) return `HTTP ${r.status}`;
  const j = await r.json(); return (j.features || []).length;
};
for (const [name, lat, lon] of pts) {
  const row = [];
  for (const h of hosts) for (const m of [50, 200, 1000]) { try { row.push(`${new URL(h).host.split('.')[0]}@${m}m=${await count(h, lat, lon, m)}`); } catch (e) { row.push(`${m}m=ERR ${e.name}`); } }
  console.log(`${name.padEnd(40)} ${row.join('  ')}`);
}
process.exitCode = fail ? 1 : 0;
