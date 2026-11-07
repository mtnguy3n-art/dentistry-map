# Dental Market Movers

Static dashboard for Canadian dentists: where people are moving, who they are and how many dental offices serve them. See README.md for running, deploying and refreshing.

## Working here

- `site/` is plain HTML, CSS and JS with no build step. Preview with `python3 -m http.server 8123 --directory site`.
- `site/assets/app.js` draws everything through `dash.draw(name, fn)`, matched to `data-draw="name"` elements. `dash.js` lists the datasets and filter defaults, so add new ones there.
- Never hard-code a data date in the page. Use `<span data-label="key">` or `label('key')`, with keys from `site/data/meta.json` written by `pipeline/refresh.py`.
- Change data through `pipeline/`, not by editing `site/data` by hand.
- Colours come from CSS variables in `styles.css`, with separate light and dark values. `--c1` to `--c5` are the five patient groups, in a fixed order.

## Rules for the numbers

- Market: a Statistics Canada census division (293). Postal area: a forward sortation area.
- New residents and people leaving are estimates, because domestic moves are net-only at market level. Arrivals and departures aren't published by city.
- Keep these limits visible on the page: postal-area data is the 2021 Census, a pandemic year; ages stand in for household type; offices are locations with employees, not dentists.
- Dentist pins are OpenStreetMap and only about a third complete. Never use them for a count, ranking or people-per-office figure, and keep the credit on the page.
- Postal areas are matched to cities by boundary overlap (`pipeline/work/build3.py`). Whole-area figures can include people outside the city.
- Default ranking is new residents per dental office. It's unreliable where office counts are small.
- Treatment suggestions are marketing starting points, not clinical guidance.

## When 2026 Census data arrives

Rebuilding postal-area data needs the Census Profile fetch and new boundaries. `pipeline/work/cen.pkl` and `stage1.json` hold saved 2021 results, and boundaries in `pipeline/geo` are 2021.
