# Changelog

Entries are added by the virtual IT team after each build or maintenance pass.

## 2026-11-14 — Clinic photo, increment 1: photo area, Google Maps link, "Photo not available"

- New photo area under the chosen clinic's name in the Competition tab ("Clinic at the centre") and in the "Your clinic" card. Stories: US-3, US-4, US-7 (AC-1.3, AC-2.3, AC-3.1, AC-4.1 to 4.4).
- It is hidden when no clinic is chosen and while the "Your clinic" form is open. Otherwise it shows "Photo not available" and a "View on Google Maps" link. The link uses only the coordinates, rounded to 5 decimals, never the name (R6, D3), and opens in a new tab with `noopener noreferrer`.
- For Thu's own clinic, in the card and when it is the centre, a second line says photos are not looked up automatically, to keep its location private (D2).
- No outside calls yet. Mapillary, Panoramax and the own photo come in later increments.
- Files: `site/assets/photo.js` (new, pure rules), `site/assets/app.js`, `site/index.html`, `site/assets/styles.css`, `tests/photo.test.mjs` (new), `README.md`.
- Tests: 5 Node tests (`node --test`) pass. A headless Chrome check found no console errors and no horizontal scrolling at 375 px, in light and dark.

## 2026-11-14 — Clinic photo, increment 2: photo choice rules (no outside calls yet)

- `site/assets/photo.js` now holds the pure rules that increment 3 will use for real lookups (solution design §7, step 2). Stories: US-1, US-2, US-5, US-6, US-8 (rules R1, R2, R5).
  - R2 `pickPhoto`: keeps ordinary photos (no 360° panoramas) taken 5 to 50 m from the clinic with the camera within 50° of the clinic direction; prefers photos from the last 5 years, then the closest, then the most recent when two are within 5 m. Photos with no camera direction are skipped; photos with no date are kept but never count as recent.
  - R1 `lookupAllowed`: no lookup for any point within 100 m of the saved clinic, or for the clinic marked as Thu's own. The block now reports `lookup: true/false`; `app.js` passes the saved clinic so the guard is ready for increment 3. Nothing visible changes yet.
  - Source parsers for Mapillary and Panoramax answers into one shape `{src, url, lat, lon, angle, pano, taken, by, licence, page}`. Bad or unexpected answers give an empty list, never an error. Only `https:` image and page addresses are kept.
  - R5 credit line text, for example "Photo: jdupont via Mapillary, CC BY-SA 4.0 · Photo taken June 2023", with the "no name" and "no date" variants. Also distance, compass bearing and the Panoramax search box (about 50 m).
- Fix QA-1 (Low): the photo block now stays hidden when the coordinates are `null`, empty, not a finite number, or out of range (latitude outside -90..90, longitude outside -180..180).
- Files: `site/assets/photo.js`, `site/assets/app.js` (one line), `tests/photo.test.mjs`, `README.md`.
- Tests: 19 Node tests (`node --test`) pass, including the spec examples for R1 and R2. The increment 1 QA browser check (`tests/qa/qa-photo-inc1.mjs`) still passes 34/34, with no console errors and no outside calls.

## 2026-11-14 — Clinic photo, increment 3: real Panoramax photos (no key)

- When a clinic is the centre of the Competition tab and the R1 guard allows it, the page now looks for a free street photo on Panoramax (solution design §7, step 3). Stories: US-1, US-6, US-8 (AC-1.1, AC-1.2, AC-1.4, AC-1.5, AC-3.1 to 3.3, AC-6.1 to 6.3, AC-7.3, AC-8.2; rules R1, R2, R4, R5, R9).
  - Shows "Loading photo..." with the Google Maps link, then the photo chosen by `pickPhoto` (R2), at most about 200 px high (full width on a phone), with "Photo: [contributor] via Panoramax, [licence] · Photo taken [Month YYYY] · The photo shows the location, not necessarily the clinic's current sign. · View on Google Maps". "Panoramax" links to the photo's page. Screen reader text: "Street view of [clinic name]".
  - The search and the image download share one 10-second limit. On a source error, a slow source, bad data, no suitable photo or an image that fails to load, the block shows "Photo not available" and the link, never a broken image and no console error from page code. The image is only shown once fully loaded.
  - One lookup per location per visit, found or not (R9). Switching clinics quickly never shows the previous clinic's late answer.
  - Privacy (R1): no request is ever made for Thu's saved clinic or any point within 100 m of it, and never from the "Your clinic" card. Requests and images use no-referrer, so the `?hub=` page address is not sent. Only a small box around a public listing is sent, never a name.
  - Checked live: the Panoramax search works from another website without a key (CORS), images come from the Panoramax instances (for example `panoramax.openstreetmap.fr`, `panoramax.ign.fr`) and can be shown on our page, and the photo page link `https://api.panoramax.xyz/#focus=pic&pic=<id>` opens the right photo in the Panoramax viewer, so it is kept as is.
  - Coverage: none of the 34 Québec City listings has a usable photo today. Example with a photo: Centre Dentaire Gagné Rémillard, Sherbrooke (`?hub=45.39869,-71.93327#competition`).
- Fix QA-2 (Low): coordinates must be numbers or plain decimal text; `true`/`false`, arrays, objects and hex or exponent text keep the block hidden.
- Fix QA-3 (Low): a capture date more than a day in the future counts as undated: never "recent", and no "Photo taken" date in the credit.
- Fix QA-4 (Low, decision taken): Panoramax photos with no licence are skipped (AC-6.1 requires a licence).
- Fix QA-5 (Low): the "Photo taken" month is the Québec month (America/Toronto time), not the UTC month.
- Files: `site/assets/photo.js` (lookup `createLookup`, fixes), `site/assets/app.js` (photo block states), `site/assets/styles.css` (photo size), `tests/photo.test.mjs`, `tests/browser/photo-inc3.mjs` (new), `README.md`.
- Tests: 30 Node tests (`node --test`) pass, with a fake source (no network). Live browser check `tests/browser/photo-inc3.mjs` passes 21/21 in headless Chrome 157.

## 2026-11-14 — Clinic photo, increment 5: Thu's own photo for her clinic; QA notes N-8 and N-9

Increment 4 (Mapillary) is on hold until the free key arrives, so this is step 5 of the solution design §7.

- Own photo in the "Your clinic" card. Stories: US-5, US-2, US-7 (AC-2.2, AC-2.3, AC-2.4, AC-5.1 to AC-5.8, AC-7.1 to AC-7.3; rule R7).
  - Buttons "Add your own photo" (becomes "Replace photo" once there is one) and "Remove photo", with "Saved in this browser only." next to them. Shown only when a clinic is saved and the form is closed. Never in the Competition tab and never for other clinics.
  - The file picker takes JPEG or PNG. The photo is read in the browser, shrunk to at most 800 px on its longer side and saved again as JPEG, which drops hidden camera data such as GPS. Transparent PNG areas become white.
  - Size limits: files over 20 MB are refused before reading. The saved photo must fit in 1,000,000 characters of browser storage (about 730 KB; a typical photo is 80 to 200 KB). If it does not fit, the page tries lower JPEG quality (0.85, 0.7, 0.55, 0.4) and refuses it only if it still does not fit.
  - Errors: the message always starts with the exact spec text "This photo could not be saved in this browser." and then says why: "Choose a JPEG or PNG image.", "The file is larger than 20 MB. Choose a smaller photo.", "The file could not be read as an image. Choose a JPEG or PNG image.", "The photo is too detailed to keep in this browser. Choose a smaller photo." or "This browser's storage is full or blocked." The previous photo stays. The message is read out by screen readers (role="alert").
  - Saved in this browser's storage as `dm-clinic-photo` = `{key: "<lat>,<lon>" (5 decimals), img: <JPEG data address>}`. Only a JPEG data address made by the page, for the saved clinic's location, is ever shown. Showing it makes no network request. It is never sent, never in the page address and never in the project files.
  - Shown in the card and, when Thu's clinic is the centre (the existing 30 m match), under the competition title: the photo, then "Your photo · View on Google Maps". Screen reader text "Your photo of [clinic name]". Without a photo, the block is back to "Photo not available" with the privacy line.
  - "Remove" on the clinic deletes the photo. "Change" to a different location deletes it; changing only the name keeps it (AC-2.2).
  - Accessibility: real buttons, keyboard reachable, the hidden file input is out of the tab order; after "Remove photo" the focus moves to "Add your own photo". Light and dark themes; no horizontal scrolling at 375 px.
- Fix N-8 (privacy, decision taken): every clinic location saved during the visit (the one loaded with the page, and every one saved or replaced since) stays private for photo lookups until the page is closed, with the same 100 m guard as R1. So "Remove" or "Change" while the old clinic is the competition centre no longer looks up the old location; the block shows "Photo not available". Chosen over clearing the centre because it also covers a competitor within 100 m of the old location picked later in the visit, and it does not change what the Competition tab shows. The list is kept in page memory only, never stored. After the page is reopened, a removed clinic is no longer known, so it is treated like any listing (the documented R1 limit).
- Fix N-9: the image that the lookup loaded (inside the 10 s limit) is the very one shown on the page, so it is downloaded once and the credit line appears together with it. Checked with the browser cache turned off: one download, credit never before the image.
- Files: `site/assets/photo.js` (own-photo rules `ownPhotoFor`, `ownFileProblem`, `fitSize`, `encodeWithin`, `ownError`; `view` own state; guard list; lookup returns the loaded image), `site/assets/app.js` (own-photo buttons, reading and shrinking, storage, N-8 list, N-9), `site/index.html` (buttons, file input, message line), `site/assets/styles.css`, `tests/photo.test.mjs`, `tests/browser/photo-inc5.mjs` (new), `README.md`.
- Tests: 38 Node tests (`node --test`) pass, with fake data and no network. Browser check `tests/browser/photo-inc5.mjs` passes 34/34 in headless Chrome 157 (fake pictures drawn by Chrome; no request to any outside address while adding or showing the own photo; no console errors). Regression: `tests/browser/photo-inc3.mjs` 21/21 and `tests/qa/qa-photo-inc2.mjs` 58/58 still pass. The QA browser scripts in `tests/qa/` that need `python3 -m http.server` were not run (the server is blocked here).

## 2026-11-14 — Clinic photo, increment 6: final checks, credits, coverage; QA notes N-11 to N-15

Step 6 of the solution design §7. Increment 4 (Mapillary) is still on hold until the free key arrives and is not built.

- **Photo coverage (20 sample Québec listings, rule R2, Panoramax only):** **0 of 20** get a usable photo (Québec City 0 of 6, Montréal 0 of 6, regions 0 of 8), measured 2026-11-14. Panoramax had no photo at all within about 50 m of any of the 20, so no listing was lost to the R2 filters (distance, camera direction, panoramas); there was simply nothing there. Control, not counted: Centre Dentaire Gagné Rémillard, Sherbrooke, does get a photo (41 m away, 47° off, November 2026, CC-BY-SA-4.0), so the method works. Expect "Photo not available" plus the Google Maps link for almost every Québec clinic until Mapillary is switched on. Stories: US-1, US-8 (design §8, coverage risk).
  - Sample: the Québec listings in `site/data/dentists.json` (market ids starting with 24), sorted by name, picked at evenly spaced positions, so a re-run uses the same 20. Names are public OpenStreetMap data. Re-run with `node tests/coverage/panoramax-coverage.mjs`.

  | # | Group | Town | Listing (OpenStreetMap name) | Coordinates | Usable photo |
  |---|---|---|---|---|---|
  | 1 | Québec City | Québec | Centre dentaire des Laurentides | 46.91176, -71.34406 | No |
  | 2 | Québec City | Québec | Centre Dentaire Pellan & Lessard | 46.83815, -71.32032 | No |
  | 3 | Québec City | Québec | Clinique Dentaire LeFrançois | 46.82762, -71.23055 | No |
  | 4 | Québec City | Québec | Clinique DentoPlus | 46.83018, -71.23728 | No |
  | 5 | Québec City | Québec | Dentisterie du Lac | 46.90171, -71.37035 | No |
  | 6 | Québec City | Québec | Ma Santé Dentaire | 46.80909, -71.24817 | No |
  | 7 | Montréal | Montréal | Centre dentaire Art-Dent | 45.51302, -73.68120 | No |
  | 8 | Montréal | Montréal | Centre Dentaire Rose | 45.57151, -73.65067 | No |
  | 9 | Montréal | Montréal | Clinique dentaire Dr Jean-Pierre Tabah | 45.53201, -73.65405 | No |
  | 10 | Montréal | Montréal | Clinique Dentaire Rosemont | 45.55648, -73.56143 | No |
  | 11 | Montréal | Montréal | Dentist (unnamed listing) | 45.59145, -73.57632 | No |
  | 12 | Montréal | Montréal | Paro Chirurgie Montréal | 45.51704, -73.56813 | No |
  | 13 | Regions | Sherbrooke | Clinique Portland | 45.40407, -71.92002 | No |
  | 14 | Regions | Trois-Rivières | Clinique de denturologie Milot & Sauvageau | 46.37768, -72.55178 | No |
  | 15 | Regions | Gatineau | Clinique Dentaire Touraine | 45.47093, -75.71808 | No |
  | 16 | Regions | Drummondville | Clinique dentaire Dr. Nathalie Ross | 45.86549, -72.50241 | No |
  | 17 | Regions | Rimouski | Clinique Dentaire Couture | 48.44661, -68.52706 | No |
  | 18 | Regions | Shawinigan | Clinique Dentaire Giraudo | 46.61963, -72.66193 | No |
  | 19 | Regions | Mont-Laurier | Clinique Dentaire Lachapelle | 46.54854, -75.50900 | No |
  | 20 | Regions | Magog | Dentist (unnamed listing) | 45.26471, -72.14760 | No |

- **Final checks** (new `tests/browser/photo-inc6.mjs`): screen-reader names of the photos ("Street view of …", "Your photo of …"), the photo links and the own-photo buttons; the hidden file input out of the tab order; labels from `meta.json`; the OpenStreetMap credit and the limits notes still on the page; filters; no horizontal scrolling at 375 px in light and dark; no console errors. Nothing needed changing. Stories: US-7 (AC-7.1 to 7.3, AC-7.5).
- **README:** "Data and licences" now gives the photo credits and licences (Panoramax: CC BY-SA 4.0 or etalab-2.0 with the credit line shown under each photo; Mapillary: CC BY-SA 4.0, once switched on; Google Maps is a link only; the own photo stays in the browser). New: how Mapillary would be switched on once a free token exists, the coverage result, the HEIC note, and the new checks. Stories: US-6, US-8.
- **N-11 (doc only):** the five own-photo error messages are added to `docs/02-functional-spec.md` §1.3, marked as an as-built clarification.
- **N-12 (not changed, question for Thu):** the page has no error or warning colour to reuse. Its other error texts (the data-load box and "No location found in that text") use the normal or muted text colours, and `--c1` to `--c5` are reserved for the patient groups. So the error line keeps the normal text colour in medium weight, which reads well: contrast 19.17 in light and 15.15 in dark (4.5 needed), and it is announced with `role="alert"`. A new warning colour would be a design choice for Thu and the designer.
- **N-13:** README says iPhone HEIC photos are not accepted and how to save or export them as JPEG.
- **N-14:** the two leftover temporary folders from earlier test runs (`dm-inc5-*` in the system temp folder, fake pictures only) were deleted. Nothing else was removed. The new browser check removes its own temporary folder even when a step fails.
- **N-15 (fix):** "Change" now fills the location so that the form's own check accepts it: a whole number is written with one decimal ("46.0, -71.0" instead of "46, -71"). The same applies when a listed clinic is picked from the suggestions. Other locations are filled exactly as before. A clinic saved at whole-number coordinates can now be renamed only, and it keeps its own photo. Stories: US-5, US-2 (AC-2.2).
- Files: `site/assets/app.js` (N-15), `docs/02-functional-spec.md` (N-11), `README.md`, `docs/CHANGELOG.md`, `tests/browser/photo-inc6.mjs` (new), `tests/coverage/panoramax-coverage.mjs` (new).
- Tests: 38 Node tests (`node --test`) pass. Browser checks in headless Chrome 157: `photo-inc6.mjs` 20/20 (its N-15 checks fail without the fix, 17/20), `photo-inc3.mjs` 21/21, `photo-inc5.mjs` 34/34; QA's checks with `python3 -m http.server`: `qa-photo-inc1.mjs` 36/36, `qa-photo-inc2.mjs` 58/58, `qa-photo-inc2-browser.mjs` 7/7, `qa-photo-inc3.mjs` 36/36, `qa-photo-inc5.mjs` 56/56 (one earlier run gave 54/56: right after clicking "Remove photo" it reads the page before the next redraw; the rerun passed. A short wait there would make it steady).

## 2026-11-15 — Clinic website, increment 1: websites in the listing data

Step 1 of the solution design §2.7 (iteration 2). No page change: the page ignores the new field for now.

- **Websites in the data (WR1, WR3):** the listings refresh now reads the OpenStreetMap tags `website`, `contact:website` and `url` (in that order) and keeps the first usable address, cleaned as in functional spec 2.2 (new `pipeline/work/weblink.py`, standard library only). It is stored as the optional field `web` in `site/data/dentists.json`, only on listings that have one. When two duplicate listings are merged, a website on the dropped one is kept on the one that stays. Stories: US-13 (AC-13.1, AC-13.2, AC-13.4), US-14 (AC-14.2).
- **Listings-only refresh:** `python pipeline/refresh.py --dentists` rebuilds just the listings and replaces only `site/data/dentists.json` (not `meta.json` or `last_release.txt`). New check, also used by the yearly refresh: the download is refused, and the current file kept, below 3,000 listings or below 75 % of the current file's count (exit code 1). An optional saved Overpass answer file can be passed after `--dentists`. Stories: US-14 (AC-14.3).
- **Refresh report (WR9):** `pipeline/report.json` now has `dentists_web: {canada, quebec}` for both the listings-only and the yearly refresh. Never shown on the page.
- **Run once on 2026-11-15:** 5,728 listings (was 5,714: 20 new, 6 gone in OpenStreetMap), **1,692 with a website in Canada, 140 in Québec** (of 788 Québec listings). 148 of the websites are plain `http://` and kept as is. All 20 Québec sample listings from increment 6 of iteration 1 are still in the file with the same coordinates; 3 of them now have a website.
- Files: `pipeline/work/weblink.py` (new), `pipeline/work/build_dentists.py`, `pipeline/refresh.py`, `site/data/dentists.json` (refreshed through the pipeline), `tests/test_weblink.py` (new), `README.md`, `docs/CHANGELOG.md`.
- Tests: Python `tests/test_weblink.py` 15/15 with shapely (12 rule tests from the spec 2.2 examples and edge cases, plus 3 runs of `refresh.py --dentists` on a temporary copy with a fake Overpass answer: websites, duplicate merge, report counts, `meta.json` untouched, the 75 % and 3,000 refusals); without shapely the 3 refresh runs are skipped. Node `node --test` 38/38. Browser checks with the new data in headless Chrome: `photo-inc6.mjs` 20/20 (no console errors, filters, credit, limits, light and dark at 375 px), `photo-inc3.mjs` 21/21.

## 2026-11-15 — Clinic website, increment 2: link rules for the page (nothing visible yet)

Step 2 of the solution design §2.7 (iteration 2). New `site/assets/web.js` (global `dmWeb`), loaded by the page after `photo.js` but not used yet; the link line comes in increment 3.

- **Safety check in the page (WR1b):** `safeUrl` turns a stored address into a link only if it starts with `http://` or `https://`, has no space, control character or backslash, no user name or password part, a dotted host of real labels and, if any, a port from 1 to 65535; at most 500 characters; it must also parse as a browser URL. Anything else counts as no website. It never throws. Stories: US-13 (AC-13.1, AC-13.4).
- **Site name (WR2):** `siteName` gives the host of the very address the link opens, in lower case, without a leading "www.", port, path or query (for example "cliniquexyz.ca", "m.facebook.com"). Stories: US-9 (AC-9.1), US-13 (AC-13.4, AC-13.5).
- **Search (WR4, WR5):** `isGeneric` (only the WR4 words, ignoring case, accents and punctuation; an empty name counts as generic), `searchText` (name + town; for a generic name, name + address + town, or nothing without an address), `searchUrl` (Google search with the search text only). Stories: US-10 (AC-10.2 to AC-10.4).
- **Thu's clinic (W10, W11, WR6):** `ownListing` (closest listing within 30 m of the saved clinic), `cardLink` (that listing's website or nothing, never a search) and `linkFor` (the link state for the clinic at the centre: website, "Website not listed · Search the web", "Website not listed", or nothing). No search link within 100 m of the saved clinic or of a location saved earlier in the visit; this reuses the iteration 1 guard `dmPhoto.lookupAllowed`. Stories: US-10, US-11 (AC-11.1 to AC-11.3).
- **Fix QA-W1 (Low):** host names with an empty or dash-only part (`https://.`, `https://a..ca`, `https://.ca`, `https://-.-`) are refused, in `pipeline/work/weblink.py` and in `safeUrl`. A single trailing dot (`https://fictive.ca.`) is still accepted.
- **Fix QA-W2 (Low):** the port must be ASCII digits from 1 to 65535 (`:99999`, `:0`, `:²` refused), in both places.
- **QA note:** control characters anywhere in the address (for example `https://fictive.ca/\x07bell`) are now refused in both places too, as `tests/qa/qa_web_inc1_adversarial.py` expects.
- The fixes change nothing in the data: all 1,692 websites in `site/data/dentists.json` still pass both the pipeline and the page check unchanged, so `dentists.json` is not rebuilt.
- Files: `site/assets/web.js` (new), `site/index.html` (loads `web.js`), `pipeline/work/weblink.py`, `tests/web.test.mjs` (new), `tests/test_weblink.py`, `README.md`, `docs/CHANGELOG.md`.
- Tests: Node `node --test` 57/57 (19 new, with the spec examples including the 12 m / 70 m / 400 m example). Python `tests/test_weblink.py` 18/18 with shapely (3 new). QA's `tests/qa/qa_web_inc1_adversarial.py`: 0 problems. Browser regression in headless Chrome 157: `photo-inc3.mjs` 21/21, `photo-inc5.mjs` 34/34, `photo-inc6.mjs` 20/20, QA's `qa-web-inc1-browser.mjs` 15/15 (one first run on a fresh Chrome profile reported Chrome's own `favicon.ico` request as a 404 console error; the rerun passed).
