# 01 — Requirements

This file holds one section per iteration, newest first. Earlier iterations are kept as written; story numbers continue across iterations (US-1 to US-8 are the photo iteration, US-9 onward are the website iteration).

- Iteration 2 (2026-11-15): link to each clinic's website
- Iteration 1 (2026-11-14, live since 2026-11-15): clinic photo when a clinic is chosen

---

# Iteration 2 — Link to each clinic's website

Change request from Dre Thu Nguyen at Gate 3 of iteration 1: "put a link to each clinic's website, no need to put pictures."
Status: defaults chosen by the team (Thu asked the team to decide and will judge the result). Waiting for Gate 1.

## 2.1 Problem statement

Iteration 1 tried to help Thu confirm she picked the right clinic with a free street photo. In practice free photos cover almost no Québec clinics (0 of 20 sample listings, CHANGELOG 2026-11-14 increment 6), so she sees "Photo not available" almost every time. She rejected taking images from Google or from clinic websites. What she wants instead is the clinic's own website, one click away: it confirms the clinic's identity (name, address, team, sign) and, for competitors, shows what they offer, how they present themselves and what they advertise, which is exactly what she needs when deciding where and how to advertise. Today she must leave the page, type the clinic name in a search engine and guess which result is the right one, for every clinic she looks at.

**Goal:** whenever a clinic is chosen, Thu can open its website in one click, or, when no website is known, open a ready-made web search for that clinic in one click. No typing, no copying names.

**Measures of success**
- 100 % of chosen clinics (Competition tab centre) show either a website link or the "Website not listed" text with a search link (except the cases in AC-10.3 and US-11). Never an empty or broken link.
- Opening a competitor's website takes one click from the Competition tab, about 2 seconds of Thu's time instead of a manual search.
- Cost stays at 0 $ per month.
- For information only (no target): QA reports how many of the same 20 sample Québec listings used in iteration 1 have a website link, so Thu knows how often she will see one.

## 2.2 Expected coverage (measured 2026-11-15)

OpenStreetMap is the only source (the same listings the page already uses). A count on OpenStreetMap on 2026-11-15 gave, for Québec dental listings (dentist tags, before the page's own clean-up of duplicates):

| | Listings | Share |
|---|---|---|
| Québec dental listings | 818 | 100 % |
| with a website (any of the usual website tags) | 142 | about 17 % (1 in 6) |
| of which the address starts with http:// or https:// | 140 | |

So about **1 chosen clinic in 6 will show a direct website link**; the other 5 will show the "Search the web" link. The search link is therefore not a side case but the main path, and it must be good (clinic name plus town). Coverage will grow on its own as OpenStreetMap volunteers add websites, at each regular data refresh. The Canada-wide share was not measured (the count timed out); QA measures the Québec 20-listing sample.

Reminder from CLAUDE.md: listings are only about a third complete, so many clinics are not on the map at all; this change does not fix that.

## 2.3 Users and roles

| Role | Need |
|---|---|
| Dentist / clinic owner (Thu, main user) | Confirm the chosen clinic is the right one and look at a competitor's own website (services, positioning, offers) when planning advertising. |
| Clinic manager or marketing coordinator | Same need when preparing advertising decisions for the owner. |

No hygienist, secretary or lab tech use. No patient is involved.

## 2.4 Decisions taken for Thu (sensible defaults)

| # | Decision | Why |
|---|---|---|
| W1 | The photo block from iteration 1 stays exactly as it is. No new photo work: the planned Mapillary step (increment 4, waiting for a free key) is dropped unless Thu asks for it again. | "no need to put pictures"; the existing block already works and costs nothing. |
| W2 | The website link appears in the same places as the photo block (Competition tab under "Competition around [clinic name]", and the "Your clinic" card), on the same line as "View on Google Maps". | One place to look; Thu already knows it. |
| W3 | Competitors also get a small "Website" link in the "Competing clinics" table and the "Nearest dental listings" table, when a website is known (Should). | Her real use is looking at competitors; opening each one as the centre just to see its site would be slow. |
| W4 | The website comes only from the OpenStreetMap listing, picked up by the regular data refresh. No searching, visiting or copying from Google or clinic websites. | Thu rejected scraping; OpenStreetMap is already the page's source, is free and already credited. |
| W5 | When no website is known, the chosen clinic shows "Website not listed" and a "Search the web" link that opens a Google web search for the clinic name and town in a new tab. | About 5 clinics in 6 have no website in OpenStreetMap; a ready search saves the typing. Google, because Thu already uses Google Maps from this page; free, no account. |
| W6 | Thu's own clinic is never sent to a search engine by the page (same promise as iteration 1, decisions D2 and D3). Her card shows the listing's website only if her saved clinic matches a public listing that has one; otherwise no website line. | Keeps "your clinic stays in your browser". She knows her own website. |
| W7 | Links open in a new tab, only http and https addresses are accepted, and the clinic site is not told which page the visitor came from. | Safety and privacy; same rule as the existing Google Maps link. |
| W8 | The page never opens, checks or loads a clinic website by itself. Only Thu's click opens it. | No hidden visits to clinic sites, no cost, nothing that looks like scraping. A dead link is possible and is explained in a note. |

## 2.5 User stories and acceptance criteria

### US-9 (Must) Website link for the clinic at the centre
As a dentist, I want a link to the website of the clinic I chose as the centre, so that I can confirm it is the right clinic and see how it presents itself, in one click.

- **AC-9.1** Given the Competition tab is open and a clinic whose listing has a website is chosen as the centre, When I look under "Competition around [clinic name]", Then I see a link "Website: [site name]" on the same line as "View on Google Maps", where [site name] is the web address without "https://", without "www." and without anything after the first "/" (for example "Website: cliniquexyz.ca").
- **AC-9.2** Given that link is shown, When I click it, Then the clinic's website opens in a new browser tab, and the dashboard tab stays as it was (same tab, filters and chosen clinic).
- **AC-9.3** Given a website link is shown for clinic A, When I pick clinic B (from the suggestions, by clicking a competitor on the map, with "Use your clinic", or from a shared link), Then the line shows clinic B's website or clinic B's fallback (US-10). Clinic A's website is never shown with clinic B's name.
- **AC-9.4** Given no clinic is chosen, When I open the Competition tab, Then no website line, no "Website not listed" text and no search link is shown.
- **AC-9.5** Given a website or fallback line is shown, When I look at the photo block, Then the photo, "Loading photo...", "Photo not available", its credit and "View on Google Maps" behave exactly as in iteration 1. The website line is shown at once and does not wait for the photo.

### US-10 (Must) "Search the web" when no website is known
As a dentist, I want a ready-made web search when the listing has no website, so that I can still find the clinic's site without typing.

- **AC-10.1** Given a chosen centre whose listing has no usable website, When I look under the clinic name, Then I see exactly "Website not listed" followed by a link "Search the web".
- **AC-10.2** Given I click "Search the web", When the new tab opens, Then it shows Google web search results for the clinic's name followed by its town (for example "Clinique Dentaire Couture Rimouski"), and the dashboard tab stays as it was.
- **AC-10.3** Given the listing has no real name (shown as "Dentist" or "Dentist (unnamed listing)"), When the line is shown, Then the search uses "dentist", the street address and the town if an address is known; if there is no address either, only "Website not listed" is shown, without a search link.
- **AC-10.4** The search link sends only the public listing's name, address and town, and only when Thu clicks. It never contains the page address, the patient radius, filters or anything about Thu's own clinic.
- **AC-10.5** "Website not listed" never implies the clinic has no website or is closed; the note of US-14 says the list comes from OpenStreetMap.

### US-11 (Must) Website in the "Your clinic" card
As a clinic owner, I want to see my clinic's website link in my card when it is known, so that the card is consistent with the Competition tab.

- **AC-11.1** Given my saved clinic is at the location of a listing (the existing "your clinic" match, 30 m) that has a website, When the card shows my clinic, Then "Website: [site name]" appears next to "View on Google Maps", and it works as in AC-9.2.
- **AC-11.2** Given my saved clinic does not match a listing with a website, When the card shows my clinic, Then no website line, no "Website not listed" and no "Search the web" link is shown.
- **AC-11.3** Given my clinic is the centre of the Competition tab, When the website line is shown there, Then it follows AC-11.1 and AC-11.2 too (never "Search the web" for my own clinic, also for any centre within 100 m of my saved clinic, the iteration 1 privacy rule R1).
- **AC-11.4** Given I click "Change" and save a different location, or click "Remove", When the card refreshes, Then the website line follows the new location, or disappears.

### US-12 (Should) Website links for competitors in the tables
As a dentist, I want a website link next to each competing clinic that has one, so that I can look at competitors' sites without making each one the centre.

- **AC-12.1** Given the "Competing clinics" table is shown, When a row's listing has a website, Then a small "Website" link appears in that row, next to the clinic name, and opens the site in a new tab (AC-9.2 rules).
- **AC-12.2** Given the "Nearest dental listings" table in the clinic card is shown, When a row's listing has a website, Then the same "Website" link appears in that row.
- **AC-12.3** Given a row's listing has no website, When the table is shown, Then the row shows no link and no "Website not listed" text (tables stay uncluttered; no search link in tables).
- **AC-12.4** Given a screen reader, When it reaches a table link, Then it is announced as "Website of [clinic name]".
- **AC-12.5** Clicking a "Website" link in the table does not change the centre, the sort order or the corrected-service choices in that table.
- **AC-12.6** The row of Thu's own clinic (and any listing within 100 m of it) follows US-11: website link only if known, never a search link.

### US-13 (Must) Safe links
As a clinic owner, I want the links to be safe, so that a wrong or malicious listing cannot harm my computer or reveal what I am looking at.

- **AC-13.1** Only addresses starting with "http://" or "https://" become links. An address written without it (for example "www.cliniquexyz.ca" or "cliniquexyz.ca") is opened as "https://" + that address. Anything else (for example "javascript:", "mailto:", "tel:", an e-mail address, text with spaces, an empty value) is treated as no website (US-10 fallback for the centre, nothing in tables).
- **AC-13.2** When a listing gives several addresses in one value (separated by ";"), only the first valid one is used.
- **AC-13.3** Every website and search link opens in a new tab, and the opened site cannot control the dashboard tab and is not told the dashboard's page address.
- **AC-13.4** The shown [site name] is taken from the actual address the link opens, so the text never shows one site while the link opens another.
- **AC-13.5** A website that is a social media page (for example a Facebook page) is accepted as the website and shown with its site name (for example "Website: facebook.com"), so Thu sees where she will land.

### US-14 (Must) Honest labelling, data and fit
As a dentist, I want to know where the website comes from and that it may be out of date, and the page should keep working as before.

- **AC-14.1** Given the Competition tab, When I read the existing note under the competing clinics table, Then it also says, in one short sentence, that website links come from OpenStreetMap listings and may be missing or out of date (for example: "Website links come from the OpenStreetMap listing and may be missing or out of date."). The OpenStreetMap credit stays.
- **AC-14.2** The website addresses are added to the clinic listings by the regular data refresh, never typed by hand into the page data. After a refresh, the refresh report states how many listings have a website (Canada and Québec).
- **AC-14.3** If a refresh fails and the previous listings are kept (current behaviour), the previous website addresses are kept with them.
- **AC-14.4** Light and dark themes: links are readable and follow the page's link colours. Phone width (about 375 px): the line wraps, no horizontal scrolling. Long web addresses are shortened to the site name (AC-9.1), never overflow.
- **AC-14.5** All existing behaviour still works: photo block, Google Maps link, filters, labels from the data file, OpenStreetMap credit, the limits notes, saved service corrections, and no console errors on load.
- **AC-14.6** The page makes no request to any clinic website or search engine on its own; requests happen only when Thu clicks a link.
- **AC-14.7** Zero cost: no paid service, key, trial or credit card.

### US-15 (Could) Type my own website for my clinic
As a clinic owner whose clinic has no website in the listing, I want to type my website in my card, so that it appears like the others.

- **AC-15.1** Given my clinic is saved and no website is known for it, When I look at the card, Then I can add a website address, saved in this browser only (same rule as the saved clinic and own photo: never sent, never in project files or the page address).
- **AC-15.2** The typed address follows US-13. A refused address shows "This web address is not valid." and nothing is saved.
- **AC-15.3** "Remove" on the clinic deletes it; "Change" to a different location deletes it.

## 2.6 Out of scope

- Any new photo work (Mapillary, other photo sources), and taking images or text from Google or clinic websites (Thu's explicit refusal).
- Checking automatically whether a website still works, or showing a preview of it.
- Phone numbers, opening hours, e-mail, reviews or social links other than the single website field.
- Website links in map pin tooltips and for the "Dentists on map" pins of other tabs.
- Correcting or adding websites in OpenStreetMap itself (Thu or a volunteer can do it on openstreetmap.org; it then appears after the next refresh).
- Search links in tables (only for the chosen centre).
- French translation of the page (stays English for now, like iteration 1).

## 2.7 Constraints

- **Privacy / Loi 25:** no patient data involved. Website addresses are public listing data. Thu's own clinic is never sent to a search engine by the page (W6). Any typed website for her clinic (US-15) stays in her browser only.
- **Source and licence:** OpenStreetMap only (ODbL), credit stays visible, as today. No scraping of Google or clinic sites.
- **Language:** screen texts in English, consistent with the page. Exact texts: "Website: [site name]", "Website", "Website not listed", "Search the web", "Website of [clinic name]" (screen reader), "This web address is not valid." (US-15 only).
- **Existing tools:** link only to Google Maps and Google web search, no account. No link with Dentitek or other clinic software.
- **Budget:** 0 $ per month.
- **Project rules (CLAUDE.md):** dentist listings are about a third complete and must not be used for counts; the website share is shown to Thu as information only, not on the page. The limits notes stay visible.
- **Publishing:** the team works on a feature branch; nothing goes live before Thu accepts at Gate 3.

## 2.8 Priority summary

| Story | Priority |
|---|---|
| US-9 Website link, clinic at the centre | Must |
| US-10 "Search the web" fallback | Must |
| US-11 Website in "Your clinic" card (no search for own clinic) | Must |
| US-13 Safe links | Must |
| US-14 Honest labelling, data refresh, fit, zero cost | Must |
| US-12 Website links in the competitor tables | Should |
| US-15 Type my own website | Could |

---

# Iteration 1 — Clinic photo when a clinic is chosen

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
