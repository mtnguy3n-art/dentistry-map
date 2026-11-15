# 01 — Requirements: clinic photo when a clinic is chosen

Change request from Dre Thu Nguyen: "je veux voir une photo de la clinic quand j'en choisis une".
Status: answers received (Thu accepted all suggested defaults: "propose-moi quelque chose, fais-le, je saurai si cela me convient quand je verrai le résultat"). Waiting for Gate 1.

## 1. Problem statement

When Thu (or another dentist using the dashboard) picks a clinic, she only sees a name taken from OpenStreetMap. Listings are incomplete, names are often similar ("Clinique dentaire ..."), and several clinics can share one building or street. Today she cannot be sure she picked the right clinic without leaving the page and searching by hand. A wrong pick silently gives a wrong competition map, wrong radius and wrong comparison, and she may make an advertising decision on it.

**Goal:** right after picking a clinic, Thu can confirm at a glance that it is the right one, using a façade or street photo of the building, or, when no free photo exists, a one-click link to the clinic on Google Maps.

**Measures of success**
- 100 % of clinic picks show either a photo or the "Photo not available" message with the Google Maps link (never an empty or broken area).
- Thu can confirm or reject a pick in about 5 seconds without typing anything elsewhere.
- Cost stays at 0 $ per month.
- For information only (no target): QA reports how many of 20 sample Québec listings get a photo, so Thu knows how often she will see one.

## 2. Users and roles

| Role | Need |
|---|---|
| Dentist / clinic owner (Thu, main user) | Confirm the chosen clinic is the right building, for her own clinic and for competitors. |
| Clinic manager or marketing coordinator | Same need when preparing advertising decisions for the owner. |

No hygienist, secretary or lab tech use for this change. No patient is involved.

## 3. Where the photo appears

1. **Competition tab**, field "Clinic at the centre": once a clinic is chosen, the photo appears just under the chosen clinic's name (the title "Competition around ...").
2. **"Your clinic" card**: once a clinic is saved, the photo appears just under the clinic name (the card title).

Screen language stays English, like the rest of the page.

## 4. User stories and acceptance criteria

### US-1 (Must) Photo of the clinic at the centre of the competition map
As a dentist, I want to see a photo of the building when I choose the clinic at the centre, so that I know I picked the right clinic before reading the competition figures.

- **AC-1.1** Given the Competition tab is open, When I pick a clinic from the "Clinic at the centre" suggestions, Then a façade or street-level photo of that clinic's location appears just under the title "Competition around [clinic name]".
- **AC-1.2** Given a photo is shown for clinic A, When I pick clinic B, Then the photo of clinic A is replaced by clinic B's photo (or by the "not available" message of US-3). Clinic A's photo is never shown with clinic B's name.
- **AC-1.3** Given no clinic is chosen yet, When I open the Competition tab, Then no photo area and no "Photo not available" message is shown.
- **AC-1.4** Given I click a competing clinic on the map (which makes it the new centre), When the map redraws, Then the photo follows the new centre as in AC-1.2.
- **AC-1.5** Given the photo is still loading, When I look at the photo area, Then I see a short "Loading photo..." text and the rest of the page (map, tables) is usable and not blocked.

### US-2 (Must) Photo of my clinic in the "Your clinic" card
As a clinic owner, I want to see a photo of my clinic under its name in the "Your clinic" card, so that I can confirm the saved clinic is really mine.

- **AC-2.1** Given I have saved my clinic (picked from the list or entered with a Google Maps link or latitude and longitude), When the card shows my clinic, Then a façade or street-level photo of the saved location appears just under the clinic name.
- **AC-2.2** Given I click "Change" and save a different location, When the card refreshes, Then the photo matches the new location.
- **AC-2.3** Given I click "Remove", When the card returns to its empty state, Then no photo is shown.
- **AC-2.4** Given my clinic is saved, When I click "Use your clinic" in the Competition tab, Then the same photo (or my own photo from US-5) is shown under the competition title.

### US-3 (Must) Clear message when no photo exists
As a dentist, I want a clear message and a way to check the clinic myself when there is no photo, so that I am never left with a blank or broken image.

- **AC-3.1** Given a clinic is chosen and no free photo exists for its location, When the photo area is shown, Then it reads exactly "Photo not available" followed by a "View on Google Maps" link.
- **AC-3.2** Given the photo source does not answer, is slow (more than about 10 seconds) or returns an error, When the photo area is shown, Then the result is the same as AC-3.1, and the browser console shows no error coming from the page's own code.
- **AC-3.3** Given any case above, When I look at the page, Then there is never a broken-image icon, an empty grey box or a raw error message.

### US-4 (Must) "View on Google Maps" link
As a dentist, I want a link that opens the chosen clinic on Google Maps, so that I can check its photos, reviews and sign when the photo here is missing or not clear.

- **AC-4.1** Given a clinic is chosen in either place, When I look under the clinic name, Then a "View on Google Maps" link is shown, with or without a photo.
- **AC-4.2** Given I click "View on Google Maps", When the link opens, Then it opens in a new browser tab, and the dashboard tab stays as it was (same tab, filters and chosen clinic).
- **AC-4.3** Given the link opens, When Google Maps loads, Then it shows the chosen clinic's location (the pin is at or within about 50 m of the clinic's coordinates, or on the clinic's name and address).
- **AC-4.4** Using the link costs nothing and needs no Google account.

### US-5 (Should) Add my own photo for my clinic
As a clinic owner, I want to add my own photo of my clinic, so that the card shows my real, up-to-date building even if no free photo exists or the free photo is old.

- **AC-5.1** Given my clinic is saved, When I look at the "Your clinic" card, Then I see an "Add your own photo" action (or "Replace photo" if one is already added).
- **AC-5.2** Given I choose a photo file from my computer (JPEG or PNG), When it is accepted, Then it replaces the free photo under my clinic's name, in the card and in the Competition tab when my clinic is the centre.
- **AC-5.3** Given I added my own photo, When I close and reopen the page in the same browser, Then my photo is still shown.
- **AC-5.4** Given I added my own photo, When I open the page in another browser or computer, Then my photo is not there (it is kept in this browser only), and the page says "Saved in this browser only." next to the photo action.
- **AC-5.5** Given I added my own photo, When I click "Remove photo", Then the free photo (or "Photo not available") comes back. When I click "Remove" on the clinic, Then my photo is deleted too.
- **AC-5.6** Given my file is not an image or the browser cannot store it, When I try to add it, Then I see "This photo could not be saved in this browser." and the previous photo stays.
- **AC-5.7** My own photo is never sent to any outside service, never stored in the project's files or history, and never placed in the page address (URL).
- **AC-5.8** The own-photo option exists only for "Your clinic", not for other clinics.

### US-6 (Must) Credit and honest labelling of the photo
As a dentist, I want to know where a photo comes from and that it may be out of date, so that I don't over-trust it.

- **AC-6.1** Given a free photo is shown, When I look under it, Then the source and the photographer or licence credit required by that source is shown in small text.
- **AC-6.2** Given the source gives a capture date, When the photo is shown, Then the date (month and year at least) is shown, e.g. "Photo taken June 2023".
- **AC-6.3** Given a free photo is shown, When I look under it, Then a short note says "The photo shows the location, not necessarily the clinic's current sign."
- **AC-6.4** Given my own photo is shown, When I look under it, Then it is labelled "Your photo" instead of a source credit.

### US-7 (Must) Fits the existing page
As a dentist, I want the photo to look like it belongs on the page, so that the dashboard stays easy to read.

- **AC-7.1** Given light theme and dark theme, When a photo, a loading text or the "not available" message is shown, Then text is readable and the colours follow the page theme.
- **AC-7.2** Given a phone-width screen (about 375 px), When a photo is shown, Then it fits the width without horizontal scrolling and keeps its proportions.
- **AC-7.3** Given a screen reader, When the photo is reached, Then it is described as "Street view of [clinic name]" (or "Your photo of [clinic name]").
- **AC-7.4** The photo is small enough that the clinic name, buttons and first figures stay visible without scrolling on a laptop screen (photo height about 200 px or less, or similar).
- **AC-7.5** All existing behaviour still works: filters, labels from the data file, OpenStreetMap credit, the existing limits notes, and no console errors on load.

### US-8 (Must) Zero cost
As the clinic owner, I want this feature to cost nothing, so that it stays within a 0 $ per month budget.

- **AC-8.1** No paid service, paid key, trial that later bills, or credit card is used.
- **AC-8.2** If the free source stops working, the page falls back to US-3 behaviour without breaking.

## 5. Out of scope

- Photos of the inside of clinics, staff or patients.
- Photo galleries, several photos per clinic, zoom or rotate-the-street-view controls.
- Photos for clinics in tables and lists (nearest listings, competing clinics) or in map tooltips.
- Uploading own photos for other clinics, or sharing Thu's photo with other users or devices.
- Correcting clinic names, addresses or locations in the OpenStreetMap listings.
- Any paid photo or map service.
- French translation of the page (the page stays English for now).

## 6. Constraints

- **Privacy / Loi 25:** no patient data is involved. Street photos may show passers-by or licence plates: only use sources that blur faces and plates, or that are already published under an open licence. Thu's own clinic name and location are currently kept in her browser only and never in the project files or the page address; the photo feature must keep that promise. **Open point for Gate 2:** looking up a free photo for her own clinic means its location is sent to the photo provider. The designer must say whether that happens and, if so, Thu must agree to it at Gate 2 (alternative: no automatic photo for her own clinic, only her own photo and the Google Maps link).
- **Own photo:** stays in the browser only (same rule as the saved clinic). Never in commits, logs, tests or docs.
- **Language:** screen texts in English, consistent with the rest of the page. Exact texts: "Photo not available", "View on Google Maps", "Loading photo...", "Add your own photo", "Replace photo", "Remove photo", "Your photo", "Saved in this browser only.", "This photo could not be saved in this browser."
- **Existing tools:** works alongside Google Maps (link only). No link with Dentitek or other clinic software.
- **Budget:** 0 $ per month.
- **Licences and credits:** respect the terms of any photo source and show its credit, as is already done for OpenStreetMap.
- **Project rules (CLAUDE.md):** the OpenStreetMap credit and the existing limits notes stay visible. A missing photo must not be read as "the clinic does not exist".

## 7. Priority summary

| Story | Priority |
|---|---|
| US-1 Photo, Competition tab | Must |
| US-2 Photo, Your clinic card | Must |
| US-3 "Photo not available" fallback | Must |
| US-4 "View on Google Maps" link | Must |
| US-6 Credit and honest labelling | Must |
| US-7 Fits the page (themes, mobile, accessibility) | Must |
| US-8 Zero cost | Must |
| US-5 Own photo for my clinic | Should |
| Capture date shown (AC-6.2) | Should (only when the source provides it) |

## 8. Decisions recorded

| # | Question | Answer (Thu accepted the defaults) |
|---|---|---|
| 1 | Where? | Both: Competition tab "Clinic at the centre" and "Your clinic" card, just under the clinic name. |
| 2 | What kind of photo? | Façade / street-level, to recognise the building. |
| 3 | Main purpose? | Confirm the right clinic was chosen. |
| 4 | No photo? | "Photo not available" (English UI) plus a "View on Google Maps" link in a new tab. |
| 5 | Budget? | 0 $ per month, free sources only. Thu can add her own photo for her clinic, kept in her browser only. |
