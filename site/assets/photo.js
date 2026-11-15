// Clinic photo block: pure rules with no page access, so they can be tested in Node (tests/photo.test.mjs).
// Photo choice (R2), source parsers, credit line (R5), privacy guard (R1), the Panoramax lookup (R4, R9) and own-photo rules (R7).
// The lookup gets fetch and the image loader passed in, so it can be tested in Node without the network.
(() => {
  const R = 6371000; /* earth radius in metres, the same as app.js */
  const rad = (d) => d * Math.PI / 180;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* a real coordinate pair: numbers or plain decimal text such as "-71.2", within -90..90 and -180..180.
     Booleans, arrays, objects, null, '' and hex or exponent text are not coordinates (QA-1, QA-2). */
  const DECIMAL = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/;
  const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && DECIMAL.test(v) ? Number(v) : NaN);
  const okPoint = (lat, lon) => {
    const a = num(lat), b = num(lon);
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;
  };

  /* great-circle distance in metres between two points */
  const dist = (lat1, lon1, lat2, lon2) => {
    const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  /* compass bearing in degrees (0 = north, 90 = east) from point 1 towards point 2 */
  const bearing = (lat1, lon1, lat2, lon2) => {
    const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
    const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };
  /* smallest angle between two compass directions, 0..180 */
  const angleOff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

  /* R1: no lookup within 100 m of the saved clinic; "your clinic" itself is the existing 30 m match */
  const GUARD_M = 100, MINE_M = 30;
  const nearSaved = (c, saved, m) => !!(c && saved && okPoint(c.lat, c.lon) && okPoint(saved.lat, saved.lon)
    && dist(num(c.lat), num(c.lon), num(saved.lat), num(saved.lon)) <= m);
  const isMine = (c, saved) => !!(c && c.mine) || nearSaved(c, saved, MINE_M);
  /* guard = other locations kept private for this visit (QA N-8: a clinic location saved earlier in the visit, before
     "Remove" or "Change", stays private until the page is closed) */
  const lookupAllowed = (c, saved, guard = []) => !!c && okPoint(c.lat, c.lon) && !c.mine && !nearSaved(c, saved, GUARD_M)
    && !(Array.isArray(guard) ? guard : []).some((g) => nearSaved(c, g, GUARD_M));

  /* R2: candidates are {lat, lon, angle, pano, taken (ms), ...}. Returns the chosen one or null. */
  const PICK = {minM: 5, maxM: 50, maxOff: 50, recentYears: 5, tieM: 5};
  const YEAR_MS = 365.25 * 24 * 3600 * 1000, DAY_MS = 24 * 3600 * 1000;
  /* QA-3: a capture date more than a day in the future is bad source data, so the photo counts as undated */
  const takenOk = (t, now = Date.now()) => (Number.isFinite(t) && t <= now + DAY_MS ? t : NaN);
  const pickPhoto = (candidates, lat, lon, now = Date.now()) => {
    if (!Array.isArray(candidates) || !okPoint(lat, lon)) return null;
    lat = num(lat); lon = num(lon);
    const ok = candidates.filter((p) => p && !p.pano && okPoint(p.lat, p.lon) && Number.isFinite(p.angle)).map((p) => {
      const d = dist(num(p.lat), num(p.lon), lat, lon);
      return {p: Number.isFinite(p.taken) && !Number.isFinite(takenOk(p.taken, now)) ? {...p, taken: NaN} : p, d,
        off: angleOff(p.angle, bearing(num(p.lat), num(p.lon), lat, lon))};
    }).filter((x) => x.d >= PICK.minM && x.d <= PICK.maxM && x.off <= PICK.maxOff);
    const recent = ok.filter((x) => Number.isFinite(x.p.taken) && now - x.p.taken <= PICK.recentYears * YEAR_MS);
    const pool = recent.length ? recent : ok;
    if (!pool.length) return null;
    const near = Math.min(...pool.map((x) => x.d));
    const t = (x) => (Number.isFinite(x.p.taken) ? x.p.taken : -Infinity);
    return pool.filter((x) => x.d <= near + PICK.tieM).sort((a, b) => t(b) - t(a) || a.d - b.d)[0].p;
  };

  /* only https: addresses are accepted from the sources */
  const https = (u) => { try { return new URL(u).protocol === 'https:' ? String(u) : ''; } catch { return ''; } };
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const angleOf = (...vs) => { for (const v of vs) { const a = typeof v === 'number' ? v : NaN; if (Number.isFinite(a)) return ((a % 360) + 360) % 360; } return NaN; };
  const coords = (g) => (g && Array.isArray(g.coordinates) ? {lon: g.coordinates[0], lat: g.coordinates[1]} : {});

  /* Mapillary graph API /images answer -> common shape. Bad or missing data gives an empty list, never an error. */
  const parseMapillary = (j) => {
    const rows = j && Array.isArray(j.data) ? j.data : [];
    return rows.map((r) => {
      if (!r || typeof r !== 'object') return null;
      const {lat, lon} = coords(r.geometry), url = https(r.thumb_1024_url), id = text(String(r.id ?? ''));
      if (!url || !id) return null;
      const taken = typeof r.captured_at === 'number' ? r.captured_at : Date.parse(r.captured_at);
      return {
        src: 'Mapillary', url, lat, lon,
        angle: angleOf(r.computed_compass_angle, r.compass_angle),
        pano: r.is_pano === true,
        taken: Number.isFinite(taken) ? taken : NaN,
        by: text(r.creator && r.creator.username),
        licence: 'CC BY-SA 4.0',
        page: `https://www.mapillary.com/app/?pKey=${encodeURIComponent(id)}`,
      };
    }).filter(Boolean);
  };

  /* Panoramax /api/search answer (GeoJSON features, STAC items) -> common shape */
  const parsePanoramax = (j) => {
    const rows = j && Array.isArray(j.features) ? j.features : [];
    return rows.map((f) => {
      if (!f || typeof f !== 'object') return null;
      const p = f.properties || {}, {lat, lon} = coords(f.geometry), id = text(String(f.id ?? ''));
      const url = https(f.assets && f.assets.sd && f.assets.sd.href), licence = text(p.license);
      if (!url || !id || !licence) return null; /* QA-4: AC-6.1 needs the licence, so photos without one are skipped */
      const fov = p['pers:interior_orientation'] && p['pers:interior_orientation'].field_of_view;
      const prov = Array.isArray(f.providers) ? f.providers.find((x) => x && text(x.name)) : null;
      return {
        src: 'Panoramax', url, lat, lon,
        angle: angleOf(p['view:azimuth']),
        pano: Number(fov) >= 360,
        taken: Date.parse(p.datetime),
        by: prov ? text(prov.name) : '',
        licence,
        /* checked live on 2026-11-14: the viewer at api.panoramax.xyz reads focus and pic from the address hash */
        page: `https://api.panoramax.xyz/#focus=pic&pic=${encodeURIComponent(id)}`,
      };
    }).filter(Boolean);
  };

  /* Panoramax search box, about m metres around the point: [minLon, minLat, maxLon, maxLat] */
  const bbox = (lat, lon, m = 50) => {
    const dLat = m / 111320, dLon = m / (111320 * Math.cos(rad(lat)));
    return [lon - dLon, lat - dLat, lon + dLon, lat + dLat].map((v) => Number(v.toFixed(6)));
  };

  /* R5: credit line parts. Text only; the page puts it in with textContent and links "via" to page. */
  /* QA-5: the month is the one in Quebec (America/Toronto time), not UTC; falls back to UTC if the time zone is unknown */
  const monthYear = (ms) => {
    if (!Number.isFinite(ms)) return '';
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Toronto', year: 'numeric', month: 'numeric'}).formatToParts(new Date(ms));
      const get = (t) => Number((parts.find((x) => x.type === t) || {}).value);
      if (get('month') >= 1 && get('month') <= 12 && get('year')) return `${MONTHS[get('month') - 1]} ${get('year')}`;
    } catch { /* fall through to UTC */ }
    const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const credit = (p, now = Date.now()) => {
    const lic = p.src === 'Mapillary' ? 'CC BY-SA 4.0' : text(p.licence);
    const who = text(p.by) ? `Photo: ${text(p.by)} via ` : 'Photo via ';
    const when = monthYear(takenOk(p.taken, now));
    return {before: who, source: p.src, after: (lic ? `, ${lic}` : '') + (when ? ` \u00b7 Photo taken ${when}` : ''), page: https(p.page)};
  };
  const creditText = (p, now) => { const c = credit(p, now); return c.before + c.source + c.after; };

  /* R6: coordinates only, never the name, rounded to 5 decimals (about 1 m) */
  const mapsUrl = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;

  const keyOf = (c) => `${num(c.lat).toFixed(5)},${num(c.lon).toFixed(5)}`;

  /* R7: Thu's own photo of her clinic, kept in this browser only (localStorage "dm-clinic-photo" = {key, img}).
     Only a JPEG data address made here is ever shown, and only when its key is the saved clinic's location. */
  const OWN = {maxSide: 800, maxFileBytes: 20 * 1024 * 1024, maxStored: 1000000, qualities: [0.85, 0.7, 0.55, 0.4]};
  const OWN_ERROR = 'This photo could not be saved in this browser.';
  const OWN_WHY = {
    type: 'Choose a JPEG or PNG image.',
    size: 'The file is larger than 20 MB. Choose a smaller photo.',
    read: 'The file could not be read as an image. Choose a JPEG or PNG image.',
    big: 'The photo is too detailed to keep in this browser. Choose a smaller photo.',
    storage: "This browser's storage is full or blocked.",
  };
  const ownError = (why) => (OWN_WHY[why] ? `${OWN_ERROR} ${OWN_WHY[why]}` : OWN_ERROR);
  const ownKey = (c) => (c && okPoint(c.lat, c.lon) ? keyOf(c) : '');
  const JPEG_DATA = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
  const ownPhotoFor = (stored, saved) => {
    const k = ownKey(saved);
    return k && stored && typeof stored === 'object' && stored.key === k && typeof stored.img === 'string'
      && stored.img.length <= OWN.maxStored && JPEG_DATA.test(stored.img) ? stored.img : '';
  };
  /* a picked file: '' if it may be read, else the reason. Some systems give no type, then the name decides. */
  const ownFileProblem = (file) => {
    if (!file || typeof file !== 'object') return 'read';
    const type = text(file.type).toLowerCase(), name = text(file.name).toLowerCase();
    const ok = type ? type === 'image/jpeg' || type === 'image/png' : /\.(jpe?g|png)$/.test(name);
    if (!ok) return 'type';
    if (!(Number(file.size) > 0)) return 'read';
    return Number(file.size) > OWN.maxFileBytes ? 'size' : '';
  };
  /* shrink only, so the longer side is at most max pixels */
  const fitSize = (w, h, max = OWN.maxSide) => {
    if (!(w > 0 && h > 0)) return null;
    const k = Math.min(1, max / Math.max(w, h));
    return {w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k))};
  };
  /* encode(quality) -> data address; the first one that fits the storage budget, or '' */
  const encodeWithin = (encode, max = OWN.maxStored, qualities = OWN.qualities) => {
    for (const q of qualities) {
      let d = '';
      try { d = encode(q); } catch { return ''; }
      if (typeof d === 'string' && d.length <= max && JPEG_DATA.test(d)) return d;
    }
    return '';
  };

  /* what the block shows for a chosen clinic, or null when none is chosen or its location is not usable (hidden state).
     saved = Thu's saved clinic, if any: used for the R1 guard; lookup says whether a free photo may be looked up.
     opts.guard = other private locations for this visit (N-8); opts.own = Thu's own photo (data address) for her clinic. */
  const view = (c, saved, opts = {}) => {
    if (!c || !okPoint(c.lat, c.lon)) return null;
    const mine = isMine(c, saved), own = mine && typeof opts.own === 'string' && JPEG_DATA.test(opts.own) ? opts.own : '';
    return {
      state: own ? 'own' : 'none',
      text: own ? 'Your photo' : 'Photo not available',
      img: own,
      alt: own ? `Your photo of ${text(c.name) || 'your clinic'}` : '',
      link: mapsUrl(num(c.lat), num(c.lon)),
      privacy: mine && !own ? 'Photos are not looked up automatically for your clinic, so its location stays private.' : '',
      lookup: lookupAllowed(c, saved, opts.guard),
    };
  };

  /* R4, R9: the Panoramax lookup, with one 10 s limit for the search plus the image download.
     deps: fetch (window.fetch), loadImage(url, signal) -> Promise<boolean>, timeoutMs, now() and onDone(key) (to redraw).
     get(c) gives {state: 'loading' | 'photo' | 'none', photo}. Each location is looked up at most once per visit and the
     result (found, not found, error or too slow) is kept. Callers ask by the clinic shown now, so a late answer for a
     clinic the user has left is stored but never shown in place of the current one. Errors never escape. */
  const PANORAMAX = 'https://api.panoramax.xyz/api/search';
  const LIMIT_MS = 10000;
  const panoramaxUrl = (lat, lon) => `${PANORAMAX}?bbox=${bbox(lat, lon).join(',')}&limit=50`;
  const createLookup = (deps = {}) => {
    const {fetch: get = globalThis.fetch, loadImage, timeoutMs = LIMIT_MS, now = () => Date.now(), onDone = () => {}} = deps;
    const memo = new Map();
    const run = async (lat, lon, signal) => {
      const r = await get(panoramaxUrl(lat, lon), {signal, referrerPolicy: 'no-referrer', credentials: 'omit'});
      if (!r || !r.ok) return null;
      const photo = pickPhoto(parsePanoramax(await r.json()), lat, lon, now());
      if (!photo || !loadImage) return null;
      /* loadImage gives true, or the loaded image itself (N-9: the page then shows that very image, no second download) */
      const got = await loadImage(photo.url, signal);
      return got === true ? {photo, image: null} : got && typeof got === 'object' ? {photo, image: got} : null;
    };
    const start = (c) => {
      const key = keyOf(c), lat = num(c.lat), lon = num(c.lon);
      const entry = {state: 'loading', photo: null, image: null};
      memo.set(key, entry);
      const ctl = typeof AbortController === 'function' ? new AbortController() : null;
      let timer;
      const late = new Promise((res) => { timer = setTimeout(() => { if (ctl) ctl.abort(); res(null); }, timeoutMs); });
      entry.done = Promise.race([run(lat, lon, ctl && ctl.signal).catch(() => null), late]).then((found) => {
        clearTimeout(timer);
        entry.state = found ? 'photo' : 'none'; entry.photo = found ? found.photo : null; entry.image = found ? found.image : null;
        try { onDone(key); } catch { /* a redraw problem must not break the lookup */ }
        return entry;
      });
      return entry;
    };
    return {
      get(c) {
        if (!c || !okPoint(c.lat, c.lon)) return {state: 'none', photo: null};
        const e = memo.get(keyOf(c)) || start(c);
        return {state: e.state, photo: e.photo, image: e.image, done: e.done};
      },
      /* the page could not show the image after all: remember the location as "no photo" */
      fail(c) { if (c && okPoint(c.lat, c.lon)) { const e = memo.get(keyOf(c)); if (e) { e.state = 'none'; e.photo = null; e.image = null; } } },
      key: (c) => (c && okPoint(c.lat, c.lon) ? keyOf(c) : ''),
      size: () => memo.size,
    };
  };

  globalThis.dmPhoto = {okPoint, dist, bearing, angleOff, isMine, lookupAllowed, pickPhoto, parseMapillary, parsePanoramax, bbox,
    credit, creditText, monthYear, mapsUrl, view, createLookup, panoramaxUrl, LIMIT_MS,
    OWN, OWN_ERROR, ownError, ownKey, ownPhotoFor, ownFileProblem, fitSize, encodeWithin,
    NOTE: "The photo shows the location, not necessarily the clinic's current sign."};
})();
