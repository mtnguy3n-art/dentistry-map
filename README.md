# Dental Market Movers

A static dashboard showing where people are moving in Canada, who they are and how many dental offices serve them, so dentists can decide where to advertise.

## Run it locally

```bash
python3 -m http.server 8123 --directory site
```

Then open http://localhost:8123. It needs a web server because the page loads its data with `fetch`, so opening `index.html` directly won't work.

## Run the tests

```bash
node --test
```

Needs Node 18 or later, with no packages to install. The tests are in `tests/` and use made-up clinics and coordinates only. They cover the clinic photo rules: which street photo is chosen, the 100 m privacy guard around your own clinic, reading Mapillary and Panoramax answers, the credit line, the Google Maps link, the Panoramax lookup (time limit, errors, one lookup per clinic, fast clinic switching, the image downloaded once), and your own photo (which files are accepted, shrinking to 800 px, the storage budget, the error messages, and which clinic it belongs to). They also cover the clinic website link rules in `tests/web.test.mjs`: which stored addresses may become a link, the site name shown, the "Search the web" text (name and town, or name, address and town for a generic name such as "Dental Office"), and that no search link is ever made for your clinic or within 100 m of it. They make no network calls: the lookup tests use a fake source.

**Browser check of the clinic photo (live Panoramax):** start Chrome with `--headless=new --remote-debugging-port=9333`, then run `node tests/browser/photo-inc3.mjs`. It serves `site/` to Chrome itself, so no web server is needed, and it calls the real Panoramax service. It checks the loading text, the photo and its credit line, "Photo not available" when there is no photo, when the source fails or is too slow (10 s), fast clinic switching, light and dark at 375 px, and that nothing is ever asked for your own clinic or within 100 m of it.

**Browser check of your own photo:** with the same Chrome, run `node tests/browser/photo-inc5.mjs`. It makes fake test pictures in Chrome and gives them to the real file picker. It checks add, replace and remove, the shrinking to 800 px, that the photo is still there after reopening the page and shows as the competition centre, the error messages (not an image, a broken file, over 20 MB, storage full), that nothing is sent anywhere, light and dark at 375 px, that "Remove" or "Change" on your clinic never looks up its old location, and (live Panoramax) that a street photo is downloaded once and its credit never shows before it.

**Final browser check:** with the same Chrome, run `node tests/browser/photo-inc6.mjs`. It checks that a clinic saved at whole-number coordinates (for example 46.0, -71.0) can be renamed with "Change" and keeps its photo, that the own-photo error line is readable in light and dark, the screen-reader names of the photos, links and buttons, and a regression of the page: labels from `meta.json`, the OpenStreetMap credit, the limits notes, the filters, no horizontal scrolling at 375 px and no console errors.

**Browser check of the clinic website links:** with the same Chrome, run `node tests/browser/web-inc345.mjs`. It checks the website part of the line under "Competition around [clinic]" ("Website: [site name]", "Website not listed · Search the web", or "Website not listed" alone for a generic name with no address), the note sentence under the competing clinics table, the website in the "Your clinic" card (never a search) with "Change" and "Remove", "Use your clinic", no search near your clinic, the small "Website" links in both clinic tables and that clicking one changes nothing on the page, screen-reader names, new tab with no referrer, light and dark at 375 px, and that the page never contacts a clinic site or Google by itself. To look by hand: `?hub=45.40933,-71.85909#competition` (Clinique Dentaire Sherbrooke, shows "Website: cliniquedentairesherbrooke.ca") and `?hub=45.51432,-73.56878#competition` (Dr Lac Long Ly, Montréal, shows "Website not listed · Search the web").

**Photo coverage measurement:** `node tests/coverage/panoramax-coverage.mjs` (needs the network, no Chrome). It takes the same 20 Québec listings from `site/data/dentists.json` every time (6 Québec City, 6 Montréal, 8 regional towns), asks Panoramax for each with the page's own rules and prints which ones get a usable photo. A Sherbrooke listing known to have a photo is checked as a control and not counted. Only listing coordinates are sent, never a name.

## Clinic photos

When you choose a clinic as the centre of the Competition tab, the page looks for a free street photo of it on [Panoramax](https://panoramax.fr) (no key or account needed). It shows "Loading photo...", then the photo with its credit, licence and date, or "Photo not available". The "View on Google Maps" link is always there. Your own clinic, and any clinic within 100 m of it, is never looked up.

**Your own photo:** once your clinic is saved in the "Your clinic" card, click "Add your own photo" and pick a JPEG or PNG (up to 20 MB). iPhone photos are often HEIC, which is not accepted: on a Mac, open the photo in Photos and use File → Export → Export 1 Photo with JPEG as the kind (or set the iPhone to Settings → Camera → Formats → Most Compatible) before adding it. The page shrinks it to 800 px, saves it in this browser only and shows it in the card and in the Competition tab when your clinic is the centre. "Replace photo" and "Remove photo" are next to it. Removing your clinic, or changing its location, deletes the photo; changing only the name keeps it. The photo is never uploaded, never in the page address and never in the project files. Use a fake or test picture when trying it out.

To see a street photo, open for example http://localhost:8123/?hub=45.39869,-71.93327#competition (Centre Dentaire Gagné Rémillard, Sherbrooke).

**Coverage today is very thin.** On 2026-11-14, 0 of 20 sample Québec listings (6 Québec City, 6 Montréal, 8 regional towns) had a usable Panoramax photo; Panoramax had no photo at all within about 50 m of any of them. So expect "Photo not available" and use the "View on Google Maps" link for almost every clinic until Mapillary is on. The list is in `docs/CHANGELOG.md` (increment 6), and the measurement can be re-run (see "Run the tests").

**Mapillary (not switched on yet).** The design adds Mapillary, which has much better street-photo coverage in Québec, ahead of Panoramax (`docs/03-solution-design.md` §3 and §7, step 4). It needs a free Mapillary client token, so that step is on hold. To switch it on:

1. Whoever owns the project's accounts creates a free developer account at mapillary.com (Meta login or email; no billing, no card) and registers an app to get its client token. The token is read-only and public in the page, as in Mapillary's own viewer, and can be replaced in minutes.
2. The team builds step 4: one token constant in `site/assets/photo.js` (empty means Panoramax only), the Mapillary search first and Panoramax when Mapillary has nothing suitable or fails, with tests with no token, a good token and a wrong token. The rules for choosing a Mapillary photo and its credit line are already in `photo.js`.
3. The token is pasted into that constant and QA checks it before it is merged.

Pasting a token today does nothing: the constant and the Mapillary lookup are not built yet.

## Deploy with Git

The site is plain files in `site/`, with no build step.

**GitHub Pages:**

1. Push this repository to GitHub.
2. In the repository, go to Settings → Pages and set Source to **GitHub Actions**.
3. Every push to `main` that changes `site/` now deploys it.

GitHub Pages sites are public, and a private repository needs a paid GitHub plan to use Pages.

**Netlify, Vercel or Cloudflare Pages:** connect the repository, leave the build command empty and set the publish directory to `site`.

## Update the data

Statistics Canada updates the market data each January.

- **On GitHub:** run **Refresh data** from the Actions tab. It opens a pull request when there's new data, and merging it publishes the update. First turn on Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
- **Locally:**

  ```bash
  python3 -m venv .venv
  .venv/bin/pip install -r pipeline/requirements.txt
  .venv/bin/python pipeline/refresh.py
  ```

The workflow is also scheduled for February 1, but GitHub turns schedules off in public repositories after 60 days with no activity, so plan to run it by hand. The scheduled time is 14:00 UTC.

**Dentist listings only** (for example to pick up clinic websites added in OpenStreetMap since the yearly refresh):

```bash
.venv/bin/python pipeline/refresh.py --dentists
```

It downloads the dentist listings from OpenStreetMap (Overpass, about 1 to 3 minutes) and replaces only `site/data/dentists.json`; `meta.json` and `pipeline/last_release.txt` are left alone. It refuses the download, keeps the current file and exits with code 1 if it has fewer than 3,000 listings or fewer than 75 % of the current file. If Overpass is slow, save its answer to a file and pass it: `pipeline/refresh.py --dentists saved-overpass.json`. `pipeline/report.json` gives the listing count and `dentists_web`, the number of listings with a website for Canada and Québec. These counts are for the team only and are never shown on the page. The website of each listing comes from the OpenStreetMap tags `website`, `contact:website` or `url`, cleaned by `pipeline/work/weblink.py` (only `http`/`https` addresses with a real host name, no empty host part and a port from 1 to 65535 are kept; e-mail addresses, `javascript:` and similar are dropped), and stored as the optional field `web`.

`site/data` is only replaced when every check in `pipeline/refresh.py` passes. Dates shown on the page come from `site/data/meta.json`, which the refresh writes.

## Layout

| Path | What it is |
|---|---|
| `site/index.html` | Page layout |
| `site/assets/app.js` | Charts, maps, tables and filters |
| `site/assets/dash.js` | Loads data, holds filters, redraws |
| `site/assets/photo.js` | Rules for the clinic photo block (photo choice, privacy guard, source parsing, credit line, Google Maps link, Panoramax lookup, own-photo rules), tested in Node |
| `site/assets/web.js` | Rules for the clinic website links (safety check of a stored address, site name shown, search text and Google search link, Thu's own listing and the no-search rule within 100 m of her clinic), tested in Node. Used by `app.js` for the line under the clinic name, the card and the table links |
| `site/assets/styles.css` | Styles, including light and dark themes |
| `site/data/` | Data files used by the page |
| `tests/` | Node tests (`node --test`); Python tests for the pipeline (`.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`, the refresh tests are skipped without shapely); `tests/browser/` has the browser checks, `tests/qa/` QA's own checks, `tests/coverage/` the photo coverage measurement |
| `pipeline/` | Scripts, boundaries and saved 2021 Census results |

## Data and licences

- Statistics Canada data: [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- Dentist pins: © OpenStreetMap contributors, [Open Database Licence](https://www.openstreetmap.org/copyright). Keep this credit on the page.
- Clinic street photos: [Panoramax](https://panoramax.fr) contributors, under the licence each photo carries, either [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) or [Licence Ouverte 2.0 (etalab-2.0)](https://www.etalab.gouv.fr/licence-ouverte-open-licence/). Both allow reuse with credit. The page shows the credit under each photo: "Photo: [contributor] via Panoramax, [licence] · Photo taken [Month YYYY]", with "Panoramax" linking to the photo's page. Photos with no licence are never shown. Faces and licence plates are blurred by Panoramax. The photos are shown from Panoramax's servers, never copied into this repository.
- Mapillary (once switched on, see "Clinic photos"): imagery by Mapillary contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), commercial use allowed with credit. The credit line will read "Photo: [contributor] via Mapillary, CC BY-SA 4.0 · Photo taken [Month YYYY]", with "Mapillary" linking to the photo on mapillary.com.
- "View on Google Maps" is only a link (Google's free Maps URLs, no key). No Google content is shown on the page.
- Clinic websites come from the OpenStreetMap listing (`website`, `contact:website` or `url` tag) and may be missing or out of date; the page says so under the competing clinics table. "Search the web" is a plain Google search link (free, no key). The page never opens, checks or loads a clinic website or a search page by itself; only a click does, in a new tab with no referrer.
- Your own clinic photo is yours. It stays in your browser and is never published or added to the repository.
- D3 7.9.0 (`site/assets/d3.min.js`): ISC licence.
