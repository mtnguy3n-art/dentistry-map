# 02 — Functional spec

This file holds one section per iteration, newest first. Earlier iterations are kept as written.

- Iteration 2 (2026-11-15): link to each clinic's website (US-9 to US-15)
- Iteration 1 (2026-11-14, live): clinic photo when a clinic is chosen (US-1 to US-8)

---

# Iteration 2 — Link to each clinic's website

Input: `docs/01-requirements.md`, section "Iteration 2" (US-9 to US-15, decisions W1 to W8). Status: draft for Gate 2.
Screen texts stay in English, like the rest of the page (requirements §2.7). Exact texts are in quotes.

## 2.0 Decisions taken for Thu (she asked the team to decide; she judges the result)

| # | Decision | Why | Stories |
|---|---|---|---|
| W9 | The website or fallback is added **on the same line as "View on Google Maps"**, after it, inside the existing photo block. Nothing else in the photo block changes (photo, "Loading photo...", "Photo not available", credit, privacy line). | Requirement W2 / AC-9.1; one place to look; photo area stays as it is (W1). | US-9, US-10, US-11 |
| W10 | **Which listing is "Thu's clinic"** for its website: the closest OpenStreetMap listing within 30 m of her saved clinic (the existing "your clinic" match). If that listing has no website, no website line. | Same match the page already uses; no new rule to learn. | US-11 |
| W11 | **No search link near Thu's clinic**: no "Search the web" link for any centre within 100 m of her saved clinic, or within 100 m of any clinic location she saved earlier in the same visit (the iteration 1 privacy guard R1 and fix N-8, reused as is). Such a centre shows its own listing website if it has one, otherwise no website line at all. | Keeps "your clinic stays in your browser" (W6, AC-11.3). | US-10, US-11 |
| W12 | **Generic names** ("Dentist", "Dental Office", "Clinique dentaire", "Centre dentaire" and similar, rule WR4) are searched with the street address and town added; with no address, no search link. | A search for "Dental Office Calgary" would not find the clinic; the address makes it findable. Extends AC-10.3 from "Dentist" to all name-less listings. | US-10 |
| W13 | **US-15 (Could, type my own website) is not built** in this iteration. | Thu knows her own website; the card already links to her listing's site when known. Keeps the change small. Can be added later in about an hour if she asks. | US-15 |
| W14 | Website addresses are **cleaned once, in the data refresh**, and checked again for safety in the page. A new refresh option rebuilds only the clinic listings, so the websites arrive now instead of at the next yearly refresh. | Clean data, correct counts in the refresh report, and no wait until February. | US-13, US-14 |

## 2.1 Screens and flows

### 2.1.1 The website part of the link line (shared by both places)

The photo block already ends with a small line that contains "View on Google Maps". The website part is appended to that line, separated by " · ". It has one of four states:

| State | What is appended after "View on Google Maps" | When |
|---|---|---|
| Website | " · Website: [site name]" where "Website: [site name]" is one link | The listing has a usable website (rule WR1). |
| Search | " · Website not listed · Search the web" where only "Search the web" is a link | No usable website, the centre is not near Thu's clinic (W11), and a search can be built (WR4). Competition tab only. |
| Not listed, no search | " · Website not listed" (no link) | No usable website, not near Thu's clinic, but the listing has a generic name and no address (AC-10.3). Competition tab only. |
| None | Nothing appended | No clinic chosen (the whole block is hidden, AC-9.4); or the centre / card is Thu's clinic or near it and no website is known (AC-11.2, W11). |

Examples of a full line:
- "Photo not available · View on Google Maps · Website: cliniquexyz.ca"
- "Loading photo... · View on Google Maps · Website not listed · Search the web"
- "Photo: jdupont via Panoramax, CC-BY-SA-4.0 · Photo taken June 2023 · The photo shows the location, not necessarily the clinic's current sign. · View on Google Maps · Website: facebook.com"
- Thu's card: "Your photo · View on Google Maps · Website: macliniquefictive.ca" or just "Photo not available · View on Google Maps" (plus the existing privacy line underneath).

Rules for all states:
- The website part is decided at once from the page data, with no outside call, so it never waits for the photo (AC-9.5). It is the same in every photo state (Loading, Free photo, Own photo, Not available).
- Links open in a new tab; the opened site cannot control the dashboard and is not told the dashboard's address (AC-9.2, AC-10.2, AC-13.3). Same look as "View on Google Maps" (existing `.dm-photo a` style, light and dark).
- Screen reader: the website link reads "Website: [site name]"; "Search the web" is announced as "Search the web for [clinic name]".
- Long addresses never overflow: only the site name is shown (WR2), and the line wraps at 375 px (AC-14.4; the block already breaks long words).

### 2.1.2 Competition tab, "Clinic at the centre" (US-9, US-10, AC-11.3)

Location: the link line of the photo block under "Competition around [clinic name]".

Flow:
1. Thu picks a clinic (suggestions, a competitor on the map, "Use your clinic", or a shared link).
2. If the centre is within 100 m of her saved clinic or of a clinic location saved earlier in this visit (W11): Website state if its listing has a website (for her own clinic: the W10 listing), otherwise None.
3. Otherwise: Website state if the listing has a usable website; otherwise Search state, or "Not listed, no search" for a generic name without address.
4. Picking another centre redraws the line for the new clinic at once. The previous clinic's website is never shown with the new name (AC-9.3).

### 2.1.3 "Your clinic" card (US-11)

Location: the link line of the card's photo block, under the clinic name.
- Website state if the W10 listing has a usable website; otherwise None. Never "Website not listed", never "Search the web" (AC-11.2).
- "Change" to a new location or "Remove" redraws the line from the new location, or hides it with the block (AC-11.4). While the form is open, the block is hidden, as today.

### 2.1.4 "Competing clinics" table and "Nearest dental listings" table (US-12)

- In the Name cell, after the clinic name (and after "(closed note)" when there is one), a small link "Website" when the row's listing has a usable website. Nothing when it has none (AC-12.3). No search link in tables.
- Screen reader name: "Website of [clinic name]" (AC-12.4).
- Opens in a new tab with the same safety as above. Clicking it does not change the centre, the sort order or the service choices (AC-12.5; the table click handler only reacts to column headers).
- Rows near Thu's clinic follow the same rule automatically: a link only if known, never a search (AC-12.6).

### 2.1.5 Note under the "Competing clinics" table (AC-14.1)

The existing note gets one sentence, placed just before "Map data © OpenStreetMap contributors.":
"Website links come from the OpenStreetMap listing and may be missing or out of date."
The OpenStreetMap credit and the limits text stay as they are.

## 2.2 Business rules

**WR1 — Usable website (US-13), applied by the data refresh.**
For each listing, look at the OpenStreetMap tags in this order: `website`, `contact:website`, `url`. Split each value on ";" and take the **first piece that passes** all of:
1. Trim spaces. Empty: skip.
2. Contains a space, or contains "@" before any "/" (an e-mail address): skip.
3. Starts with "http://" or "https://" (any letter case): keep as is. Starts with any other scheme ("javascript:", "mailto:", "tel:", "ftp:", "//", ...): skip. No scheme at all: add "https://" in front.
4. The result must have a host name of letters, digits, "-" and "." only, with at least one "." (so "cliniquexyz" alone is refused), no user name or password part, and be at most 500 characters.
If no piece passes in any tag, the listing has no website.

Examples:
| Tag values | Result |
|---|---|
| website=`https://www.cliniquexyz.ca/fr/accueil` | `https://www.cliniquexyz.ca/fr/accueil` |
| website=`www.cliniquexyz.ca` | `https://www.cliniquexyz.ca` |
| website=`cliniquexyz.ca;https://facebook.com/xyz` | `https://cliniquexyz.ca` |
| website=`mailto:info@xyz.ca`, contact:website=`xyz.ca` | `https://xyz.ca` |
| website=`javascript:alert(1)` | none |
| url=`info@xyz.ca` | none |
| website=`Clinique XYZ` | none |
| website=`https://good.ca@evil.com` | none (user part) |
| website=`http://xyz.ca` | `http://xyz.ca` (kept, not upgraded, so the link still works) |

**WR1b — Safety check in the page (defence in depth).** The page only turns a stored address into a link if it starts with "http://" or "https://", has a dotted host and no user name or password. Anything else is treated as no website. So a bad value in the data file can never become a dangerous link.

**WR2 — Site name shown (AC-9.1, AC-13.4).** Taken from the very address the link opens: its host name, in lower case, without a leading "www." and without port, path or query.
Examples: `https://www.CliniqueXYZ.ca/fr/accueil` → "cliniquexyz.ca"; `https://m.facebook.com/xyz` → "m.facebook.com"; `http://xyz.ca:8080/a` → "xyz.ca". A social media page is accepted and shown by its site name (AC-13.5).

**WR3 — Duplicate listings.** The refresh already drops duplicate listings (same name, same spot to about 100 m). If the kept listing has no website but a dropped duplicate has one, the website is kept on the kept listing.

**WR4 — Search text (US-10).**
- A name is **generic** when, ignoring case, accents and punctuation, it is made only of these words: dentist, dentists, dentiste, dentistes, dental, dentaire, dentistry, denturist, denturologiste, office, clinic, clinique, centre, center, cabinet, care, soins, de, du, des, la, le, the. Examples: "Dentist", "Dental Office", "Clinique dentaire", "Centre Dentaire". Not generic: "Clinique Dentaire Couture", "Altima Dental".
- Town: the page's existing town for the listing (the municipality name, or the market name if not found), the same one shown in the clinic suggestions.
- Named listing: search text = name + " " + town. Example: "Clinique Dentaire Couture Rimouski".
- Generic name with an address: name + " " + address + " " + town. Example: "Dentist 292 Freshwater Road St. John's".
- Generic name without an address: no search link ("Not listed, no search" state).
- Empty parts are left out; spaces are collapsed.

**WR5 — Search link.** `https://www.google.com/search?q=<search text, URL-encoded>`. Contains nothing else: no page address, radius, filters or anything about Thu's clinic (AC-10.4). Free, no account.

**WR6 — Thu's clinic and its surroundings (W6, W10, W11).**
- Card: website of the closest listing within 30 m of the saved clinic, if it has one; else nothing.
- Centre that is Thu's clinic: same as the card.
- Centre within 100 m of the saved clinic or of a location saved earlier this visit, but not her clinic: that listing's own website if any; else nothing.
- Example: saved clinic at P. Listing A 12 m from P with website `https://macliniquefictive.ca`: card and centre show "Website: macliniquefictive.ca". Competitor B 70 m away without website, chosen as centre: nothing appended (no search). Competitor C 400 m away without website: "Website not listed · Search the web".
- Limit (same as iteration 1): before Thu saves her clinic, the page does not know which listing is hers; choosing her own listing as the centre then offers a search like any other listing. The search only opens if she clicks it, and only contains the public listing's name and town.

**WR7 — Nothing happens without a click (W8, AC-14.6).** The page never loads, checks or prefetches a clinic website or a search page. The links are plain links.

**WR8 — Meaning (AC-10.5).** "Website not listed" means only that the OpenStreetMap listing has no website; the note (2.1.5) says where links come from.

**WR9 — Refresh report (AC-14.2).** Each refresh that rebuilds the listings reports the number of listings with a website, for Canada and for Québec (markets whose id starts with 24). These counts are for Thu and the team only, never shown on the page (CLAUDE.md: pins are never used for counts on the page).

**As-built clarifications (2026-11-15, fix round 1 of increment 2; PM decision and QA-W3 to QA-W5)**
- **WR4 generic words, extended (PM decision):** besides the list above, these words also count as generic: dentaires, cliniques, clinics, centres, centers, offices, cabinets, soin, denturists, denturiste, denturistes, denturologistes, denture, dentures, family, familiale, familial, dentisterie, and, et. So "Cliniques dentaires", "Soins dentaires", "Denture Clinic", "Denture Centre", "Family Dentistry", "Family Dental Care" and "Dentisterie familiale" are searched with their address (or get "Website not listed" without one). Still not generic: "Fake Family Dentistry", "Denture Clinic Fictive".
- **WR6 "Centre that is Thu's clinic" (QA-W5):** means the "Use your clinic" centre (her saved point) or her own W10 listing, not any listing within 30 m. Another clinic in her building chosen as the centre shows its own website, or nothing (W11 still applies: no search within 100 m). Thu's website is never shown under another clinic's name (AC-9.3).
- **WR1 / WR1b, same rule in both places (QA-W3):** a host whose last part is a number (all digits, or "0x" hex) is refused unless it is a plain dotted IPv4 address (four numbers 0 to 255 without leading zeros). Spaces and control characters are one explicit list in both the refresh and the page: ASCII space and control characters, U+0080 to U+00A0 (including U+0085), the Unicode spaces U+1680, U+2000 to U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, and U+FEFF; plus backslash. None of the 1,692 stored websites changes.
- **WR5 (QA-W4):** half of a broken Unicode character pair (a lone surrogate) in the name, address or town is dropped from the search text, so the search link can always be built.

## 2.3 Data

| Entity | Fields | Where it lives | Patient data? |
|---|---|---|---|
| Clinic listing (existing, extended) | name, address, lat, lon, city_id, market_id, **web (new, optional: cleaned website address, only present when known)** | `site/data/dentists.json`, built by `pipeline/` from OpenStreetMap | No. Public listing data (ODbL). |
| Saved own clinic (existing, unchanged) | name, lat, lon | This browser's storage (`dm-clinic`) | No. Business-private to Thu; never sent to a search engine. |
| Refresh report (existing, extended) | **dentists_web: {canada, quebec}** | `pipeline/report.json` (not published) | No |
| Search text (temporary) | name, address, town of a public listing | Only inside the link address; leaves the browser only when Thu clicks | No |

No patient data is read, stored or sent by this change.

## 2.4 Error and edge cases

| Case | Behaviour | Story |
|---|---|---|
| Listing has several websites in one value | First valid one (WR1) | AC-13.2 |
| Website without "https://" | "https://" added | AC-13.1 |
| "javascript:", "mailto:", "tel:", e-mail, text with spaces, empty | Treated as no website | AC-13.1 |
| Address with a hidden user part (`https://a.ca@b.com`) | Treated as no website | AC-13.4 |
| Bad value in the data file despite the refresh | Page check WR1b refuses it | AC-13.1 |
| Facebook or other social page | Accepted, shown as "Website: facebook.com" | AC-13.5 |
| Website is dead or moved | Link still shown; the note says links may be out of date. The page never checks it. | AC-14.1, W8 |
| Generic name, no address | "Website not listed", no search link | AC-10.3 |
| Town not found for a listing | Search uses the name (and address if generic) only | AC-10.2 |
| Centre within 100 m of Thu's clinic, no website | Nothing appended | AC-11.3 |
| Thu's clinic entered by a Google Maps link, no listing within 30 m | No website line in the card | AC-11.2 |
| Another clinic shares Thu's building (within 30 m) and is closer to her saved point than her own listing | Its website could show in her card (W10 limit). She will see it at once; fix by saving her location on her own listing (pick it from the suggestions). | AC-11.1 |
| Thu switches centre quickly | Line redrawn from the new centre each time; no outside call, so no late answer | AC-9.3 |
| Listing data refresh fails | Previous listings, with their websites, are kept (existing behaviour) | AC-14.3 |
| Refresh gives far fewer listings than before | Refused, previous file kept (new check, design §5) | AC-14.3 |
| Very long address | Only the site name is shown; line wraps | AC-14.4 |
| Dark theme, 375 px, screen reader | Existing photo block styles; labels in 2.1.1 and 2.1.4 | AC-14.4, AC-12.4 |

## 2.5 Traceability

| Element | Stories / criteria |
|---|---|
| Link line states (2.1.1) | AC-9.1, AC-9.2, AC-9.4, AC-9.5, AC-10.1, AC-10.2, AC-14.4 |
| Competition tab flow (2.1.2) | AC-9.3, AC-11.3 |
| Your clinic card (2.1.3) | AC-11.1, AC-11.2, AC-11.4 |
| Table links (2.1.4) | AC-12.1 to AC-12.6 |
| Note sentence (2.1.5) | AC-14.1, AC-10.5 |
| WR1, WR1b usable website | AC-13.1, AC-13.2, AC-13.4 |
| WR2 site name | AC-9.1, AC-13.4, AC-13.5 |
| WR3 duplicates | AC-14.2 |
| WR4, WR5 search | AC-10.2, AC-10.3, AC-10.4 |
| WR6 Thu's clinic | W6, AC-11.1 to AC-11.3, AC-12.6 |
| WR7 no automatic requests | W8, AC-14.6 |
| WR8 meaning | AC-10.5 |
| WR9 refresh report | AC-14.2 |
| Data (2.3) | W4, AC-14.2, Loi 25 constraint |
| W13 (US-15 not built) | US-15 |

---

# Iteration 1 — Clinic photo when a clinic is chosen

Input: `docs/01-requirements.md` (US-1 to US-8). Status: draft for Gate 2.
Screen texts stay in English, like the rest of the page (requirements §6 overrides the "labels in French" default of the team template). Exact texts are in quotes.

## 0. Decisions taken for Thu (she asked the team to choose sensible defaults)

| # | Decision | Why | Stories |
|---|---|---|---|
| D1 | Free street photos come from **Mapillary** (first) and **Panoramax** (second). Both are free, open-licence street-level photo collections that blur faces and licence plates. | Best free coverage of Québec streets (Mapillary), plus a source that needs no key at all (Panoramax). | US-1, US-6, US-8 |
| D2 | **Thu's own clinic is never looked up** at any photo provider. Her clinic gets her own uploaded photo (kept in her browser only) and the "View on Google Maps" link. | Keeps the promise that her clinic's name and location stay in her browser. Resolves the open point in requirements §6. | US-2, US-5 |
| D3 | The "View on Google Maps" link uses the clinic's coordinates only, never its name. | A pin on the exact spot meets AC-4.3, and nothing but a point is sent, and only when Thu clicks. | US-4 |
| D4 | No photos for Wikimedia Commons or OpenStreetMap `image=` tags. | Almost no dental clinic façades there; nearby Commons photos are usually other buildings, which would mislead (the goal is confirming the right building). | US-1 |

Consequence of D2 (deviation from AC-2.1, accepted by default): the "Your clinic" card never shows an automatic street photo. It shows Thu's own photo if she adds one, otherwise "Photo not available", the Google Maps link and a one-line reason.

## 1. Screens and flows

### 1.1 The photo block (shared by both places)

A small block placed directly under the clinic name. It has one of five states:

| State | What is shown | When |
|---|---|---|
| Hidden | Nothing at all (no box, no message). | No clinic chosen (AC-1.3, AC-2.3). |
| Loading | "Loading photo..." in small muted text, plus the "View on Google Maps" link. | A free photo is being looked up (AC-1.5). |
| Free photo | The photo (max about 200 px high, full width on a phone), then on one small line: credit and licence, capture date, then the note "The photo shows the location, not necessarily the clinic's current sign.", then "View on Google Maps". | A suitable photo was found and loaded (AC-1.1, AC-6.1 to 6.3). |
| Own photo | Thu's photo, labelled "Your photo", then "View on Google Maps". | The chosen clinic is Thu's own clinic and she added a photo (AC-5.2, AC-6.4). |
| Not available | "Photo not available" followed by the "View on Google Maps" link. For Thu's own clinic only, a second small line: "Photos are not looked up automatically for your clinic, so its location stays private." | No suitable photo, source error, slow source, or Thu's clinic without own photo (AC-3.1, AC-3.2, D2). |

Rules for all states:
- The block never shows a broken-image icon, an empty grey box or a raw error (AC-3.3). The image is only made visible after it has fully loaded.
- The link "View on Google Maps" is always present when a clinic is chosen and opens in a new tab (AC-4.1, AC-4.2).
- Screen reader text: "Street view of [clinic name]" for a free photo, "Your photo of [clinic name]" for an own photo (AC-7.3).
- Colours and text follow the page's light and dark themes (AC-7.1). No horizontal scrolling at 375 px (AC-7.2).
- The block never blocks the rest of the page: map, tables and filters work while it loads (AC-1.5).

### 1.2 Competition tab, "Clinic at the centre" (US-1, US-4, US-6)

Location: under the title "Competition around [clinic name]", above the explanatory note.

Flow:
1. Thu picks a clinic in "Clinic at the centre", clicks "Use your clinic", clicks a competing clinic on the map, or opens a shared link with a centre already set.
2. If the centre is Thu's own clinic (see rule R1), the block shows the Own photo or Not available state. No lookup happens.
3. Otherwise the block shows Loading, then Free photo or Not available.
4. Picking another centre immediately replaces the block's content with Loading for the new clinic. A late answer for the previous clinic is thrown away (AC-1.2, AC-1.4).

### 1.3 "Your clinic" card (US-2, US-4, US-5)

Location: under the clinic name and the "Postal area ..." line, before the action buttons wrap.

What it shows when a clinic is saved:
- The photo block, in Own photo or Not available state only (D2).
- Buttons: "Add your own photo" (or "Replace photo" when one exists) and "Remove photo" (only when one exists).
- Next to the buttons, small text: "Saved in this browser only." (AC-5.4).
- Error line, only after a failed add: "This photo could not be saved in this browser." (AC-5.6).
  *As-built clarification (2026-11-14, QA note N-11; wording only, no change in behaviour):* the page keeps this sentence word for word and adds one short reason after it, so Thu knows what to do. The five full messages are:
  - "This photo could not be saved in this browser. Choose a JPEG or PNG image." (the file is not JPEG or PNG)
  - "This photo could not be saved in this browser. The file is larger than 20 MB. Choose a smaller photo." (refused before reading)
  - "This photo could not be saved in this browser. The file could not be read as an image. Choose a JPEG or PNG image." (empty or broken file)
  - "This photo could not be saved in this browser. The photo is too detailed to keep in this browser. Choose a smaller photo." (still over the storage budget at the lowest JPEG quality)
  - "This photo could not be saved in this browser. This browser's storage is full or blocked." (the browser refused to store it)

Flows:
- **Add / Replace:** the button opens the computer's file picker, limited to JPEG and PNG. The photo is shrunk to a web size, saved in this browser, and shown at once in the card and in the Competition tab when Thu's clinic is the centre (AC-5.2).
- **Remove photo:** the own photo is deleted; the block returns to Not available (AC-5.5).
- **Change** the clinic to a different location: the own photo belongs to the old location, so it is deleted and the block shows Not available (AC-2.2). Changing only the name keeps the photo.
- **Remove** the clinic: the own photo is deleted with it and the block disappears (AC-2.3, AC-5.5).
- While the form is open (no clinic saved, or "Change" clicked), the block and photo buttons are hidden.

The own-photo buttons exist only in the "Your clinic" card, never in the Competition tab and never for other clinics (AC-5.8).

## 2. Business rules

**R1 — Privacy guard (own clinic is never looked up).** No photo lookup is made for a location within **100 m** of Thu's saved clinic. Such a centre shows the Own photo state if it is Thu's clinic (the existing "your clinic" match, 30 m) and an own photo exists; otherwise Not available.
Example: saved clinic at point P. Centre is an OpenStreetMap listing 20 m from P (her own listing): own photo or Not available, no lookup. Centre is a competitor 70 m away in the same plaza: Not available, no lookup (its photo would show her building too). Centre 400 m away: normal lookup.
Limit: the page only knows which clinic is Thu's once she has saved it in "Your clinic". Before that, picking her own listing as the centre is treated like any other listing.

**R2 — Which free photo is chosen (US-1).** For the chosen point the page asks the source for photos taken within 50 m. It keeps only photos that:
- are ordinary photos, not 360° panoramas (these look distorted when shown flat);
- were taken between 5 and 50 m from the clinic;
- have a camera direction pointing at the clinic, within 50° either side.

Among those, it prefers photos taken in the last 5 years if there are any; then it takes the closest one; on a tie (within 5 m), the most recent.
Example: three photos. A: 12 m away, camera 80° off the clinic direction, 2024 (rejected, looking away). B: 30 m, 20° off, 2016. C: 40 m, 10° off, 2023. C is chosen: it is recent, and B is older than 5 years.

**R3 — Source order (US-1, US-8).** Mapillary first, then Panoramax if Mapillary has no suitable photo or fails. If Mapillary has not been set up (no free key yet), Panoramax only.

**R4 — Time limit (AC-3.2).** The lookup plus the image download stops after 10 seconds in total. After that, or after any source error, the block shows Not available. Errors are handled silently: nothing from the page's own code appears in the console.

**R5 — Credit line (AC-6.1, AC-6.2).**
- Mapillary: "Photo: [contributor] via Mapillary, CC BY-SA 4.0 · Photo taken [Month YYYY]". "Mapillary" links to the photo's page on mapillary.com.
- Panoramax: "Photo: [contributor] via Panoramax, [licence as given by the source] · Photo taken [Month YYYY]". "Panoramax" links to the photo's page.
- If no date is given, the date part is left out. If no contributor name is given, "Photo via Mapillary" / "Photo via Panoramax".
Example: "Photo: jdupont via Mapillary, CC BY-SA 4.0 · Photo taken June 2023".

**R6 — Google Maps link (US-4).** Address: `https://www.google.com/maps/search/?api=1&query=<lat>,<lon>` with the clinic's coordinates rounded to 5 decimals (about 1 m). Opens in a new tab, sends no page address to Google. Free, no account needed (AC-4.4).

**R7 — Own photo (US-5).** Accepted: JPEG or PNG. The photo is resized in the browser to at most 800 px on its longer side and saved as JPEG; this also removes any hidden camera data (such as GPS position) from the file. It is saved with the clinic's location; if the saved location changes, the photo is dropped. If the browser refuses to store it (full or blocked storage), the error message of AC-5.6 shows and the previous photo stays.

**R8 — A missing photo means nothing about the clinic (requirements §6).** "Photo not available" never implies the clinic is closed or absent; it only means no free photo exists.

**R9 — One lookup per location per visit.** A photo result (found or not) is remembered for the rest of the visit, so redrawing the page or returning to the same clinic does not ask the source again.

## 3. Data

| Entity | Fields | Where it lives | Patient data? |
|---|---|---|---|
| Chosen clinic (existing) | name, latitude, longitude, address (from OpenStreetMap listings, public) | `site/data/dentists.json` and page address `?hub=` | No |
| Saved own clinic (existing) | name, latitude, longitude | This browser's storage (`dm-clinic`) | No. Business-private to Thu. |
| Own photo (new) | location key (lat,lon), image (resized JPEG) | This browser's storage only (`dm-clinic-photo`). Never in the project files, commits, logs or the page address. | No. Business-private to Thu. Should never show patients (out of scope). |
| Photo result (new, temporary) | source, photo address, contributor, licence, capture date, link to photo page | Page memory, for the current visit only | No |

No patient data is read, stored or sent by this change.

## 4. Error and edge cases

| Case | Behaviour | Story |
|---|---|---|
| Source returns nothing near the clinic | Not available + link | AC-3.1 |
| Source slow (>10 s), down, rate-limited or returns bad data | Not available + link, no console error from page code | AC-3.2, AC-8.2 |
| Photo address found but image fails to download | Not available + link, never a broken icon | AC-3.3 |
| Thu switches clinics while a photo is loading | Old answer discarded; block shows the new clinic only | AC-1.2 |
| Thu clicks a competitor on the map | Same as picking it; block follows the new centre | AC-1.4 |
| Centre set by a shared link (`?hub=`) | Lookup runs once data has loaded, same rules | AC-1.1 |
| Centre within 100 m of Thu's saved clinic | No lookup; own photo or Not available | R1 |
| Thu's clinic is the centre but she has no own photo | Not available + link + privacy line | D2 |
| Saved clinic entered by Google Maps link, not in OpenStreetMap | Same as any saved clinic | AC-2.1 |
| Own photo file is not JPEG/PNG, is corrupt, or storage is full/blocked | "This photo could not be saved in this browser."; previous photo kept | AC-5.6 |
| Browser storage blocked entirely (private mode) | Own photo shown for this visit only if it could be read; otherwise error message | AC-5.6 |
| Mapillary key missing or revoked | Panoramax only, then Not available | R3, AC-8.2 |
| Very old photo (e.g. 2012) chosen because nothing newer exists | Shown with its date so Thu can judge | AC-6.2 |
| Dark theme, phone width, screen reader | See §1.1 rules | US-7 |

## 5. Traceability

| Element | Stories / criteria |
|---|---|
| Photo block states (§1.1) | US-1, US-2, US-3, US-6, US-7 |
| Competition tab placement and flow (§1.2) | AC-1.1 to 1.5, AC-2.4 |
| Your clinic card placement, own-photo buttons (§1.3) | AC-2.1 to 2.3, AC-5.1 to 5.8 |
| R1 privacy guard | Requirements §6 open point, D2 |
| R2 photo choice | AC-1.1 (façade or street-level photo of the location) |
| R3 source order | US-8, AC-8.2 |
| R4 time limit | AC-3.2, AC-1.5 |
| R5 credit line | AC-6.1, AC-6.2, AC-6.3 |
| R6 Google Maps link | AC-4.1 to 4.4 |
| R7 own photo | AC-5.2 to 5.7 |
| R8 missing photo meaning | Requirements §6 |
| R9 one lookup per visit | AC-1.5, AC-8.2 (keeps source use low) |
| Data table (§3) | US-5, Loi 25 constraint |
