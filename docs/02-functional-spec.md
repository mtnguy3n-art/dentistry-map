# 02 — Functional spec: clinic photo when a clinic is chosen

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
