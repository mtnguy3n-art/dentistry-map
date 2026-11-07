# Dental Market Movers

A static dashboard showing where people are moving in Canada, who they are and how many dental offices serve them, so dentists can decide where to advertise.

## Run it locally

```bash
python3 -m http.server 8123 --directory site
```

Then open http://localhost:8123. It needs a web server because the page loads its data with `fetch`, so opening `index.html` directly won't work.

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

`site/data` is only replaced when every check in `pipeline/refresh.py` passes. Dates shown on the page come from `site/data/meta.json`, which the refresh writes.

## Layout

| Path | What it is |
|---|---|
| `site/index.html` | Page layout |
| `site/assets/app.js` | Charts, maps, tables and filters |
| `site/assets/dash.js` | Loads data, holds filters, redraws |
| `site/assets/styles.css` | Styles, including light and dark themes |
| `site/data/` | Data files used by the page |
| `pipeline/` | Scripts, boundaries and saved 2021 Census results |

## Data and licences

- Statistics Canada data: [Open Government Licence – Canada](https://open.canada.ca/en/open-government-licence-canada).
- Dentist pins: © OpenStreetMap contributors, [Open Database Licence](https://www.openstreetmap.org/copyright). Keep this credit on the page.
- D3 7.9.0 (`site/assets/d3.min.js`): ISC licence.
