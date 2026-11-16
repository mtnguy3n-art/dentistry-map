# 04 — QA report

This file holds one section per iteration, newest first. Earlier iterations are kept as written.

- Iteration 2 (2026-11-15): link to each clinic's website (increment 6 and overall verdict on top, then increments 3 to 5, increment 2, increment 1)
- Iteration 1 (2026-11-14, live): clinic photo when a clinic is chosen

---

# Iteration 2 — Clinic website, increment 6 (final checks, coverage, README; N-W5) and overall verdict

- **Date:** 2026-11-15
- **Increment:** 6 of solution design §2.7 (iteration 2): README "Data and licences" and refresh text, CHANGELOG with the 20-sample website coverage, N-W5 (private / loopback / link-local IPv4 refused), final regression. Medium request: one focused pass on what changed since `da33d2a` (approved), plus a full regression run.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** branch `team/clinic-website`, commit `ba2344c`
- **Environment:** macOS, Node 24.22.1, Python 3.14.0 (`.venv`), headless Chrome 157 with a new empty profile, `--disk-cache-size=1` and `--host-resolver-rules="MAP probe.fictive.test 127.0.0.1"`; `python3 -m http.server 8123 --directory site`; the increment 2 build (`2bafc2d`) on 8131 for `qa-web-inc2-browser`; probe page on 8124
- **Verdict (increment 6): APPROVED** — 0 defects
- **Verdict (whole iteration 2, increments 1 to 6): APPROVED** — see §6

## 1. Automated tests (full regression, one pass)

| Suite | Result |
|---|---|
| `node --test` (developer) | 62 / 62 pass |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` (developer) | 21 / 21 pass |
| `node tests/coverage/website-sample.mjs` (developer, offline) | Website 3 · Search the web 15 · Website not listed only 2 (matches CHANGELOG) |
| `node tests/qa/qa-web-inc6.mjs` (QA, **new**: N-W5 both sides, parity, real data, independent 20-sample recount) | 129 / 129 pass |
| `node tests/qa/qa-web-inc2.mjs` | 92 / 92 pass |
| `tests/qa/qa_web_inc1_adversarial.py`, `qa_web_inc1_refresh.py` | 0 problems, 0 failures |
| `node tests/qa/qa-photo-inc2.mjs` | 58 / 58 pass |
| Developer browser checks `photo-inc3`, `photo-inc5`, `photo-inc6`, `web-inc345` | 21/21, 34/34, 20/20, 37/37 |
| QA browser checks `qa-photo-inc1`, `qa-photo-inc2-browser`, `qa-photo-inc3`, `qa-photo-inc5`, `qa-photo-inc6` | 36/36, 7/7, 36/36, 56/56, 27/27 |
| QA browser checks `qa-web-inc1-browser`, `qa-web-inc2-browser`, `qa-web-inc345-browser` | 14/14, 54/54, 43/43 |
| `qa-photo-inc6-coverage` (live Panoramax, measurement only) | ran, exit 0 |
| `qa-photo-inc3` after the wait fix (§5), 3 more runs | 36/36 each time |

(`qa-web-inc2-browser` first stopped with a `localStorage` SecurityError because I had not started the 8131 comparison server; with it running, 54/54. Setup error on my side, not a finding.)

## 2. Checks in scope

| Item | Result | Evidence |
|---|---|---|
| CHANGELOG 20-sample numbers 3 / 15 / 2 | PASS | `website-sample.mjs` prints 3 / 15 / 2; my own recount in `qa-web-inc6.mjs` (straight from `web`, `name`, `address` in `dentists.json`, without `linkFor`) gives the same 3 / 15 / 2, 0 missing. Websites: Pellan & Lessard, Rosemont, Paro Chirurgie; "not listed": the two unnamed "Dentist" listings (Montréal, Magog). Group split in the CHANGELOG matches the per-row output |
| README "Data and licences": websites from OpenStreetMap, may be missing or out of date, how refreshed | PASS | Line names the tags, © OpenStreetMap contributors, yearly refresh or `pipeline/refresh.py --dentists` (only `dentists.json`, keeps the current file when the download looks incomplete), fix on openstreetmap.org, page never opens a site by itself. Matches behaviour verified by `qa_web_inc1_refresh.py` (0 failures) |
| README refresh paragraph lists the IPv4 rule; new coverage script documented | PASS | Both present and accurate |
| N-W5: 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16 refused in `safeUrl` and `weblink.py` | PASS | Range edges (first and last address of each range, trailing dot, with a port) refused by both |
| N-W5: public IPv4 still kept (edges just outside each range, 192.0.2.1, 198.51.100.7, 203.0.113.9, 8.8.8.8) | PASS | Kept by both, same value returned |
| N-W5: names such as `10.fictive.ca`, `127.fictive.ca`, `192.168.fictive.ca` still kept | PASS | Kept by both; `siteName` gives `10.fictive.ca` |
| N-W5 bypass forms: `127.1`, `0x7f.0.0.1`, `0177.0.0.1`, `2130706433`, `[::1]`, `[::ffff:127.0.0.1]`, `localhost`, full-width digits, `%31%32%37.0.0.1`, `010.0.0.1` | PASS | All refused by both; no kept value parses (`new URL`) to a private, loopback or IPv6 host |
| N-W5: `linkFor` never offers "Website" for a private address | PASS | Falls back to the no-website rule |
| All 1,692 real values unchanged | PASS | `safeUrl` and `weblink.py` both return every stored value unchanged; none is an IPv4 address, so not rebuilding `dentists.json` is correct |
| `qa-web-inc345-browser` probe moved to `probe.fictive.test` | PASS (fair change) | It tests the same thing (the opened tab has `opener` null and empty `referrer`): the run shows `{"opener":"null","referrer":""}` from `http://probe.fictive.test:8124/probe.html`, and the probe server log shows the real request. `.test` is a reserved name that never resolves on the internet, so nothing leaks. Without the Chrome flag the tab cannot load the probe and the check fails, it cannot pass silently. Expected text now taken from `PROBE`, and the outside-requests check is unchanged. I updated the "How to re-run" of increments 3 to 5 |

## 3. Other checks

- Labels: no new page text in this increment; existing labels ("Website: …", "Website not listed · Search the web", note sentence) unchanged in all browser checks; accents (Montréal, Québec) correct in README, CHANGELOG and the coverage output.
- Security: no new risk; the IPv4 change only narrows what is accepted. Both lists are identical (read side by side).
- No real patient data: the commit adds fictive hosts only (`fictive.ca`, `example.*`, documentation/private IPv4, `probe.fictive.test`); the coverage table lists public OpenStreetMap business listings only. `tests/qa/qa-web-inc6.mjs` uses the same.

## 4. Defects

None.

## 5. QA script change: `qa-photo-inc3` map-click wait (test timing, not an app defect)

The developer saw 35/36 once on "AC-1.4 after a map click the block follows the new centre". Cause in my script: after the click it waited only for "not Loading", which is already true for the old centre's finished block, so it could read the line before the redraw. It now waits (up to 12 s) until the URL `hub` has changed and the block's "View on Google Maps" link points to that new centre, then checks as before. The check is not weaker: it still fails if the block never follows the click. 4 runs after the change: 36/36 each time.

## 6. Overall verdict for the whole iteration 2 (clinic website links, US-9 to US-15)

**APPROVED.** Across increments 1 to 6 QA raised QA-W1 to QA-W5 (one Medium, four Low); all are fixed and re-tested. Note N-W5 is now done as well. Notes N-W1, N-W2, N-W6 and N-W7 stay as information, none blocks release. The full regression (developer and QA, Node, Python, browser with a fresh profile and cache off) passes, and the iteration 1 photo feature is unaffected.

## 7. How to re-run (this increment)

```bash
node --test && .venv/bin/python -m unittest discover -s tests -p 'test_*.py'
node tests/coverage/website-sample.mjs
node tests/qa/qa-web-inc6.mjs
# browser checks: see "How to re-run" of increments 3 to 5 below (Chrome now needs --host-resolver-rules)
```

---

# Iteration 2 — Clinic website, increments 3 to 5 (centre line, card, table links) and fixes QA-W3 to QA-W5

- **Date:** 2026-11-15
- **Increment:** fix round 1 of increment 2 (QA-W5, QA-W4, QA-W3, extended generic words) plus increments 3, 4 and 5 of solution design §2.7 (iteration 2): website part of the link line at the Competition centre, note sentence, "Your clinic" card, small "Website" links in both clinic tables.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** branch `team/clinic-website`, commit `da33d2a`
- **Environment:** macOS, Node 24.22.1, Python 3.14.0 (`.venv`), headless Chrome 157 (fresh profile), `python3 -m http.server 8123 --directory site`; the increment 2 build (`2bafc2d`) served on 8131 for comparison; a local probe page on `127.0.0.1:8124` to see what an opened clinic tab receives
- **Verdict: APPROVED** (0 defects; QA-W3, QA-W4, QA-W5 fixed; 3 notes for the team, none blocking)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer: `tests/photo.test.mjs`, `tests/web.test.mjs`) | 61 / 61 pass |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` (developer) | 20 / 20 pass |
| `tests/qa/qa_web_inc1_adversarial.py`, `qa_web_inc1_refresh.py` (QA, increment 1) | 0 problems, 0 failures |
| `node tests/qa/qa-web-inc2.mjs` (QA, increment 2: rules, parity with the refresh, privacy, real data) | 92 / 92 pass (was 87 / 92: QA-W3, QA-W4, QA-W5 now pass) |
| `node tests/qa/qa-web-inc345-browser.mjs` (QA, **new**: this increment in the page, with fake listings injected in the browser only) | 43 / 43 pass |
| Developer browser checks: `photo-inc3`, `photo-inc5`, `photo-inc6`, `web-inc345` | 21/21, 34/34, 20/20, 37/37 |
| QA browser checks, updated for the new text (see §5): `qa-photo-inc1`, `qa-photo-inc3`, `qa-photo-inc5`, `qa-web-inc1-browser`, `qa-web-inc2-browser` | 36/36, 36/36, 56/56, 14/14 (one check per page state reworded), 54/54 |
| Other QA checks, unchanged: `qa-photo-inc2`, `qa-photo-inc2-browser`, `qa-photo-inc6`, `qa-photo-inc6-coverage` | 58/58, 7/7, 27/27, runs (measurement only) |

## 2. Re-test of the increment 2 defects

| Item | What was checked | Result | Evidence |
|---|---|---|---|
| QA-W5 (Medium) | Rule: saved clinic A with a site, neighbour B within 30 m, B as centre -> B's own site or nothing; 4,000 random neighbours; property "Thu's site never under another name" | PASS | `qa-web-inc2.mjs` section 6 (was 3 FAIL) |
| QA-W5 in the page | Fake saved clinic on a fake listing with `m.facebook.com`: neighbour 60 m with its own site shows "Website: voisin60fictive.ca"; neighbour 60 m without site shows nothing; real pairs: saved on "Clinique dentaire Métro Papineau", centre "1935 Clinique Dentaire" (66 m, no site) shows nothing; saved on "Le Loft Dentaire", centre "Clinique Dentaire Samuel Holland" (79 m) shows only "Website: cliniquesamuelholland.com" | PASS | `qa-web-inc345-browser.mjs` section 8, 9 |
| Card rule only for her clinic | "Use your clinic" centre and the card show her listing's site; a listing 20 m away picked as centre becomes her clinic in the page (iteration 1 rule, 30 m): title "Competition around [her name]" and her site, so name and site always match | PASS | same, section 8 (see note N-W6) |
| QA-W4 (Low) | `searchUrl` / `linkFor` with lone surrogates in name, address, town: no throw, halves dropped; in the page a fake "QA Fake Clinic \ud800 Surrogate" centre draws "Website not listed · Search the web" with `q=QA Fake Clinic Surrogate Chibougamau`, no `URIError` | PASS | `qa-web-inc2.mjs` sections 2, 3; `qa-web-inc345-browser.mjs` section 3 |
| QA-W3 (Low) | 28,361 values through `clean_website` and `safeUrl`: 1 disagreement left, `https://fictive.ca/a;b` (the refresh splits on ";" first, so it can never be stored): accepted. Numeric hosts, U+0085, U+FEFF now agree | PASS | `qa-web-inc2.mjs` parity: `{"numericHost":0,"c1orBom":0,"semicolonOrSpace":1,"other":0}` |
| Plain IPv4 kept as valid (developer's choice) | Both places: `192.0.2.1`, `1.2.3.4.` kept; `256.1.1.1`, `01.2.3.4`, `1.2.3`, `127.1`, `0x7f.0.0.1`, `1.2.3.0x10`, `fictive.123`, `fictive.0x1` refused; site name shows the address itself ("Website: 127.0.0.1") | PASS (judged acceptable) | Spec WR1 rule 4 allows it (digits and dots, at least one dot); the label shows exactly where the link goes (AC-13.4); 0 such values in the data. See note N-W5 |
| Extended generic words | "Cliniques dentaires" with address -> search "Cliniques dentaires 1 Rue Fictive Chibougamau"; "Family Dental Care" without address -> "Website not listed" only; developer tests cover the full list | PASS | `qa-web-inc345-browser.mjs` section 3; real data now 1,692 site / 3,543 search / 493 "Website not listed" |

## 3. Acceptance criteria, increments 3 to 5

| Criterion | What was checked | Result | Evidence |
|---|---|---|---|
| AC-9.1 | `?hub=45.40933,-71.85909#competition`: line is exactly "Photo not available · View on Google Maps · Website: cliniquedentairesherbrooke.ca"; one website link | PASS | section 1 |
| AC-9.2, AC-13.3 | Every website and search link: `target=_blank`, `rel="noopener noreferrer"`, `referrerpolicy="no-referrer"`. Real click (mouse event) on a table link to the probe page: new tab opened, `window.opener === null`, `document.referrer === ""`; dashboard address, order and service choices unchanged | PASS | sections 1, 6 |
| AC-9.3 | Switching centres; neighbours of her clinic (QA-W5); developer fast-switch check | PASS | sections 8, 9; `web-inc345` |
| AC-9.4 | No centre: block hidden, no "Website not listed" or "Search the web" in the Competition tab | PASS | section 12 |
| AC-9.5 | Panoramax held for 4 s: the line already reads "Loading photo... · View on Google Maps · Website: cliniquedentairesherbrooke.ca"; photo states, credit and Google Maps link unchanged (all photo checks pass with only the website part added) | PASS | section 7; photo regression |
| AC-10.1, AC-10.2, AC-10.4 | `?hub=45.51432,-73.56878#competition`: "... · View on Google Maps · Website not listed · Search the web"; link `https://www.google.com/search?q=Dr%20Lac%20Long%20Ly%20Montr%C3%A9al`, only the `q` parameter, nothing from the page address | PASS | section 1 |
| AC-10.3 | Generic with address: name + address + town; generic without address: "Website not listed", no link | PASS | section 3; `web-inc345` |
| AC-11.1, AC-11.2, AC-11.4 | Card shows her listing's site ("Website: m.facebook.com"); no listing within 30 m: nothing; "Change" follows the new location; "Remove" hides it | PASS | section 8, 11; `web-inc345` |
| AC-11.3 / W11 | "Use your clinic": her site, no search. 6 real centres within 100 m of three saved spots in Montréal: 0 search links, 0 "Website not listed". 60 m from a location saved earlier in the same visit: still nothing | PASS | sections 8, 10, 11 |
| AC-12.1, AC-12.3, AC-12.4 | "Competing clinics" with 11 fake rows: "Website" link exactly on the 5 rows with a valid address (incl. the 461-char one), with `aria-label` "Website of [name]" and class `dm-tlink`; none for `javascript:`, a user-part address, or no website; no search link or "Website not listed" text in any row | PASS | section 5 |
| AC-12.2, AC-12.6 | "Nearest dental listings" in the card: same rule; her own listing and the 60 m neighbour without site get no link and no search | PASS | section 8 |
| AC-12.5 | Clicking a table link keeps the address, row order and service choices | PASS | section 6; `web-inc345` |
| AC-13.1, AC-13.4, AC-13.5 | `javascript:alert(1)` -> search fallback, no `javascript:` in the block; `https://fictive.ca@evil.example` refused, `evil.example` never shown; `https://m.facebook.com/...` -> "Website: m.facebook.com" | PASS | section 3 |
| AC-14.1 | Note ends "... the same size for every clinic. Website links come from the OpenStreetMap listing and may be missing or out of date. Map data © OpenStreetMap contributors." | PASS | section 2 |
| AC-14.4 | Light and dark at 375 px with a 200-character host: only the host is shown, the line wraps, page and block have no horizontal scroll; table link contrast 19.2 (light) and 15.2 (dark); developer check covers centre links | PASS | section 4 |
| AC-14.5 | All photo, Google Maps, filters, notes and earlier QA checks pass; no console errors or warnings in any run | PASS | §1 |
| AC-14.6, WR7 | Hosts contacted by the page itself during the whole run: only `api.panoramax.xyz` (existing photo lookup); the probe host only after the click; no prefetch, preconnect or speculation rules. Versus `2bafc2d`: identical hosts in 6 page states | PASS | sections 13; `qa-web-inc2-browser` |
| Text only, no HTML | Fake listing named `<img src=x onerror="...">QA Fake XSS Clinic` with website `https://fictive-xss.ca/"><img/src=x/onerror=...>`: no element created, no script run, link text "Website: fictive-xss.ca"; code: `extLink` and `nameCell` use `textContent` / `append` only | PASS | section 3; code read |
| AC-14.2, AC-14.3 | Unchanged since increment 1 (refresh) | PASS | `qa_web_inc1_refresh.py` |
| US-15 | Not built (W13, decided) | Not in scope | |

## 4. Other checks

- **Labels:** all new texts match the spec exactly ("Website: [site name]", "Website not listed", "Search the web", "Website", aria "Search the web for [name]" and "Website of [name]", the note sentence). The page is in English by decision (requirements §2.7); accents are kept in search text ("Montréal", "Rémillard") and in names in tables.
- **Security:** only `http:`/`https:` become links, checked twice (refresh and page); site name taken from the address the link opens; all new links open in a new tab without opener or referrer (tested with a real click); no `innerHTML`; `web.js` still makes no requests.
- **Patient data (Loi 25):** none. New QA script uses fictive names and sites only ("QA Fake ... Clinic", `voisin60fictive.ca`, `fictive-xss.ca`), placed in the forest north of Chibougamau, injected in the browser only; real names are public OpenStreetMap business listings. The commit `da33d2a` contains no personal data, keys or secrets; `site/content/local.json` stays git-ignored and was never committed.
- **Docs:** CHANGELOG, README (both example addresses verified) and the spec's "As-built clarifications" match the behaviour.

## 5. QA scripts updated (they failed on purpose because of the new text)

- `qa-photo-inc1.mjs`: the generic "Dentist" centre now ends with " · Website not listed".
- `qa-photo-inc3.mjs`, `qa-photo-inc5.mjs` (N-9): centre "Centre Dentaire Gagné Rémillard" now ends with " · Website not listed · Search the web"; the checks next to her clinic stay exact (nothing appended there).
- `qa-web-inc1-browser.mjs`: instead of "no website on the page yet": no website on the default page; at the Rosemont centre "View on Google Maps · Website: cliniquedentairerosemont.com", and every link to a listing host is a stored address.
- `qa-web-inc2-browser.mjs`: now compares with the increment 2 build (`2bafc2d`); the page text and links must be identical once the new website parts are removed; the hosts contacted must be identical.
- No assertion was weakened on photo states, privacy line or Google Maps link.

## 6. Defects

None open. QA-W3, QA-W4 and QA-W5 are fixed (verified above); QA-W1 and QA-W2 were fixed in increment 2.

## 7. Notes (not defects)

- **N-W5 (IPv4):** a plain IPv4 address such as `http://192.168.0.1` or `http://127.0.0.1` would be accepted as a clinic website if an OpenStreetMap listing ever had one. The link shows "Website: 192.168.0.1", so Thu sees it is not a clinic site, and it only opens on her click. 0 in the data today. If the team wants, the refresh could later also refuse private and loopback addresses; not needed for acceptance.
- **N-W6 (30 m):** with her clinic saved, a different listing within 30 m of it can never become the centre: the page treats that spot as her clinic (iteration 1 rule) and shows her name and her website. Consistent, never mixed; just worth knowing for shared buildings.
- **N-W7 (test setup):** a Chrome profile reused from an earlier QA run served an old `index.html` from its cache (without `web.js`), and the page then threw `dmWeb is not defined` and hid the photo block. The live site is not affected (the deploy adds `?v=` versions to every asset in `index.html`, so a cached page always loads matching scripts). Browser checks must run with a fresh profile or cache disabled; `qa-web-inc345-browser.mjs` disables the cache.
- **Coverage (information for Thu):** over all 5,728 listings with no saved clinic: 1,692 "Website" (about 30 %), 3,543 "Search the web", 493 "Website not listed" (generic name without address).

## 8. How to re-run

```bash
node --test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
node tests/qa/qa-web-inc2.mjs
python3 -m http.server 8123 --directory site &
git archive 2bafc2d site | tar -x -C /some/dir && python3 -m http.server 8131 --directory /some/dir/site &
mkdir -p /some/probe && python3 -m http.server 8124 --bind 127.0.0.1 --directory /some/probe &
# Chrome --headless=new --remote-debugging-port=9333 --user-data-dir=<new empty folder> \
#   --host-resolver-rules="MAP probe.fictive.test 127.0.0.1"
# (updated in increment 6: since N-W5 the page refuses 127.0.0.1, so the probe is http://probe.fictive.test:8124/probe.html,
#  a fictive name Chrome maps to the local probe server; without the flag the opened-tab check fails, it cannot pass silently)
PROBE_DIR=/some/probe node tests/qa/qa-web-inc345-browser.mjs
node tests/browser/web-inc345.mjs; node tests/qa/qa-web-inc2-browser.mjs   # and the other tests/browser and tests/qa scripts
```

---

# Iteration 2 — Clinic website, increment 2: link rules for the page (nothing visible yet)

- **Date:** 2026-11-15
- **Increment:** 2 of solution design §2.7 (iteration 2): new `site/assets/web.js` (global `dmWeb`: `safeUrl`, `siteName`, `isGeneric`, `searchText`, `searchUrl`, `ownListing`, `cardLink`, `linkFor`), loaded by the page but not used; fixes QA-W1 and QA-W2 in `pipeline/work/weblink.py` and `safeUrl`; control characters refused in both.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** branch `team/clinic-website`, commit `fef5bc3`
- **Environment:** macOS, Node 24.22.1, Python 3.14.0 (`.venv`, with shapely), headless Chrome 157, `python3 -m http.server 8123 --directory site`; the previous increment (`cdb563e`) served alongside for comparison
- **Verdict: REJECTED** (1 Medium defect, QA-W5, against AC-9.3; 2 Low defects; QA-W1 and QA-W2 confirmed fixed)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer: `tests/photo.test.mjs`, `tests/web.test.mjs`) | 57 / 57 pass |
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` (developer, `tests/test_weblink.py`) | 18 / 18 pass |
| `.venv/bin/python tests/qa/qa_web_inc1_adversarial.py` (QA, increment 1) | 0 problems (was 8: QA-W1 and QA-W2 fixed) |
| `node tests/qa/qa-web-inc2.mjs` (QA, new: rules, parity with the refresh, geometry, privacy, real data) | 87 pass, 5 fail (QA-W3 1, QA-W4 1, QA-W5 3); exits 1 until fixed |
| `node tests/qa/qa-web-inc2-browser.mjs` (QA, new: this build vs `cdb563e`, 6 page states) | 60 / 60 pass |
| `node tests/qa/qa-web-inc1-browser.mjs` (QA, increment 1) | 15 / 15 pass |
| Browser regression, developer: `photo-inc3`, `photo-inc5`, `photo-inc6` | 21/21, 34/34, 20/20 |
| Browser regression, QA: `qa-photo-inc1`, `-inc2`, `-inc2-browser`, `-inc3`, `-inc5`, `-inc6` | 36/36 (35/36 on a first run right after other checks, see notes), 58/58, 7/7, 36/36, 56/56, 27/27 |

## 2. Checks in scope

| Item | What was checked | Result | Evidence |
|---|---|---|---|
| QA-W1 fixed (both places) | `https://.`, `https://..`, `https://-.-`, `https://a..ca`, `https://.ca`, `-fictive.ca`, `fictive-.ca`, `fictive.ca..` refused by `clean_website` and `safeUrl`; `https://fictive.ca.` still kept | PASS | `qa_web_inc1_adversarial.py` 0 problems; `qa-web-inc2.mjs` hand list |
| QA-W2 fixed (both places) | `:99999`, `:65536`, `:0`, `:²`, `:-1`, `:+80`, `:` refused; `:1`, `:65535`, `:00080` kept, in both | PASS | same |
| Control characters | `\x00`, `\x07`, `\x7f` anywhere refused in both | PASS | same |
| Both checks agree on all 1,692 real values | Every stored `web` value: `safeUrl(v) === v` and `clean_website({'website': v}) === v`; `siteName` equals the browser's host without "www." for all | PASS | `qa-web-inc2.mjs` section 1 |
| Both checks agree on other values | 28,361 adversarial and random stored-style values: 120 disagreements, all of 3 kinds: last host label all digits (117, refresh keeps, page refuses), U+0085 / U+FEFF (2), ";" (1, never stored) | FAIL (Low) | QA-W3. None occurs in the real data |
| WR1b `safeUrl` never throws | 30,000+ strings plus `undefined`, `null`, numbers, `NaN`, `Symbol`, `BigInt`, functions, `String` objects, objects whose `toString` throws, lone surrogates, a 1,000,000-char string | PASS | `qa-web-inc2.mjs` sections 2 and 3 |
| Other functions never throw | Same odd inputs into `siteName`, `isGeneric`, `searchText`, `searchUrl`, `ownListing`, `cardLink`, `linkFor` | FAIL (Low) | QA-W4: `searchUrl` / `linkFor` throw `URIError` on a lone surrogate in the name, address or town |
| WR1b / AC-13.1 / AC-13.4 | `javascript:`, `data:`, `mailto:`, `tel:`, `ftp:`, `//x`, no scheme, user part, `%40`, backslash, `[::1]`, accented host refused; `https://evil.example#@good.ca` and `?@good.ca` kept with site name `evil.example` (the real destination) | PASS | `qa-web-inc2.mjs` sections 2 and 4 |
| WR2 / AC-9.1 / AC-13.5 site name | Spec examples (`cliniquexyz.ca`, `m.facebook.com`, `xyz.ca` without port); `facebook.com`; upper-case `WWW.`; trailing dot dropped; only "www." removed (`www2.` kept); `good.ca.evil.example` shown in full | PASS | section 4 |
| WR4 generic names | 19 generic forms (case, accents, hyphens, punctuation, "Cabinet de dentiste", "The Dental Clinic", "Centré dentaire") and 7 named forms | PASS | section 5. Plurals "dentaires", "cliniques" not in the list: PM decision, added in increment 3, not counted |
| WR4 search text / AC-10.2 / AC-10.3 | Named: name + town, address not added; generic: name + address + town (spec example "Dentist 292 Freshwater Road St. John's"); generic with empty or blank address: nothing; spaces collapsed; accents kept ("Lévis"); town missing: name only | PASS | section 5 |
| WR5 / AC-10.4 search link | `https://www.google.com/search?q=` + encoded text; only the `q` parameter; `&`, `#`, `+`, accents round-trip; empty or blank text: no link | PASS | section 5 |
| W10 own listing | Closest of two within 30 m wins; 29.5 m counts, 30.5 m does not; no saved clinic: none | PASS | section 6 |
| WR6 spec example | Saved P; A 12 m with website: card and centre "Website: macliniquefictive.ca"; B 70 m without: none; C 400 m without: "Website not listed" + "Search the web", aria "Search the web for [name]" | PASS | section 6 |
| AC-11.2 card never searches | Own listing without website, with unsafe website, listing 50 m away, nothing saved: all "none" | PASS | section 6 |
| W11 100 m guard | 95 m: none, 105 m: search, for the saved clinic and for a location saved earlier in the visit; generic name without address near Thu: none (not "Website not listed"); neighbour with website keeps it; bad guard entries ignored; text coordinates handled | PASS | section 6 |
| W11 privacy property | 4,000 random centres 0 to 99.9 m from the saved clinic or an earlier location: 0 search or "Website not listed" states; Thu's saved name never in a URL | PASS | section 6 |
| AC-9.3 / WR6: another clinic in Thu's building | A competitor 20 m from Thu's saved clinic, chosen as centre, shows **Thu's** website under the competitor's name | FAIL (Medium) | QA-W5 |
| Real listings, no saved clinic | 5,728 listings: 1,692 "Website" (URL = stored value), 3,570 "Search the web", 466 "Website not listed" (generic name, no address), 0 none | PASS / Info | section 7 |
| No UI change | 6 page states (default; Competition centre with a website, light and dark; generic "Dentist" centre; fake saved clinic as centre; card on Markets tab, dark) at 375 px: visible text and every link identical to `cdb563e`; no "Website", "Website not listed" or "Search the web" text; no Google search link; no horizontal scroll | PASS | `qa-web-inc2-browser.mjs` |
| No new outside requests (AC-14.6) | Hosts contacted identical to `cdb563e` in all 6 states (only the page and the existing `api.panoramax.xyz` photo lookup); `web.js` has no `fetch`, `document`, `window`, `Image`, `import()` or `eval` | PASS | same, plus code read |
| `dmWeb` global | Present with the 8 rules and `NOT_LISTED`; absent in the previous build | PASS | same |
| No console errors | All 6 states | PASS | same |
| Deploy cache-busting | `deploy.yml` versions every `assets/*.js` in `index.html`, so `web.js` gets `?v=` too | PASS | code read |
| US-9 to US-12 on screen, AC-14.1, AC-14.4 | Page parts | Out of scope | Increments 3 to 5 |

## 3. Other checks

- **Security:** `web.js` is pure: no DOM, no network, no storage. Only `http:`/`https:` pass; the site name comes from the browser's own parse of the same string the link will open. Note (not a defect): IPv4-style hosts are accepted by design (`https://192.0.2.1`), and the browser reads `https://0x7f.1` as `127.0.0.1`; the site name then honestly shows "127.0.0.1". Nothing like this is in the data.
- **Patient data (Loi 25):** none. The developer's and QA's tests use fake clinics and sites (`fictive.ca`, `macliniquefictive.ca`, "Fake Smile", "QA Fake Clinic"). The only real data read is the public OpenStreetMap listing file. `site/content/local.json` (private notes on closed practices) is git-ignored and was never committed; QA copied it only into its scratch copy of the previous build so the two pages compare fairly.
- **Labels:** no new screen text yet. The rule texts in `web.js` match the spec exactly: "Website: [site name]", "Website not listed", "Search the web", aria "Search the web for [clinic name]". Accents are kept in search text ("Lévis", "Québec") and ignored only for the generic-name test.
- **Docs:** CHANGELOG and README accurate (test counts reproduced; "all 1,692 websites still pass both checks" confirmed).

## 4. Defects

| ID | Severity | Summary |
|---|---|---|
| QA-W5 | Medium | A competitor in Thu's building (within 30 m), chosen as centre, gets Thu's website |
| QA-W4 | Low | `searchUrl` / `linkFor` throw on a lone surrogate in the name, address or town |
| QA-W3 | Low | Refresh and page checks still disagree on a few odd hosts and characters |
| QA-W1 | Low | Fixed in `fef5bc3` (verified) |
| QA-W2 | Low | Fixed in `fef5bc3` (verified) |

**QA-W5 (Medium) — Thu's website shown under a neighbouring competitor's name.**
Steps: `node --input-type=module -e "await import('./site/assets/photo.js'); await import('./site/assets/web.js'); const saved={name:'Ma Clinique Fictive',lat:46.8,lon:-71.2}; const A={...saved, web:'https://macliniquefictive.ca'}; const B={name:'Clinique Voisine Fictive',lat:46.80018,lon:-71.2,web:'https://voisinefictive.ca'}; console.log(dmWeb.linkFor(B,{saved,listings:[A,B]}))"` (B is 20 m from the saved clinic).
Expected: B's own website "Website: voisinefictive.ca" (AC-9.3: "Clinic A's website is never shown with clinic B's name"); if B had no website, nothing (W11).
Actual: `{kind: 'site', label: 'Website: macliniquefictive.ca'}`, i.e. Thu's own site under "Competition around Clinique Voisine Fictive". Without a website on B, same result. If Thu's listing has no website and B has one, B's own website is hidden.
Cause: `linkFor` sends every centre within 30 m (`dmPhoto.isMine`) to `cardLink(saved)`, which returns the website of the listing closest to the saved point, not of the centre.
Impact: real. The data has 402 pairs of differently named listings within 30 m of each other (shared buildings, medical towers), 180 of them involving a website, 19 in Québec.
Suggested fix: when the centre is a listing (not the saved point itself, `c.mine`), use its own website if safe, else nothing; keep `cardLink(saved)` only for the "Use your clinic" centre. The designer may want to state this in WR6 ("Centre that is Thu's clinic" = her saved point or her W10 listing, not any listing within 30 m).

**QA-W4 (Low) — `searchUrl` / `linkFor` can throw.**
Steps: `dmWeb.searchUrl('Clinique \ud800')`, or `dmWeb.linkFor({lat:46.8, lon:-71.2, name:'Clinique Fictive \ud800'}, {town:'Lévis'})`.
Expected: no exception (an empty search link or a cleaned text), like `safeUrl`.
Actual: `URIError: URI malformed` from `encodeURIComponent`. In increment 3 this would stop the link line (and maybe the photo block) from drawing for that clinic.
Impact today: none (0 lone surrogates in the data and town names). Suggested fix: `try/catch` in `searchUrl` returning `''`, or replace lone surrogates (`s.toWellFormed()` where available).

**QA-W3 (Low) — The two checks still disagree on a few values.**
Steps: compare `clean_website({'website': v}) == v` with `dmWeb.safeUrl(v) !== ''` for `https://999.999.999.999`, `https://fictive.123`, `https://a.9`; for `https://fictive.ca/\u0085` and `https://fictive.ca/﻿`.
Expected: the same answer in both places (CHANGELOG: "same rules in weblink.py and safeUrl").
Actual: hosts whose last part is all digits are kept by the refresh and refused by the page (the browser reads them as a bad IPv4 address); U+0085 is refused by the refresh and kept by the page; U+FEFF the other way round. In every case the page simply shows the search link instead of a website, or links to a harmless address.
Impact today: none (0 such values in the 1,692). Suggested fix: in `weblink.py` refuse a host whose last label is all digits unless it is a valid dotted IPv4, and make both control-character rules the same (for example refuse all non-ASCII before the host check, or the same explicit character set in both).

## 5. Notes (not defects)

- **N-W3:** 466 real listings (8 %) have a generic name and no address, so they will show "Website not listed" without a search link. Several common names are not in the WR4 list and so will be searched as named clinics: "Denture Clinic" (11 listings), "Family Dentistry" (7), "Family Dental Care" (5), "Orthodontics"-style names. Search results for "Denture Clinic [town]" may be vague; worth a look with the increment 3 plural update.
- **N-W4:** `siteName('https://www.ca')` gives "ca". Harmless, nothing like it in the data.
- **Regression timing:** `qa-photo-inc1` gave 35/36 once when run right after other browser checks: its "card hidden with no saved clinic" step reloads the page with only a `#` change, which does not reload, so a clinic saved by the previous check was still in memory. Run alone: 36/36. A test-order effect of the QA script, not of this increment (the site code is unchanged apart from loading `web.js`).

## 6. How to re-run

```bash
node --test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python tests/qa/qa_web_inc1_adversarial.py
node tests/qa/qa-web-inc2.mjs                    # uses tests/qa/qa_web_inc2_clean.py; exits 1 while QA-W3/W4/W5 are open
python3 -m http.server 8123 --directory site &    # plus Chrome --headless=new --remote-debugging-port=9333
git archive cdb563e site | tar -x -C /some/dir && python3 -m http.server 8131 --directory /some/dir/site &
node tests/qa/qa-web-inc2-browser.mjs
```

---

# Iteration 2 — Clinic website, increment 1: websites in the listing data

- **Date:** 2026-11-15
- **Increment:** 1 of solution design §2.7 (iteration 2): website cleaning (WR1), optional `web` field, duplicate merge (WR3), `refresh.py --dentists` with the 3,000 / 75 % refusal, report counts (WR9). No page change.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** branch `team/clinic-website`, commits `5b342ac` (docs) and `5ade642` (increment 1)
- **Environment:** macOS, Python 3.14.0 (`.venv`, with shapely), Node 24.22.1, headless Chrome 157, `python3 -m http.server 8123 --directory site`
- **Verdict: APPROVED** (no blocking defect; 2 Low defects to fix before or in increment 2, 2 notes)

## 1. Automated tests

| Suite | Result |
|---|---|
| `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` (developer, `tests/test_weblink.py`) | 15 / 15 pass (including the 3 `refresh.py --dentists` runs) |
| `node --test` (photo rules, iteration 1) | 38 / 38 pass |
| `.venv/bin/python tests/qa/qa_web_inc1_refresh.py` (QA, new) | 6 / 6 pass |
| `.venv/bin/python tests/qa/qa_web_inc1_adversarial.py` (QA, new) | 67 values: 59 as expected, 8 accepted that should arguably be refused (defects QA-W1, QA-W2; the script exits 1 until they are fixed) |
| `node tests/qa/qa-web-inc1-browser.mjs` (QA, new) | 15 / 15 pass |
| Browser regression, developer: `photo-inc3.mjs`, `photo-inc5.mjs`, `photo-inc6.mjs` | 21/21, 34/34, 20/20 |
| Browser regression, QA: `qa-photo-inc1`, `-inc2`, `-inc2-browser`, `-inc3`, `-inc5`, `-inc6` | 36/36, 58/58, 7/7, 36/36, 56/56, 27/27 (`qa-photo-inc5` gave 55/56 once while another QA tab was running in the same Chrome; the N-9 "image fails" check read the block before it redrew. Re-run alone: 56/56. Same known timing sensitivity as noted in iteration 1; increment 1 does not touch `site/` code.) |

## 2. Checks in scope

| Item | What was checked | Result | Evidence |
|---|---|---|---|
| WR1 / AC-13.1 schemes | `javascript:` (any case, leading spaces, with a tab inside), `vbscript:`, `data:`, `mailto:`, `tel:`, `ftp:`, `file:`, `//x`, `///x`, `http:/x`, `https:x`, `localhost:8080` | PASS | All refused (`qa_web_inc1_adversarial.py`) |
| WR1 / AC-13.1 scheme added | `www.fictive.ca` → `https://www.fictive.ca`; `fictive.ca:8080/a` → `https://fictive.ca:8080/a`; `http://` kept as is; `HTTPS://` kept | PASS | same script |
| WR1 e-mail, spaces, empty | `info@fictive.ca`, `fictive.ca@`, "Clinique Fictive", `fic tive.ca`, non-breaking space, `''`, `' '`, `;;;`, `None`, number | PASS | all → no website |
| WR1 user part / backslash | `https://good.ca@evil.com`, `https://user:pw@…`, `%40…@…`, `https://fictive.ca\@evil.com`, `http:\\fictive.ca` | PASS | all refused; `https://fictive.ca/#@x` correctly kept (the `@` is in the fragment, host is fictive.ca) |
| WR1 host | no dot, `[::1]`, accented host, empty host, NUL in host | PASS | refused |
| WR1 host, empty labels | `https://.`, `https://..`, `https://-.-`, `https://a..ca`, `https://.ca` | FAIL (Low) | Accepted. See QA-W1 |
| WR1 port | empty port and letters refused; `:99999` and `:²` (Unicode digit) accepted | FAIL (Low) | See QA-W2 |
| WR1 length | 500-char limit counted after "https://" is added | PASS | 503-char and 495+8-char values refused |
| AC-13.2 first valid piece | `bad;; ;javascript:x;www.fictive.ca` → `https://www.fictive.ca`; `mailto:…;tel:1;eps.fictive.ca` → `https://eps.fictive.ca` | PASS | |
| WR1 tag order | `website` before `contact:website` before `url`; an invalid `website` falls through to `contact:website` | PASS | |
| Optional `web` field | Real file: 4,036 rows without the key, 1,692 with a non-empty value, never empty or `null` | PASS | key-set count on `site/data/dentists.json` |
| WR3 duplicate merge | Kept row without (or with an invalid) website takes the dropped duplicate's website; kept row's own website wins; name match ignores case; a duplicate outside Canada adds nothing | PASS | `qa_web_inc1_refresh.py` case 6 (fake listings) |
| `--dentists` leaves `meta.json` and `last_release.txt` alone | Hashes before and after, on success and on every refusal | PASS | `qa_web_inc1_refresh.py`, all 6 cases; also the live run below |
| 75 % refusal (AC-14.3) | 3,750 of 5,000 accepted (exactly 75 %); 3,749 of 5,000 refused, exit 1, current file byte-identical | PASS | `qa_web_inc1_refresh.py` |
| 3,000 refusal | 3,000 accepted; 2,999 refused even when the current file is smaller | PASS | same |
| Broken Overpass answer | Saved file with invalid JSON: exit 1, `site/data` untouched | PASS | same (see note N-W1 on the report text) |
| WR9 report counts | `report.json` `dentists_web` = `{canada, quebec}`; Québec = market ids starting with 24 | PASS | fake run `{canada: 3, quebec: 3}`; live run below |
| Data reproduced through the pipeline (AC-14.2) | QA ran `refresh.py --dentists` against live Overpass on a scratch copy | PASS | 5,728 listings, `dentists_web` `{canada: 1692, quebec: 140}`; identical to the committed file (0 rows added/removed, 0 `web` differences); `meta.json` unchanged |
| Counts in the committed file | Québec 140 of 788, Canada 1,692 of 5,728 | PASS | Counted directly in `site/data/dentists.json` |
| Real `web` values | All 1,692: start with `http://` or `https://` (148 plain http), re-cleaning gives the same value, no port, no empty host label, no control or non-ASCII character, none over 200 chars. 15 random Québec values read by hand: all clinic sites matching the clinic name | PASS | Most frequent hosts are dental chains (aarm-dental.com 9, monarchdentistry.ca 4, …) |
| Other listing fields | 20 new and 6 gone listings vs the previous file (normal OSM change); 0 changes to name, address, coordinates, city or market on the 5,708 common listings | PASS | diff against `4b9c47f` |
| 20-listing Québec sample (information for Thu, requirements §2.1) | All 20 still present with the same coordinates; **3 of 20** have a website (Centre Dentaire Pellan & Lessard, Clinique Dentaire Rosemont, Paro Chirurgie Montréal) | Info | matches the CHANGELOG |
| AC-14.5 (partial) page unaffected | Page loads the new file, no console error, no "Website" text or link to any listing site yet, no horizontal scroll, light and dark; photo feature regression all green (section 1) | PASS | `qa-web-inc1-browser.mjs` |
| AC-14.6 no automatic requests | Hosts contacted while loading the page and a Competition centre with a website: only `localhost:8123` and `api.panoramax.xyz` (existing photo lookup) | PASS | same |
| Yearly refresh path | Code review only: uses the same `dentists()` check and adds `dentists_web` to the full report; falls back to the current file on refusal | NOT TESTABLE | Needs a full Statistics Canada download |
| AC-13.3, AC-13.4 (site name), AC-13.5, US-9 to US-12 | Page parts | Out of scope | Increments 2 to 5 |

## 3. Other checks

- **Security:** values are only cleaned and stored; nothing is rendered yet. No secret, key or token in the two commits. `pipeline/report.json`, `pipeline/out/` and `pipeline/run.log` are git-ignored, not published.
- **Patient data (Loi 25):** none. Tests use fake clinics (`fictive.ca`, "QA Fake", "Clinique Fictive Alpha"). `dentists.json` holds public OpenStreetMap business listings and their public websites only.
- **Labels:** no screen text in this increment. "Québec" is spelled with its accent in README and CHANGELOG; the `build_dentists.py` console line says "Quebec" (console only, not shown to Thu).
- **Docs:** README explains `--dentists`, the refusal rules and the report; CHANGELOG entry is accurate (counts and the 3 of 20 sample verified).
- **File size:** `dentists.json` 719,391 → 790,264 bytes (+71 KB, a bit above the design estimate of about 50 KB; harmless).

## 4. Defects

| ID | Severity | Summary |
|---|---|---|
| QA-W1 | Low | Host names made only of dots or with empty parts are accepted |
| QA-W2 | Low | Out-of-range and non-ASCII port numbers are accepted |

**QA-W1 (Low) — Host names with empty parts accepted.**
Steps: `.venv/bin/python -c "import sys; sys.path.insert(0,'pipeline/work'); from weblink import clean_website as c; print([c({'website': v}) for v in ['https://.', 'https://..', 'https://-.-', 'https://a..ca', 'https://.ca']])"`.
Expected: no website (the caller and the design ask for a real host name; "https://." is not one; it would become a broken link that shows a meaningless site name).
Actual: all five values are kept unchanged.
Impact today: none (0 of the 1,692 real values has an empty host part). Suggested fix: each dot-separated label non-empty (a single trailing dot may stay), and do the same check in the page's `safeUrl` (WR1b, increment 2).

**QA-W2 (Low) — Port numbers not checked properly.**
Steps: `clean_website({'website': 'https://fictive.ca:99999'})` and `clean_website({'website': 'https://fictive.ca:²'})`.
Expected: no website (port must be 1 to 65535, ASCII digits; `str.isdigit()` is also true for "²" and other Unicode digits).
Actual: both kept. A browser cannot parse either URL (`new URL()` throws), so in increment 2 `siteName`/`safeUrl` must not crash on such a value.
Impact today: none (no real value has a port). Suggested fix: `port.isascii() and port.isdigit() and 0 < int(port) < 65536`.

Not counted as a defect but worth a line in increment 2: control characters in the path (for example `https://fictive.ca/\x07`) are kept; the page should rely on `new URL()` and `textContent`, which handle them safely.

## 5. Notes (not defects)

- **N-W1:** when the build step itself fails (for example a broken saved Overpass file), `report.json` `failed` holds the last 300 characters of a Python traceback, cut mid-word. Readable enough for the team; a short first line ("listing build failed: …") would be clearer.
- **N-W2:** `--dentists` overwrites `pipeline/report.json` with a short listings-only report, replacing the last yearly report. The file is not published and the workflow does not read it, so nothing breaks; just know that the yearly figures are then only in the workflow log.

## 6. How to re-run

```bash
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python tests/qa/qa_web_inc1_refresh.py        # fake listings, scratch copy, about 2 minutes
.venv/bin/python tests/qa/qa_web_inc1_adversarial.py    # exits 1 while QA-W1 / QA-W2 are open
python3 -m http.server 8123 --directory site &           # plus Chrome --headless=new --remote-debugging-port=9333
node tests/qa/qa-web-inc1-browser.mjs
```

---

# Iteration 1 — Clinic photo when a clinic is chosen

# 04 — QA report: clinic photo, increment 1

- **Date:** 2026-11-14
- **Increment:** 1, the photo area with the "View on Google Maps" link and the "Photo not available" message, with no outside calls (solution design §7, step 1)
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** working tree on branch `clinic-view`, not committed yet. Changed files: `site/assets/photo.js` (new), `site/assets/app.js`, `site/index.html`, `site/assets/styles.css`, `tests/photo.test.mjs`, `README.md`, `docs/CHANGELOG.md`
- **Environment:** macOS, Node 24.22.1, headless Chrome 157, `python3 -m http.server 8123 --directory site`
- **Verdict: ACCEPTED** (no blocking defects; 1 low-severity defect and 2 notes below)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer tests, `tests/photo.test.mjs`) | 5 / 5 pass |
| `node tests/qa/qa-photo-inc1.mjs` (QA browser check through the Chrome DevTools protocol, written for this report) | 34 / 34 pass |

To re-run the QA check, start the server and Chrome with `--headless=new --remote-debugging-port=9333`, then run `node tests/qa/qa-photo-inc1.mjs`. It uses one fake clinic name ("QA Fake Clinic") and public OpenStreetMap listing coordinates only, and it clears browser storage when it finishes.

## 2. Acceptance criteria in scope

Out of scope for this increment: real photo lookups (AC-1.1 photo content, AC-1.5 loading, AC-3.2 slow or failed source), credits (US-6), own photo (US-5) and the 20-listing hit rate.

| AC | What was checked | Result | Evidence |
|---|---|---|---|
| AC-1.1 (placement only) | The block sits directly under the H2 "Competition around [name]", above the explanatory note | PASS | Element before the block = `H2:Competition around Dentist` (`?hub=46.75949,-70.95007`) |
| AC-1.2 | Picking another clinic from the "Clinic at the centre" suggestions replaces the block | PASS | Picked "1935 Clinique Dentaire": title and link both changed to `45.52429,-73.55307` |
| AC-1.3 | No centre chosen: no block and no message | PASS | `hidden=true`, text empty |
| AC-1.4 | Clicking a competing clinic on the map: the block follows the new centre | PASS | In Montréal (120 competitor dots), a click moved the centre to "Clinique dentaire Métro Papineau" and the link to `45.52370,-73.55301`. The rural test hub has 0 competitors, so this cannot be tested there. |
| AC-2.2 | "Change" then save a new location: the link matches the new location | PASS | Link changed to `45.50000,-73.60000` |
| AC-2.3 | "Remove": the card goes back to empty and the block is hidden | PASS | `hidden=true`, text empty |
| AC-2.4 | "Use your clinic" in the Competition tab shows the same block, with the privacy line | PASS | Same text and link as the card |
| AC-3.1 | Exact text "Photo not available" followed by the link | PASS | Text is `Photo not available · View on Google Maps` |
| AC-3.3 | No broken-image icon, grey box or raw error | PASS | No `<img>` in the block; no errors |
| AC-4.1 | The link is always shown when a clinic is chosen, in both places | PASS | Present in the card and the Competition tab, for own and other clinics |
| AC-4.2 | Opens in a new tab and the dashboard keeps its state | PASS | `target="_blank"`, `rel="noopener noreferrer"` |
| AC-4.3 | Pin at the clinic coordinates | PASS (by URL) | `https://www.google.com/maps/search/?api=1&query=<lat>,<lon>` to 5 decimals; the clinic name never appears in the URL (also covered by a unit test). Not opened live, to avoid outside calls during QA. |
| AC-4.4 | Free, no account | PASS | Official Google Maps URL, no key |
| D2 privacy line | Thu's own clinic shows "Photos are not looked up automatically for your clinic, so its location stays private.", in the card and as the centre (match within 30 m); other clinics do not | PASS | Checked in both places; not shown for other clinics |
| Form open | The card block is hidden while the "Change" form is open | PASS | `hidden=true` |
| AC-7.1 | Light and dark: text readable and following the theme colours | PASS | Contrast: light, note 7.73 and link 19.17; dark, note 9.72 and link 15.15 (WCAG AA needs 4.5) |
| AC-7.2 | No horizontal scroll at 375 px | PASS | `scrollWidth = clientWidth = 375` in light and dark, on the card and the Competition tab |
| AC-7.5 (partial) | No console errors on load | PASS | 0 errors across 8 loads (2 themes × 2 widths × 2 views) |
| AC-8.1 / "no outside calls" | The page makes no requests outside localhost | PASS | 0 outside requests recorded through the DevTools Network domain |

## 3. Other checks

- **Labels and accents:** the screen texts are English, as requirement §6 asks, and match the spec word for word. Accented listing names display correctly ("Métro Papineau"). `photo.js` is pure ASCII; `index.html` is UTF-8.
- **Security:** the block is built with `createElement` and `textContent`, with no `innerHTML`. The only outside URL is the Google Maps link, which carries no name. `noreferrer` stops the `?hub=` page address from leaking through the referrer.
- **Patient data (Loi 25):** none found. Tests use made-up names ("Clinique Dentaire Exemple", "Fake Dental Centre", "My Test Clinic"). Thu's private `site/content/local.json` is ignored by Git. The increment adds no logs. Nothing is committed yet, so commit history is unchanged.
- **Deploy:** the asset-versioning regex in `.github/workflows/deploy.yml` also matches `assets/photo.js`.

## 4. Defects

| # | Severity | Title |
|---|---|---|
| QA-1 | Low | `dmPhoto.view()` accepts `null` or empty coordinates as 0,0 |

**QA-1. `view()` treats `null` or `''` coordinates as 0,0**
- Steps: `node --input-type=module -e "await import('./site/assets/photo.js'); console.log(globalThis.dmPhoto.view({lat:null,lon:null}))"`. Out-of-range values such as `{lat:91, lon:200}` are also accepted.
- Expected: `null` (hidden state), the same as for a missing or non-numeric location.
- Actual: "Photo not available" with a link to `query=0.00000,0.00000`, because `Number(null)` and `Number('')` are 0.
- Impact: not reachable through the normal page. The clinic form only saves numeric coordinates, and listings always have numbers. It could only happen with hand-edited browser storage. Fix when convenient: reject `null` and `''`, and check `|lat| <= 90` and `|lon| <= 180`.

## 5. Notes (not defects)

- N-1: Work is on branch `clinic-view`, not `team/clinic-photo` as named in the solution design §6. Nothing is committed yet.
- N-2: `CLAUDE.md` is also changed (it now imports `.claude/TEAM.md`), but the developer's file list and the changelog do not mention it.
- N-3: The developer's tests do not cover `null`, empty or out-of-range coordinates (see QA-1).

---

# 04 — QA report: clinic photo, increment 2

- **Date:** 2026-11-14
- **Increment:** 2, the photo choice rules in `site/assets/photo.js` with no outside calls (solution design §7, step 2): `pickPhoto` (R2), `lookupAllowed` / `isMine` (R1), `parseMapillary` / `parsePanoramax`, `credit` / `creditText` (R5), `bbox`, plus the QA-1 fix in `view()`. `app.js` changed one call to `dmPhoto.view(c, clinic)`.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** working tree, still not committed (HEAD `d97ec51`). Same environment as increment 1 (Node 24.22.1, headless Chrome 157, `python3 -m http.server 8123 --directory site`).
- **Verdict: APPROVED** (no blocking defects; 4 low-severity defects for increment 3, listed below)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer tests, `tests/photo.test.mjs`) | 19 / 19 pass (matches the developer's claim) |
| `node tests/qa/qa-photo-inc1.mjs` (increment 1 browser check, regression) | 34 / 34 pass: no console errors, no outside requests, light and dark, 375 px |
| `node tests/qa/qa-photo-inc2.mjs` (new, QA's own checks of the pure rules: boundaries, hostile input, 5,000 and 20,000 rows) | 53 / 57 pass; the 4 failures are the low defects QA-2 to QA-5 |
| `node tests/qa/qa-photo-inc2-browser.mjs` (new, R1 guard as wired in the real page) | 5 / 5 pass |

## 2. Rules checked

| Rule | What was checked | Result | Evidence |
|---|---|---|---|
| R2 spec example | A (12 m, 80° off, 2024), B (30 m, 2016), C (40 m, 2023): C picked | PASS | Both the developer's test and QA's own check (different clinic point and bearings) |
| R2 panoramas | A panorama is dropped even when it is the closest and newest | PASS | Older normal photo picked instead |
| R2 5–50 m | 5.0001 m and 49.999 m kept; 4.9 m, 50.1 m and 0 m dropped | PASS | |
| R2 ≤ 50° | ±49.99° kept, 50.5° dropped, wrap around north (350° vs 10°) handled | PASS | |
| R2 last 5 years first | A recent photo at 48 m beats an old one at 6 m; 4.9 years counts as recent, 5.1 does not | PASS | |
| R2 closest, then 5 m tie → most recent | 24.9 m newer beats 20 m older; 25.2 m does not; same date → closer | PASS | |
| R2 robustness | `null`, strings, empty objects, bad coordinates, `Infinity` angles: no error, `null` result; input list not changed; 5,000 candidates in under 200 ms | PASS | |
| Dev choice: no camera direction → skipped | Matches the spec (R2 requires a direction pointing at the clinic, so a photo without one cannot qualify) | PASS (agreed) | |
| Dev choice: undated → kept, never "recent" | Reasonable: the spec does not cover it, AC-6.2 only asks for a date "when the source gives one", and R5 already has a "no date" credit. An undated photo loses to any recent photo and to a dated photo in a 5 m tie | PASS (agreed) | |
| R1 100 m guard | Spec examples 20 m / 70 m / 400 m; 99.9 m blocked, 100.1 m allowed; `mine` flag alone blocks; invalid centre never looked up; saved clinic with text coordinates still guards; across the ±180° line still guards | PASS | |
| R1 30 m "your clinic" | 29.9 m is mine, 30.1 m is not | PASS | Same 30 m as `hubNow()` in `app.js` |
| R1 wired in the page | Saved fake clinic on one public listing; centre on that listing → `lookup:false` + privacy line; neighbour listing about 55 m away → `lookup:false`, no privacy line; far listing → `lookup:true`; "Your clinic" card → `lookup:false` | PASS | `tests/qa/qa-photo-inc2-browser.mjs` |
| Parsers, broken input | 18 hostile JSON shapes (null, numbers, strings, arrays, wrong types in every field): never an error, always a list | PASS | |
| Parsers, https only | `http:`, `javascript:`, `data:`, `blob:`, `ftp:`, relative and protocol-relative addresses all dropped, for images and for photo-page links | PASS | |
| Parsers, details | Mapillary angle normalised to 0–360 and falls back to `compass_angle`; ISO date accepted; ids URL-encoded in page links; Panoramax `field_of_view` "360" as text → panorama; 20,000 rows parsed fast | PASS | |
| R5 credit | Spec example "Photo: jdupont via Mapillary, CC BY-SA 4.0 · Photo taken June 2023" exact; no-name and no-date variants; Mapillary licence cannot be overwritten by source data; page link https only | PASS | |
| QA-1 fix | `null`, `''`, spaces, `NaN`, `±Infinity`, out-of-range, `undefined`, letters → hidden; ±90/±180 and numeric text still accepted | PASS (see QA-2 for leftovers) | |
| Page unchanged | Same text, link and privacy line as increment 1 in both places | PASS | Increment 1 browser check 34/34 |
| No network calls | No `fetch`, `XMLHttpRequest`, `WebSocket`, `Image` or `sendBeacon` in `photo.js` or the `app.js` change; 0 outside requests in both browser checks | PASS | |

## 3. Other checks

- **Labels and accents:** no new screen text in this increment. Credit texts are English, as the spec says. `photo.js` is pure ASCII (the "·" is written `·`). Accented listing names still display correctly ("Métro Papineau").
- **Security:** source text (contributor names, licence) comes back as plain text for `textContent`; addresses are limited to `https:`. No `innerHTML` or `eval`. No Mapillary key in the code yet.
- **Patient data (Loi 25):** none. Tests use made-up points and fake names ("Fake Contributor", "fakeuser", "QA Fake Clinic"); "jdupont" is the spec's example username. QA browser checks clear browser storage at the end. Nothing committed, so history is unchanged.

## 4. Defects (all Low, none blocks increment 2; fix in increment 3 when the parsers meet real answers)

| # | Severity | Title |
|---|---|---|
| QA-2 | Low | `view()` / `okPoint` still accept `true`/`false`, arrays and hex text as coordinates (`[]` gives 0,0) |
| QA-3 | Low | A photo dated in the future counts as "recent" and wins 5 m ties |
| QA-4 | Low | Panoramax photo without a licence gives a credit line with no licence |
| QA-5 | Low | Capture month is computed in UTC, so evening photos on the last day of a month show the next month |

**QA-2. Some non-number values still pass as coordinates (leftover of QA-1)**
- Steps: `node --input-type=module -e "await import('./site/assets/photo.js'); for (const [a,b] of [[true,false],[[],[]],['0x10','0x20']]) console.log(dmPhoto.view({lat:a,lon:b}).link)"`
- Expected: `null` (hidden), as for `null` and `''`.
- Actual: links to `1.00000,0.00000`, `0.00000,0.00000` and `16.00000,32.00000`, because `Number(true)` is 1, `Number([])` is 0 and `Number('0x10')` is 16.
- Impact: not reachable from the page (the form saves numbers, listings are numbers); only hand-edited browser storage. Simplest fix: accept only `typeof === 'number'`, or text that matches a decimal pattern.

**QA-3. Future capture dates are treated as recent**
- Steps: two photos facing the clinic, one at 20 m dated June 2025, one at 24 m dated January 2099; `pickPhoto(..., now = Nov 2026)`.
- Expected: the real 2025 photo (a date in the future is bad source data).
- Actual: the 2099 photo is chosen and would be labelled "Photo taken January 2099".
- Fix: treat `taken > now` (with a day of tolerance) as undated.

**QA-4. Panoramax credit without licence**
- Steps: `creditText({src:'Panoramax', by:'Fake Person', licence:'', taken: Date.UTC(2020,5,15)})`
- Expected (AC-6.1, R5): the licence the source requires is shown.
- Actual: `Photo: Fake Person via Panoramax · Photo taken June 2020`, no licence.
- Fix (designer to choose): skip Panoramax photos with no licence in `parsePanoramax`, or fall back to the collection's licence. Panoramax normally sends one, so this is rare.

**QA-5. Capture month in UTC**
- Steps: `creditText({src:'Panoramax', by:'Fake', licence:'etalab-2.0', taken: Date.parse('2023-06-30T21:30:00-04:00')})`
- Expected: "Photo taken June 2023" (local Québec date).
- Actual: "Photo taken July 2023".
- Impact: cosmetic, only for photos taken in the evening of a month's last day. Fix: use the viewer's local month (`getMonth()` / `getFullYear()`), or keep UTC and accept it.

## 5. Notes (not defects)

- N-4: `isMine` uses ≤ 30 m and `hubNow()` uses < 30 m; the same in practice.
- N-5: Mapillary rows without `is_pano` and Panoramax rows without `field_of_view` are treated as normal photos. Fine for now: the design asks Mapillary for `is_pano`. Check with real answers in increment 3.
- N-6: The Panoramax page link `https://api.panoramax.xyz/#focus=pic&pic=<id>` and the Mapillary link were not opened, to keep QA free of outside calls. Check them live in increment 3.
- N-1 and N-2 from increment 1 still apply (branch name, `CLAUDE.md` change not listed).

---

# 04 — QA report: clinic photo, increment 3

- **Date:** 2026-11-14
- **Increment:** 3, real Panoramax lookups with no key (solution design §7, step 3): Loading → photo or "Photo not available", 10 s limit (R4), one lookup per clinic per visit (R9), stale-answer guard, credit line (R5), 100 m privacy guard in the page (R1), no Referer. Plus the fixes for QA-2 to QA-5.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** working tree on branch `clinic-view`, still not committed (HEAD `d97ec51`). Changed: `site/assets/photo.js`, `site/assets/app.js`, `site/assets/styles.css`, `site/index.html`, `tests/photo.test.mjs`, `tests/browser/photo-inc3.mjs` (new), `README.md`, `docs/CHANGELOG.md`.
- **Environment:** macOS, Node 24.22.1, headless Chrome 157 (fresh profile, browser cache turned off for QA's own check), `python3 -m http.server 8123 --directory site`, live network to Panoramax.
- **Verdict: APPROVED** (no defects found; 4 notes below, none blocking)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer, `tests/photo.test.mjs`) | 30 / 30 pass (matches the developer's claim) |
| `node tests/browser/photo-inc3.mjs` (developer, live Panoramax) | 21 / 21 pass |
| `node tests/qa/qa-photo-inc1.mjs` (QA regression, updated) | 36 / 36 pass |
| `node tests/qa/qa-photo-inc2.mjs` (QA pure rules, updated) | 58 / 58 pass (the 4 failures of increment 2 are now fixed) |
| `node tests/qa/qa-photo-inc2-browser.mjs` (QA R1 in the page, updated) | 7 / 7 pass |
| `node tests/qa/qa-photo-inc3.mjs` (new, QA's own live check of this increment) | 36 / 36 pass |

QA script updates for this increment (QA files only, no application code touched):
- `qa-photo-inc1.mjs`: the old "no outside calls" check now says: zero outside calls while the centre is Thu's saved clinic (8 loads, both themes, both widths); over the whole run the only outside host is Panoramax; and once the clinic is saved, no Panoramax search box ever covers its point. (The one search for that point happens earlier in the run, before the clinic is saved, which R1 allows.)
- `qa-photo-inc2.mjs`: Panoramax test rows now carry a licence (QA-4 decision). The old QA-4 check is replaced by: rows with no, blank or non-text licence are dropped, and a row with a licence is kept.
- `qa-photo-inc2-browser.mjs`: "no outside calls" replaced by: Panoramax search only; no box covers the saved clinic or its 55 m neighbour; the far listing is looked up exactly once.

## 2. Acceptance criteria and rules in scope

Example with a photo: Centre Dentaire Gagné Rémillard, Sherbrooke (`?hub=45.39869,-71.93327`). QA fetched the live Panoramax answer for that box itself (15 photos, all by one contributor, CC-BY-SA-4.0, 59° field of view) and applied R2 by hand: only photo `21ad9cc0-…` is 5–50 m away **and** within 50° of the clinic direction (40.7 m, 47.3° off). The others are 57–95° off, or 50.8 m and 58.9 m away. The page picked the same photo.

| AC / rule | What was checked | Result | Evidence |
|---|---|---|---|
| AC-1.5 | "Loading photo..." with the Google Maps link shows first; page not blocked | PASS | `Loading photo... · View on Google Maps` |
| AC-1.1 | Photo appears under "Competition around [name]" only once fully loaded | PASS | `naturalWidth` 2048, not hidden, 200 px high on a 1280 px window |
| R2 on real data | Page's choice = QA's hand calculation | PASS | `…/21/ad/9c/c0/8ce2-401d-9bbb-79acd61ffc2c/sd.jpg` |
| AC-6.1 / 6.2 / 6.3, R5 | Contributor, "via Panoramax", licence as given, "Photo taken Month YYYY", sign note, Google Maps link | PASS | `Photo: Ombrefeu via Panoramax, CC-BY-SA-4.0 · Photo taken November 2026 · The photo shows the location, not necessarily the clinic's current sign. · View on Google Maps` (photo taken 2026-11-12 16:42 UTC = November in Québec) |
| R5 photo page link | "Panoramax" links to `https://api.panoramax.xyz/#focus=pic&pic=<id>`, new tab, `noopener noreferrer`; the id exists at Panoramax | PASS | Checked with `api/search?ids=<id>`: 1 result, same id |
| AC-7.3 | Screen reader text, with accents | PASS | `Street view of Centre Dentaire Gagné Rémillard` |
| AC-4.1 / R6 | Google Maps link present in every state, coordinates only | PASS | `…query=45.39869,-71.93327`, `_blank` |
| AC-7.1 | Dark theme with a photo: credit text readable | PASS | Contrast 9.72 (text) and 15.15 (links); 4.5 needed |
| AC-7.2 / 7.4 | 375 px: no horizontal scroll; photo at most about 200 px high | PASS | Developer check run by QA: 309×142 px at 375 px in light and dark, 434×200 on desktop |
| AC-3.1 | Clinic with no photo nearby | PASS | `Photo not available · View on Google Maps` (Québec City and Sherbrooke listings) |
| AC-3.2 / R4 | Search never answers (held by QA) | PASS | "Photo not available" after 10.1 s, no console error |
| AC-3.2 / R4 | Search answers, but the image never arrives (held by QA) | PASS | "Photo not available" after about 10 s: one limit covers search and image |
| AC-3.2 / AC-8.2 | Source down (request failed) | PASS | "Photo not available", no console error from page code |
| AC-3.3 | Image fails to download; and all through fast switching | PASS | No `<img>` element left in the block; a DOM observer logged every change and never saw a visible broken image |
| AC-1.2 | A's search held, switch to B, A's answer released while B is the centre | PASS | Every DOM change logged: A's photo never appeared under B's title. B ends in its own state. |
| AC-1.4 | Click a competitor on the map | PASS | Block follows the new centre (`45.52370,-73.55301`) |
| R9 | A → B → A → B → A in one visit | PASS | 0 new searches for A, 1 for B; A's photo shows again at once. A's late answer (from the AC-1.2 test) was kept: going back to A showed the photo with no new search. |
| R1 100 m guard | Fake clinic saved as typed coordinates north of the photo clinic, then the photo clinic picked as centre | PASS | 25 m: 0 requests, privacy line. 60 m and 98 m: 0 requests, "Photo not available", no privacy line. 103 m: 1 search, photo shown. |
| R1 through the real form | Clinic saved with the "Your clinic" form 70 m away, then centre picked | PASS | 0 requests |
| R1 "Your clinic" card / "Use your clinic" | Card, and "Use your clinic", on the clinic that does have a free photo | PASS | 0 outside requests, no image |
| No Referer | Headers actually sent (DevTools `requestWillBeSentExtraInfo`) for the search and the image | PASS | 0 of 2 requests carry `Referer`; `fetch` uses `referrerPolicy: 'no-referrer'`, `credentials: 'omit'`; images use `referrerPolicy="no-referrer"` |
| Data sent | Only a small box, never a name, the page address or `?hub=` | PASS | `api/search?bbox=-71.93391,45.398241,-71.93263,45.399139&limit=50` |
| Hosts | Only Panoramax hosts | PASS | `api.panoramax.xyz` (search), `panoramax.openstreetmap.fr` (image) |
| AC-7.5 | No console errors from page code, in any check | PASS | 0 |
| AC-8.1 | No key, no account, no cost | PASS | Panoramax answers without a key (CORS allowed) |

Not in scope for this increment: Mapillary (step 4), own photo (US-5, step 5), and the 20-listing hit rate (step 6). The developer reports 0 of 34 Québec City listings with a usable photo today.

## 3. Fixes from increment 2

| # | Check | Result |
|---|---|---|
| QA-2 | `true/false`, `[]`, `{}`, `0x10`, `1e1` → block hidden; `"45.5"` and `" 45.5 "` still accepted | FIXED |
| QA-3 | Photo dated 2099: not chosen over a real 2025 photo, and its credit has no "Photo taken" date | FIXED |
| QA-4 | Panoramax rows with no, blank or non-text licence are skipped by the parser (decision taken by the developer, in line with AC-6.1) | FIXED |
| QA-5 | Québec month: 2023-06-30 21:30 EDT → June 2023; 2024-01-01 03:30 UTC → December 2023; 2023-11-01 03:30 UTC → October 2023 | FIXED |

## 4. Other checks

- **Labels and accents:** screen texts are English, as requirement §6 asks, and match the spec exactly ("Loading photo...", "Photo not available", "View on Google Maps", sign note). Accented names show correctly in the title and alt text ("Gagné Rémillard"). Licence is shown as the source gives it ("CC-BY-SA-4.0"), as R5 says.
- **Security:** source text is put in with `textContent` or as text nodes; no `innerHTML`. Image and page addresses must be `https:`. Links use `noopener noreferrer`. The search uses `credentials: 'omit'`.
- **Patient data (Loi 25):** none. Tests use made-up names ("Fake Test Clinic", "QA Fake Clinic", "Fake Contributor") and public OpenStreetMap listing coordinates. The only real person's name in tests is the public Panoramax pseudonym "Ombrefeu", which is the required photo credit. QA browser checks clear browser storage at the end. No logs added. Nothing committed; `site/content/local.json` is still ignored by Git.

## 5. Defects

None found in this increment.

## 6. Notes (not defects)

- **N-7 (developer's open point, errors and time-outs are kept for the visit).** This matches the spec: R9 says a result "(found or not)" is remembered for the rest of the visit, and R4 asks only for "Photo not available" after an error or time-out. Effect: after a short outage, that clinic shows "Photo not available" until the page is reloaded. Acceptable; the designer may want to say so explicitly in R9.
- **N-8 (privacy, consistent with the documented R1 limit).** If Thu clicks "Remove" on her clinic (or "Change" it to a new location) while her old clinic is the centre of the Competition tab, the page looks up the old location straight away (QA saw 1 Panoramax search for that box). R1 only protects the clinic that is currently saved, so this follows the spec, but Thu may not expect it. Suggest the designer confirms, or clears the centre when the clinic is removed.
- **N-9.** The image is downloaded once to check it loads, then shown by a second `<img>`. Normally the second comes from the browser cache. With caching off, the second download is outside the 10 s limit, and the credit line can appear a moment before the image. No broken image was ever seen.
- **N-10.** The developer's browser check tests R1 only up to 23 m (the 30 m "your clinic" zone). QA covered 60, 98 and 103 m (above).
- N-1 still applies: the branch is `clinic-view`, not `team/clinic-photo`.

To re-run QA's own check: start the server and Chrome as above, then `node tests/qa/qa-photo-inc3.mjs` (needs the network; it holds or fails Panoramax requests on purpose in some checks).

---

# 04 — QA report: clinic photo, increment 5

- **Date:** 2026-11-14
- **Increment:** 5, Thu's own photo of her clinic (solution design §7, step 5; US-5, AC-2.2 to 2.4, AC-5.1 to 5.8, R7), plus the fixes for notes N-8 (privacy after "Remove" / "Change") and N-9 (image downloaded once). Increment 4 (Mapillary) is on hold and not in scope.
- **Tester:** independent QA agent (did not write the code)
- **Build tested:** working tree on branch `clinic-view`, still not committed (HEAD `d97ec51`). Changed: `site/assets/photo.js`, `site/assets/app.js`, `site/index.html`, `site/assets/styles.css`, `tests/photo.test.mjs`, `tests/browser/photo-inc5.mjs` (new), `README.md`, `docs/CHANGELOG.md`.
- **Environment:** macOS, Node 24.22.1, headless Chrome 157 (fresh profile, browser cache off for QA's own check), `python3 -m http.server 8123 --directory site` (it worked for QA, so the older QA scripts ran unchanged), live network to Panoramax.
- **Verdict: APPROVED** (no defects found; notes below, none blocking)

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer, `tests/photo.test.mjs`) | 38 / 38 pass (matches the developer's claim) |
| `node tests/browser/photo-inc5.mjs` (developer, served through DevTools) | 34 / 34 pass |
| `node tests/browser/photo-inc3.mjs` (developer, regression) | 21 / 21 pass |
| `node tests/qa/qa-photo-inc1.mjs` (QA regression) | 36 / 36 pass |
| `node tests/qa/qa-photo-inc2.mjs` (QA pure rules, regression) | 58 / 58 pass |
| `node tests/qa/qa-photo-inc2-browser.mjs` (QA R1 in the page, regression) | 7 / 7 pass |
| `node tests/qa/qa-photo-inc3.mjs` (QA live Panoramax, regression) | 36 / 36 pass. Its N-8 info line now shows 0 searches after "Remove" (was 1 in increment 3). |
| `node tests/qa/qa-photo-inc5.mjs` (new, QA's own check of this increment) | 56 / 56 pass |

The three QA browser scripts the developer could not run were run unchanged with `python3 -m http.server`. No adaptation was needed.

## 2. Acceptance criteria and rules in scope

Test files were made by QA: coloured shapes and random noise drawn by Chrome, plus one JPEG with a hand-built Exif block (made-up GPS 45°12'34" N, 71°56'7" W, a text marker, and Orientation 6 as phones write it). Fake clinic names only.

| AC / rule | What was checked | Result | Evidence |
|---|---|---|---|
| AC-5.1 | "Add your own photo" when there is no photo; "Replace photo" and "Remove photo" once there is one; only when a clinic is saved and the form is closed | PASS | Both scripts; block and buttons hidden while "Change" is open |
| AC-5.1 keyboard | Real `<button>`s; the file input is hidden and out of the tab order; **Enter** on the focused button opens the file chooser | PASS | `Page.fileChooserOpened`, mode `selectSingle`; the file was then given to that chooser |
| AC-5.2 | Photo shown at once in the card: "Your photo · View on Google Maps" | PASS | |
| AC-2.4 / AC-5.2 | "See its competition": own photo under "Competition around QA Fake Clinic" | PASS | alt `Your photo of QA Fake Clinic`, 0 outside requests |
| AC-5.3 | Still there after reopening the page | PASS | Developer check, run by QA |
| AC-5.4 | "Saved in this browser only." next to the buttons (`aria-describedby`); a fresh browser profile has no photo | PASS | Stored in `localStorage` only; no network use |
| AC-5.5 | "Remove photo": storage key deleted, message cleared, back to "Photo not available" with the privacy line | PASS | |
| AC-5.5 / AC-2.3 | "Remove" on the clinic: photo deleted, block and buttons hidden | PASS | `dm-clinic-photo` = `null` |
| AC-2.2 | Location moved about 33 m: photo deleted from storage and screen | PASS | |
| Name-only change keeps the photo | Same values resubmitted; same spot re-entered as a Google Maps `@lat,lon` link; name changed to one with accents | PASS | Key `45.39923,-71.93327` unchanged |
| AC-5.6 | GIF, WebP, SVG → "…Choose a JPEG or PNG image."; text file named .png, empty .jpg → "…could not be read as an image…"; 20 MB + 1 byte → "…larger than 20 MB…"; **real** storage quota (localStorage filled to the byte) → "…storage is full or blocked." Each time the stored photo and the shown photo stay exactly the same, `role="alert"` | PASS | Stored value compared byte for byte before and after |
| AC-5.6 wording (developer extension) | Every message starts with the exact spec sentence "This photo could not be saved in this browser." followed by one short reason | PASS (accepted) | The spec text is kept word for word, and the reason tells Thu what to do. The designer should add the five reason texts to the spec §1.3 (note N-11). |
| 20 MB limit | Exactly 20 MB (20,971,520 bytes) is accepted; one byte more is refused before reading | PASS | |
| R7 size | 4000×3000 PNG → 800×600; 1200×600 → 800 longer side; 300×200 not enlarged; PNG content named .jpg → accepted, JPEG out | PASS | |
| R7 worst case | 2400×2400 random noise PNG | PASS | Saved, 329,411 characters (limit 1,000,000) |
| R7 JPEG out | Stored as `data:image/jpeg;base64,` with JPEG magic bytes FF D8, JFIF header | PASS | |
| R7 Exif / GPS stripped | QA's phone-style JPEG: the stored bytes have no `Exif`, no APP1 marker (FF E1), no text marker | PASS | 3,560-byte JPEG, JFIF only |
| R7 orientation | 1200×600 with Orientation 6 → stored 400×800 (portrait, as the phone shows it), so the rotation is not lost with the Exif data | PASS | |
| AC-5.7 | Zero outside requests while adding, replacing, showing (card and Competition tab); no POST; photo never in the page address | PASS | DevTools Network: only `localhost` and the local `data:` image |
| AC-5.7 | Photo never in project files | PASS | No image files in the working tree; the only JPEG data in tests is a 1×1 fake in `tests/photo.test.mjs` |
| AC-5.8 | No own-photo controls in the Competition tab; another clinic 943 m away as centre never shows the own photo; a listing 60 m from her clinic shows "Photo not available" (no own photo, no lookup) | PASS | |
| Tampered storage | Stored `img` set to an `https:` address, SVG data, a quote-injection string, a photo for another location, or not JSON: nothing shown, "Add your own photo", no outside request, no console error | PASS | |
| Races | A 4000×3000 file being read when the clinic is removed, or when its location changes: nothing saved | PASS | |
| Focus | After adding or replacing, focus stays on the photo button; after "Remove photo", focus moves to "Add your own photo" (the "Remove photo" button disappears) | PASS | `document.activeElement` |
| AC-7.1 / 7.2 | 375 px, light and dark, with photo **and** error message: no horizontal scroll; error, button and "Saved in this browser only." contrast | PASS | Light 19.17 / 19.17 / 7.73; dark 15.15 / 15.15 / 9.72 (4.5 needed); photo 309×200 |
| AC-7.3 | alt "Your photo of [clinic name]", with accents | PASS | `Your photo of QA Fake Clinique Élégance` |
| AC-7.5 | No console errors or warnings from page code across the whole QA run | PASS | 0 |

### N-8 fix (every clinic location saved during the visit stays private)

| Case | Result | Evidence |
|---|---|---|
| Her clinic (a listing with a Panoramax photo) is the centre, then "Remove" | PASS | 0 searches; "Photo not available · View on Google Maps", no privacy line |
| Same, then "Change" to a far location | PASS | 0 searches |
| Clinic loaded with the page, 60 m from that listing; "Remove"; then the listing picked as centre | PASS | 0 searches |
| Clinic saved during the visit 80 m from the listing, moved far away, then the listing picked | PASS | 0 searches |
| Control: a listing 943 m away is still looked up | PASS | 1 search |
| Documented limit: page reopened with no clinic saved, listing looked up as normal | As designed | 1 search |

### N-9 fix (image downloaded once, inside the 10 s limit, credit never before the image)

A DOM observer logged every change of the block with timestamps, and DevTools counted the image downloads with the cache off.

| Case | Result | Evidence |
|---|---|---|
| Live, cache off | PASS | 1 image download; credit and image appear in the same change (both at 580 ms) |
| A → B → A in the same visit | PASS | A's photo shows again, still 1 download |
| Image held about 6 s by QA (inside the limit) | PASS | Shown with credit, 1 download, credit never first |
| Image held about 13 s by QA (past the limit) | PASS | "Photo not available"; no image, no credit at any moment, no second download |
| Image fails | PASS | "Photo not available", never a broken image |

## 3. Other checks

- **Labels and accents:** the screen texts are English, as requirement §6 asks, and match it exactly: "Add your own photo", "Replace photo", "Remove photo", "Your photo", "Saved in this browser only.", "This photo could not be saved in this browser.". Accented names display correctly in the title and alt text ("Élégance", "Gagné Rémillard", "D’implantologie De L’estrie").
- **Security:** the photo is shown only if it is a `data:image/jpeg;base64` value that passes a strict pattern, stays under the size limit and belongs to the saved clinic's location. It is never an outside address or SVG. The page uses no `innerHTML`, `eval` or `document.write`. The clinic name goes into `alt` and `textContent` only. The N-8 list of private locations is kept in page memory, never stored.
- **Patient data (Loi 25):** none. Tests use fake names ("Fake Test Clinic", "QA Fake Clinic", "QA Fake Clinique Élégance") and fake pictures (shapes, noise, a 1×1 JPEG). QA's GPS values are made up. No logs added. Nothing is committed, and no image file is in the working tree. `site/content/local.json` is still ignored by Git. QA's script deletes its temporary pictures and clears browser storage when it finishes.

## 4. Defects

None found in this increment.

## 5. Notes (not defects)

- **N-11 (AC-5.6 wording).** Accepted as an improvement, because the exact required sentence comes first. The designer should add the five reasons to the functional spec §1.3 so the approved text and the page match.
- **N-12 (look of the error).** The error line uses the normal text colour in medium weight. It is readable and announced (`role="alert"`), but it does not look like an error at a glance. Thu may want a warning colour or icon. Cosmetic.
- **N-13 (iPhone photos).** iPhone photos in HEIC format cannot be chosen, because only JPEG and PNG are allowed (as the spec says). On a Mac, export or share the photo as JPEG first. This could be said in the README.
- **N-14 (housekeeping).** Two temporary folders from earlier developer runs remain in the system temp folder (`…/T/dm-inc5-*`, about 22 MB each, fake pictures only, outside the repository). They are safe to delete.
- **N-15 (existing behaviour, outside this increment).** "Change" fills the form with `lat + ', ' + lon`. If a clinic was saved with whole-number coordinates (for example "46.0, -71.0"), the filled text is "46, -71", which the form's location check does not accept. A name-only change then asks for the location again. This is a rare edge case.
- N-1 still applies: the branch is `clinic-view`, not `team/clinic-photo`.

To re-run QA's own check: start the server and Chrome as above, then `node tests/qa/qa-photo-inc5.mjs` (needs the network for the N-8 and N-9 parts).

---

# 04 — QA report: clinic photo, increment 6 (final checks, credits, coverage; N-11 to N-15) and overall verdict

- **Date:** 2026-11-14
- **Increment:** 6 (solution design §7, step 6). Increment 4 (Mapillary) is on hold and out of scope.
- **Branch:** `clinic-view`, nothing committed (as asked). Headless Chrome 157, Node test runner, `python3 -m http.server 8123 --directory site`.
- **QA verdict for increment 6:** ACCEPTED. **Overall verdict for the whole change:** ACCEPTED (see §6).

## 1. Automated tests

| Suite | Result |
|---|---|
| `node --test` (developer unit tests) | 38/38 pass |
| `tests/browser/photo-inc6.mjs` (developer) | 20/20 pass |
| `tests/browser/photo-inc3.mjs` (developer, live Panoramax) | 21/21 pass |
| `tests/browser/photo-inc5.mjs` (developer) | 34/34 pass |
| `tests/qa/qa-photo-inc1.mjs` | 36/36 pass |
| `tests/qa/qa-photo-inc2.mjs` | 58/58 pass |
| `tests/qa/qa-photo-inc2-browser.mjs` | 7/7 pass |
| `tests/qa/qa-photo-inc3.mjs` (live Panoramax) | 36/36 pass |
| `tests/qa/qa-photo-inc5.mjs` (live Panoramax) | 56/56 pass, twice (before and after the timing fix below) |
| `tests/qa/qa-photo-inc6.mjs` (new, QA) | 27/27 pass |
| `tests/coverage/panoramax-coverage.mjs` (developer, live) | 0 of 20, control found, exit 0 |
| `tests/qa/qa-photo-inc6-coverage.mjs` (new, QA, live) | See §2.1 |

**Flaky step in QA's own script (test issue, fixed):** `qa-photo-inc5.mjs` read the card right after clicking "Remove photo", before the page had redrawn. It now waits (up to 5 s) for the redraw with the same `until` helper used elsewhere; if the redraw never comes, the check still fails. The page itself was not at fault.

## 2. Checks in scope

### 2.1 Coverage measurement (0 of 20) — confirmed genuine

| Check | Result | Evidence |
|---|---|---|
| Re-run `node tests/coverage/panoramax-coverage.mjs` | Same 20 listings as the CHANGELOG table, 0 of 20 (Québec City 0/6, Montréal 0/6, regions 0/8) | Every listing: "0 Panoramax photos in the box". Control (Gagné Rémillard, Sherbrooke): photo at 41 m, 47° off, November 2026, CC-BY-SA-4.0 |
| Sample is from `site/data/dentists.json`, Québec only, fixed | PASS | Script filters market ids starting with `24` (Québec), sorts by name, evenly spaced picks; asserts 20 rows and that the control exists. All 5 QA spot-check points were matched back to `dentists.json` |
| Independent query (QA's own box and URL, not `photo.js`) on 5 sample listings + control, at 50 m, 200 m and 1 km, against `api.panoramax.xyz` and `panoramax.openstreetmap.fr` directly | PASS: the 0 is real | At 50 m: 0 photos for every sample listing on both servers; control 15. Wider boxes do return photos (Clinique Portland, Sherbrooke: 33 at 200 m, 100 at 1 km; Paro Chirurgie Montréal: 6 at 1 km on the federated catalogue), so the query, box order (lon/lat) and servers work. There is simply nothing within 50 m |
| Box size | PASS | The page's box is ±50 m (a square, so up to about 70 m in the corners), which covers R2's 50 m limit |

Conclusion: the 0/20 is not a sampling or query bug. Panoramax has almost no street photos in Québec yet, outside parts of Sherbrooke.

### 2.2 README

| Item | Result | Notes |
|---|---|---|
| Credits and licences (Panoramax CC BY-SA 4.0 / etalab-2.0, Mapillary CC BY-SA 4.0 once on, Google Maps link only, own photo stays local, OSM ODbL kept) | PASS | |
| How Mapillary would be switched on (free token, no card, team builds step 4, QA checks) | PASS | |
| "Pasting a token today does nothing" | PASS, and true | `site/assets/photo.js` and `app.js` have no token constant and no Mapillary request; only the Mapillary parser and credit exist |
| HEIC note (N-13) | PASS | Mac export to JPEG, or iPhone "Most Compatible" |
| Coverage summary | PASS | Matches the re-run |
| How to run the tests | PASS | `node --test`, the three browser checks, the coverage script. See N-16 for QA's scripts |

### 2.3 QA notes from increment 5

| Note | Result | Evidence |
|---|---|---|
| N-11 spec clarification | DONE | `docs/02-functional-spec.md` §1.3 lists the five full messages, marked as-built; each matches `photo.js` word for word |
| N-12 error colour | NOT CHANGED, by decision | No warning colour exists in the page; contrast 19.17 light / 15.15 dark, `role="alert"`. Remains a design choice for Thu |
| N-13 README HEIC line | DONE | README "Clinic photos" |
| N-14 temporary folders | DONE | No `dm-*` or `qa-*` folders left in the system temp folder, also after all QA runs today. `photo-inc6.mjs` removes its own folder on exit |
| N-15 rename-only for whole-number coordinates | FIXED | Clinic at 46, -71 with own photo: "Change" fills "46.0, -71.0"; name-only save works, no "No location found", photo kept, alt follows the new name. Moving the location still deletes the photo (AC-2.2). Decimal locations are filled unchanged. Round-trip of `spotNum`/`parseSpot` also checked for 0, 1e-7 and long decimals |

### 2.4 Final page checks (AC-7.x, AC-6.x, AC-4.x)

QA's `qa-photo-inc6.mjs` is stricter than the developer's check: the alt text must match the clinic in the title, the keyboard order is walked with real Tab presses, and the 375 px checks require the street photo to be visible.

| AC | Result | Evidence |
|---|---|---|
| AC-7.3 street photo | PASS | alt "Street view of Centre Dentaire Gagné Rémillard" = title name (accents intact) |
| AC-7.3 own photo | PASS | alt "Your photo of QA Fake Whole Clinic" |
| AC-6.1 / 6.2 / 6.3 | PASS | "Photo: … via Panoramax, CC-BY-SA-4.0 · Photo taken November 2026 · The photo shows the location, not necessarily the clinic's current sign. · View on Google Maps" |
| AC-6.4 | PASS | "Your photo · View on Google Maps", no source credit |
| AC-4.1 / 4.2 | PASS | Both links `target=_blank`, `rel="noopener noreferrer"`; Maps link uses coordinates only |
| Keyboard (AC-7) | PASS | Tab reaches the card's "View on Google Maps", "Replace photo", "Remove photo" in that order; the hidden file input is never focused |
| AC-7.1 light / dark | PASS | Photo block text contrast 19.17 (light) and 15.15 (dark); colours change with the theme |
| AC-7.2 375 px light / dark | PASS | Photo visible, 309×142 px inside a 375 px viewport, no horizontal scroll, rendered ratio = natural ratio |
| AC-7.4 | PASS | Photo height 142 px (≤ about 200) |
| AC-7.5 | PASS | Labels from `meta.json`, OSM credit, limits notes and filters (developer check); OSM credit at 375 px in both themes (QA); 0 console errors or warnings in every run |

## 3. Other checks

- **Labels and accents:** screen texts are English as requirement §6 asks (the team's "French labels" default does not apply here) and match the spec exactly. Accented names (Gagné Rémillard, Trois-Rivières, Québec) show correctly in titles, alt text and the coverage output.
- **Security:** no new code paths besides N-15 (`spotNum` writes a number into a form field with `.value`). No `innerHTML`, `eval` or token in the code. Links use `noopener noreferrer`. The coverage scripts send only coordinates of public OpenStreetMap listings, never names.
- **Patient data (Loi 25):** none in code, tests, docs or logs. Clinic names in the CHANGELOG coverage table are public OpenStreetMap business names (some contain a dentist's name, which is public business data, not patient data). QA tests use fake names ("QA Fake Whole Clinic", "QA Fake Renamed Clinic") and a drawn rectangle as the photo, and clear browser storage at the end. Nothing committed. `site/content/local.json` is still ignored by Git.
- Earlier defects QA-1 to QA-5 re-checked where quick: `view()` with `null`, `''`, out-of-range and boolean coordinates still returns `null`.

## 4. Defects

None found in this increment.

## 5. Notes (not defects)

- **N-16 (README).** The README explains how to run the developer's checks but not QA's scripts in `tests/qa/`, which also need `python3 -m http.server 8123 --directory site`. They are only mentioned in the layout table. A one-line addition would help whoever re-runs QA.
- **N-17 (licence wording).** The page shows the licence exactly as Panoramax sends it ("CC-BY-SA-4.0"), while the README writes "CC BY-SA 4.0". This is allowed by R5 ("licence as given by the source") and is still a valid credit. Cosmetic.
- **N-18 (coverage, for Thu).** With Panoramax only, Thu will almost always see "Photo not available" plus the Google Maps link. The feature works as designed, but AC-1.1 (a photo appears) is in practice met only where Panoramax has photos (some of Sherbrooke). Mapillary (increment 4) is what would make photos common.
- N-12 stays open as a design question for Thu (warning colour for the error line).
- N-1 still applies: the branch is `clinic-view`, not `team/clinic-photo`, and the work is not committed (TEAM.md asks for a commit after each step).

To re-run QA's checks: start the server and Chrome as above, then `node tests/qa/qa-photo-inc6.mjs` and `node tests/qa/qa-photo-inc6-coverage.mjs` (both need the network).

## 6. Overall verdict for the whole change (increments 1, 2, 3, 5, 6)

**ACCEPTED**, for Gate 3, with Mapillary (increment 4) deferred.

| Story | Status |
|---|---|
| US-1 Photo in the Competition tab | PASS (Panoramax only; coverage in Québec is very low, see N-18) |
| US-2 Photo in "Your clinic" card | PASS with the D2 deviation approved in the spec: own photo or "Photo not available", never an automatic lookup |
| US-3 "Photo not available" fallback | PASS |
| US-4 "View on Google Maps" link | PASS |
| US-5 Own photo | PASS |
| US-6 Credit and labelling | PASS |
| US-7 Fits the page | PASS |
| US-8 Zero cost | PASS (Panoramax needs no key; Google Maps is a link only) |

Open defects: none. Open questions for Thu: N-12 (warning colour), N-18 (coverage expectation until Mapillary).
