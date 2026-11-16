// Clinic website links: pure rules with no page access, so they can be tested in Node (tests/web.test.mjs).
// Safety check (WR1b), site name (WR2), search text and link (WR4, WR5), Thu's own listing (W10) and the link state
// for a chosen clinic (spec 2.1.1, WR6). Nothing here loads, checks or prefetches any website (WR7).
// Needs photo.js loaded first (dmPhoto: okPoint, dist, isMine, lookupAllowed: the iteration 1 privacy guard, reused).
(() => {
  const P = () => globalThis.dmPhoto;
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const MAX_LEN = 500;

  /* WR1b with QA-W1, QA-W2 and QA-W3: the same host, port and character rules as pipeline/work/weblink.py */
  const SCHEME = /^https?:\/\//i;
  /* QA-W3: one explicit list, identical in weblink.py: space and control characters (C0, DEL, C1 incl. U+0085),
     Unicode spaces, U+FEFF and backslash */
  const BAD_CHAR = /[\x00-\x20\x7f-\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\\]/;
  const LABEL = /^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$/;
  /* QA-W3: a last part that is a number (all digits, or "0x" hex) makes the browser read the host as an IPv4 address;
     only a plain dotted IPv4 address (four numbers 0 to 255, no leading zero) is kept */
  const NUMERIC = /^([0-9]+|0x[0-9a-f]*)$/i;
  /* N-W5: never a private, loopback, link-local or "this network" address: 0/8, 10/8, 127/8, 169.254/16, 172.16/12,
     192.168/16. Same list as pipeline/work/weblink.py (_private_ipv4) */
  const privateIpv4 = ([a, b]) => a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  const ipv4 = (labels) => labels.length === 4 && labels.every((x) => /^(0|[1-9][0-9]{0,2})$/.test(x) && Number(x) < 256) &&
    !privateIpv4(labels.map(Number));
  const hostOk = (host) => {
    const labels = (host.endsWith('.') ? host.slice(0, -1) : host).split('.');
    return labels.length > 1 && labels.every((x) => LABEL.test(x)) && (!NUMERIC.test(labels[labels.length - 1]) || ipv4(labels));
  };
  const portOk = (port) => /^[0-9]+$/.test(port) && Number(port) > 0 && Number(port) < 65536;

  /* the address itself when it is safe to link to, else ''. Never throws. */
  const safeUrl = (s) => {
    if (typeof s !== 'string' || !s || s.length > MAX_LEN || BAD_CHAR.test(s) || !SCHEME.test(s)) return '';
    const netloc = s.slice(s.indexOf('//') + 2).split(/[/?#]/, 1)[0];
    if (netloc.includes('@')) return ''; /* user name or password part */
    const i = netloc.indexOf(':'), host = i < 0 ? netloc : netloc.slice(0, i);
    if (i >= 0 && !portOk(netloc.slice(i + 1))) return '';
    if (!hostOk(host)) return '';
    try {
      const u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:' || u.username || u.password || !u.hostname) return '';
    } catch { return ''; }
    return s;
  };

  /* WR2: host of the very address the link opens, lower case, no leading "www.", no port, path or query. '' if unsafe. */
  const siteName = (url) => {
    const s = safeUrl(url);
    if (!s) return '';
    try {
      const h = new URL(s).hostname.toLowerCase().replace(/\.$/, '');
      return h.startsWith('www.') && h.length > 4 ? h.slice(4) : h;
    } catch { return ''; }
  };

  /* WR4: a name made only of these words says nothing about which clinic it is */
  const GENERIC = new Set(['dentist', 'dentists', 'dentiste', 'dentistes', 'dental', 'dentaire', 'dentistry', 'denturist',
    'denturologiste', 'office', 'clinic', 'clinique', 'centre', 'center', 'cabinet', 'care', 'soins', 'de', 'du', 'des',
    'la', 'le', 'the',
    /* PM decision (fix round 1): plurals and English generic words, e.g. "Cliniques dentaires", "Denture Clinic",
       "Family Dentistry", "Dentisterie familiale" */
    'dentaires', 'cliniques', 'clinics', 'centres', 'centers', 'offices', 'cabinets', 'soin', 'denturists',
    'denturologistes', 'denturiste', 'denturistes', 'denture', 'dentures', 'family', 'familiale', 'familial',
    'dentisterie', 'and', 'et']);
  const words = (s) => text(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const isGeneric = (name) => words(name).every((w) => GENERIC.has(w)); /* an empty name is generic too */
  const join = (...parts) => parts.map(text).filter(Boolean).join(' ').replace(/\s+/g, ' ');

  /* WR4: search text for a listing, or '' when no search can be built (generic name with no address) */
  const searchText = (listing, town) => {
    if (!listing) return '';
    const name = text(listing.name);
    if (!isGeneric(name)) return join(name, town);
    return text(listing.address) ? join(name, listing.address, town) : '';
  };
  /* QA-W4: lone surrogate halves cannot be encoded; drop them so the link can always be built */
  const wellFormed = (s) => s.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '');
  /* WR5: the search link holds the search text only. Never throws. */
  const searchUrl = (t) => {
    const q = join(wellFormed(text(t)));
    if (!q) return '';
    try { return 'https://www.google.com/search?q=' + encodeURIComponent(q); } catch { return ''; }
  };

  /* W10: Thu's listing = the closest listing within 30 m of her saved clinic, or null */
  const MINE_M = 30;
  const ownListing = (saved, listings) => {
    const {okPoint, dist} = P();
    if (!saved || !okPoint(saved.lat, saved.lon) || !Array.isArray(listings)) return null;
    let best = null, bestD = Infinity;
    for (const r of listings) {
      if (!r || !okPoint(r.lat, r.lon)) continue;
      const d = dist(Number(saved.lat), Number(saved.lon), Number(r.lat), Number(r.lon));
      if (d <= MINE_M && d < bestD) { best = r; bestD = d; }
    }
    return best;
  };

  const NONE = Object.freeze({kind: 'none', url: '', label: '', aria: '', note: ''});
  const NOT_LISTED = 'Website not listed';
  const site = (url) => {
    const name = siteName(url);
    return name ? {kind: 'site', url: safeUrl(url), label: `Website: ${name}`, aria: `Website: ${name}`, note: ''} : null;
  };

  /* "Your clinic" card (2.1.3, WR6): the W10 listing's website, else nothing. Never a search. */
  const cardLink = (saved, listings) => {
    const r = ownListing(saved, listings);
    return (r && site(r.web)) || NONE;
  };

  /* spec 2.1.1 / 2.1.2: link state for the clinic at the centre of the Competition tab.
     ctx.saved = Thu's saved clinic; ctx.guard = clinic locations saved earlier this visit (N-8);
     ctx.listings = all listings (for W10); ctx.town = the listing's town as shown in the suggestions.
     Returns {kind: 'site'|'search'|'listed'|'none', url, label, aria, note}; note is the "Website not listed" text. */
  const linkFor = (c, ctx = {}) => {
    const {okPoint, lookupAllowed} = P();
    if (!c || !okPoint(c.lat, c.lon)) return NONE;
    const {saved = null, guard = [], listings = [], town = ''} = ctx || {};
    /* Thu's own clinic (the "Use your clinic" centre, marked mine, or the saved clinic itself): the same as her card (W10).
       QA-W5: any other listing, even one in her building within 30 m, only ever gets its own website (or nothing, W11),
       so another clinic's website is never shown under its name (AC-9.3). */
    if (c.mine || c === saved) return cardLink(saved && okPoint(saved.lat, saved.lon) ? saved : c, listings);
    const own = site(c.web);
    if (own) return own;
    /* W11: no search link within 100 m of the saved clinic or of a location saved earlier this visit */
    if (!lookupAllowed(c, saved, guard)) return NONE;
    const url = searchUrl(searchText(c, town));
    if (!url) return {kind: 'listed', url: '', label: '', aria: '', note: NOT_LISTED};
    return {kind: 'search', url, label: 'Search the web', aria: `Search the web for ${wellFormed(text(c.name)).trim() || 'this clinic'}`, note: NOT_LISTED};
  };

  globalThis.dmWeb = {safeUrl, siteName, isGeneric, searchText, searchUrl, ownListing, cardLink, linkFor, NOT_LISTED};
})();
