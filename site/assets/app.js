dash.calc('totals', {
  title: 'Totals by province',
  description: 'Adds up markets for each province and for Canada, with population-weighted age shares.',
  inputs: ['markets'],
  fn: (markets) => {
    const sum = (rows, prov) => {
      const add = (k) => rows.reduce((t, r) => t + (r[k] || 0), 0);
      const pop = add('pop');
      const w = (k) => Math.round(rows.reduce((t, r) => t + r[k] * r.pop, 0) / pop * 10000) / 10000;
      return {prov, pop, net: add('net'), arrivals: add('arrivals'), departures: add('departures'), offices: add('offices'), s_yf: w('s_yf'), s_ya: w('s_ya'), s_op: w('s_op'), s_rt: w('s_rt')};
    };
    const provs = [...new Set(markets.map((r) => r.prov))];
    return [sum(markets, 'All'), ...provs.map((p) => sum(markets.filter((r) => r.prov === p), p))];
  },
});
dash.calc('hood_totals', {
  title: 'Postal area totals by market',
  description: 'Adds up postal areas for each market.',
  inputs: ['neighbourhoods'],
  fn: (neighbourhoods) => {
    const by = new Map();
    for (const r of neighbourhoods) {
      const t = by.get(r.market_id) || {market_id: r.market_id, areas: 0, pop: 0, movers: 0, newcomers: 0};
      t.areas += 1; t.pop += r.pop; t.movers += r.movers1; t.newcomers += r.newcomer1;
      by.set(r.market_id, t);
    }
    return [...by.values()];
  },
});

const T = {arr: 15, dep: 10, net: 10};
/* patient areas: nearby postal areas grouped by town; `on` groups are the suggested area, within about 15 minutes' drive along roads and river crossings */
const AREAS = {
  chateauguay: {
    name: 'Châteauguay area', town: 'Châteauguay', market: '2467',
    note: 'The suggestion leaves out the West Island: it looks close on the map, but it is across Lac Saint-Louis.',
    groups: [
      {label: 'Châteauguay', fsas: ['J6J', 'J6K'], places: ['2467050'], on: true},
      {label: 'Mercier', fsas: ['J6R'], places: ['2467045'], on: true},
      {label: 'Beauharnois, Léry, Sainte-Martine', fsas: ['J6N'], places: ['2470022', '2470012'], on: true},
      {label: 'Saint-Constant, Kahnawake', fsas: ['J5A'], places: ['2467035', '2467802'], on: true},
      {label: 'Sainte-Catherine', fsas: ['J5C'], places: ['2467030']},
      {label: 'Delson', fsas: ['J5B'], places: ['2467025']},
      {label: 'La Prairie, Candiac, Saint-Philippe', fsas: ['J5R'], places: ['2467015', '2467020', '2467010']},
      {label: 'Salaberry-de-Valleyfield', fsas: ['J6S', 'J6T'], places: ['2470052']},
      {label: 'LaSalle, across the Mercier bridge', fsas: ['H8N', 'H8P', 'H8R'], places: []},
    ],
  },
  'st-bruno': {
    name: 'St-Bruno area', town: 'Saint-Bruno-de-Montarville', market: '2458',
    note: 'The suggestion leaves out towns across the Richelieu, such as Beloeil. Longueuil does not split its offices by borough, so its postal areas count toward people moving but not toward offices.',
    groups: [
      {label: 'Saint-Bruno-de-Montarville', fsas: ['J3V'], places: ['2458037'], on: true},
      {label: 'Saint-Basile-le-Grand', fsas: ['J3N'], places: ['2457020'], on: true},
      {label: 'Saint-Hubert (Longueuil)', fsas: ['J3Y', 'J3Z'], places: [], on: true},
      {label: 'Boucherville', fsas: ['J4B'], places: ['2458033'], on: true},
      {label: 'Sainte-Julie', fsas: ['J3E'], places: ['2459010'], on: true},
      {label: 'Chambly, Carignan', fsas: ['J3L'], places: ['2457005', '2457010'], on: true},
      {label: 'Beloeil, McMasterville, Saint-Amable', fsas: ['J3G'], places: ['2457040', '2457025', '2459015']},
      {label: 'Mont-Saint-Hilaire, Otterburn Park', fsas: ['J3H'], places: ['2457035', '2457030']},
      {label: 'Varennes', fsas: ['J3X'], places: ['2459020']},
      {label: 'Other nearby Longueuil', fsas: ['J4M', 'J4N', 'J4T'], places: []},
      {label: 'Brossard', fsas: ['J4W', 'J4X', 'J4Y', 'J4Z'], places: ['2458007']},
    ],
  },
};
const areaNow = () => AREAS[P().area] || null;
const areaSuggested = (a) => a.groups.filter((g) => g.on).flatMap((g) => g.fsas);
const areaFsas = () => {
  const a = areaNow(), z = P().zones;
  if (!a) return [];
  if (!z) return areaSuggested(a);
  const all = a.groups.flatMap((g) => g.fsas);
  return z.split(',').filter((x) => all.includes(x));
};
const areaGroups = () => { const a = areaNow(), on = new Set(areaFsas()); return a ? a.groups.filter((g) => g.fsas.every((x) => on.has(x))) : []; };
const areaSet = (fsas) => {
  const a = areaNow(), d = areaSuggested(a);
  const same = fsas.length === d.length && d.every((x) => fsas.includes(x));
  dash.setParams({zones: same ? '' : fsas.length ? fsas.join(',') : 'none'});
};
const areaToggle = (g, on) => { const now = areaFsas().filter((x) => !g.fsas.includes(x)); areaSet(on ? [...now, ...g.fsas] : now); };
const SEG = ['Young families', 'Young adults', 'Older professionals', 'Older working-age', 'Retirees'];
const PROV = {NL: 'Newfoundland and Labrador', PE: 'Prince Edward Island', NS: 'Nova Scotia', NB: 'New Brunswick', QC: 'Quebec', ON: 'Ontario', MB: 'Manitoba', SK: 'Saskatchewan', AB: 'Alberta', BC: 'British Columbia', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut'};
const f = {int: d3.format(',.0f'), sgn: d3.format('+,'), rate: d3.format('+.1f'), dec: d3.format('.1f'), pct: d3.format('.1%'), pct0: d3.format('.0%'), spct: d3.format('+.1%'), usd: (v) => '$' + d3.format(',')(v)};
const dash_ = (v, fn) => (v == null || Number.isNaN(v) ? '—' : fn(v));
const segColor = (s) => dash.colors[SEG.indexOf(s)] ?? 'var(--cds-chart-muted)';
const gain = d3.interpolateBrBG(.85), loss = d3.interpolateBrBG(.15);
const label = (k) => (D('meta') || {})[k] ?? '';
const D = (id) => { const r = dash.data(id); return r.status === 'ok' ? r.data : null; };
const P = () => dash.params();
const filtered = (m) => {
  const p = P(), min = Number(p.minpop || 0);
  return m.filter((r) => (!p.prov || r.prov === p.prov) && (!p.seg || r.segment === p.seg) && r.pop >= min);
};
const ranked = (m) => filtered(m).slice().sort((a, b) => (b.arr_office ?? -1) - (a.arr_office ?? -1));
const pick = (m) => m.find((r) => r.id === P().market) || ranked(m)[0] || null;
const latest = (t) => d3.max(t, (r) => r.period);

/* rings: d3 reads outer rings clockwise */
const fixRings = (gj) => {
  if (gj.__fixed) return gj;
  for (const ft of gj.features) {
    const g = ft.geometry;
    g.coordinates = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((poly) => (d3.geoArea({type: 'Polygon', coordinates: poly}) > 2 * Math.PI ? poly.map((r) => r.slice().reverse()) : poly));
    g.type = 'MultiPolygon';
  }
  gj.__fixed = true;
  return gj;
};
const makeTip = (el) => {
  const t = document.createElement('div');
  t.className = 'dm-tip'; el.appendChild(t);
  return {
    show(ev, lines) {
      t.replaceChildren(...lines.map((l) => { const d = document.createElement('div'); d.textContent = l; return d; }));
      t.style.display = 'block';
      const b = el.getBoundingClientRect();
      const x = Math.min(ev.clientX - b.left + 12, b.width - t.offsetWidth - 4), y = Math.max(0, Math.min(ev.clientY - b.top + 12, b.height - t.offsetHeight - 4));
      t.style.left = Math.max(0, x) + 'px'; t.style.top = y + 'px';
    },
    hide() { t.style.display = 'none'; },
  };
};
const legendSwatches = (el, names) => {
  const l = document.createElement('div'); l.className = 'dm-legend';
  for (const n of names) {
    const s = document.createElement('span'), i = document.createElement('i');
    i.style.background = segColor(n); s.append(i, n); l.appendChild(s);
  }
  el.appendChild(l);
};
const legendRamp = (el, interp, lo, hi) => {
  const l = document.createElement('div'); l.className = 'dm-legend';
  const r = document.createElement('span'); r.className = 'dm-ramp';
  r.style.background = `linear-gradient(90deg,${d3.range(0, 1.01, .1).map(interp).join(',')})`;
  l.append(lo, r, hi); el.appendChild(l);
};
const svgIn = (el, h) => {
  const w = Math.max(240, el.clientWidth || 320);
  return {w, h, svg: d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).style('display', 'block')};
};

/* tables */
const sorts = {mtable: {k: 'arr_office', d: -1}, htable: {k: 'movers1', d: -1}, 'd-towns': {k: 'pop', d: -1}, htbl: {k: 'starts_12m', d: -1}, 'city-postal': {k: 'pop', d: -1}, 'area-places': {k: 'pop', d: -1}, ftbl: {k: 'moved_in', d: -1}};
const sorted = (name, rows) => {
  const {k, d} = sorts[name];
  return rows.slice().sort((a, b) => {
    const x = a[k], y = b[k];
    if (x == null) return 1; if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * d;
  });
};
const fill = (tb, rows, key, cols) => {
  const sel = tb.dataset.draw === 'mtable' ? P().market : null;
  tb.replaceChildren(...rows.map((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r[key];
    if (sel && r[key] === sel) tr.className = 'on';
    for (const [fn, cls] of cols) {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      const v = fn(r);
      if (v instanceof Node) td.appendChild(v); else td.textContent = v;
      tr.appendChild(td);
    }
    return tr;
  }));
};
const segCell = (s) => {
  const w = document.createElement('span'), i = document.createElement('i');
  i.className = 'dm-dot'; i.style.background = segColor(s); w.append(i, s); return w;
};
document.querySelectorAll('.dm table').forEach((t) => {
  t.addEventListener('click', (ev) => {
    const th = ev.target.closest('th[data-field]');
    const tb = t.querySelector('tbody');
    if (!th || !tb) return;
    const name = tb.dataset.draw, s = sorts[name], k = th.dataset.field;
    s.d = s.k === k ? -s.d : (th.classList.contains('n') ? -1 : 1); s.k = k;
    t.querySelectorAll('th').forEach((h) => h.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort', s.d > 0 ? 'ascending' : 'descending');
    dash.draw(name);
  });
});
document.querySelectorAll('tbody[data-draw=mtable]').forEach((tb) => tb.addEventListener('click', (ev) => {
  const tr = ev.target.closest('tr[data-key]');
  if (tr) { dash.setParams({market: tr.dataset.key, area: '', zones: ''}); document.querySelectorAll('#selected').forEach((e) => e.scrollIntoView({block: 'nearest'})); }
}));

/* controls */
document.querySelectorAll('.dm-ctl').forEach((c) => c.addEventListener('change', () => dash.setParams({[c.dataset.param]: c.value})));
document.querySelectorAll('.dm-reset').forEach((b) => b.addEventListener('click', () => dash.resetParams()));
const openTab = (id) => {
  document.querySelectorAll('.dm-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  document.querySelectorAll('.dm-page').forEach((s) => { s.hidden = s.id !== id; });
  dash.setLink(id);
};
document.querySelectorAll('.dm-tab').forEach((b) => b.addEventListener('click', () => openTab(b.dataset.tab)));
document.querySelectorAll('.dm-go').forEach((b) => b.addEventListener('click', () => {
  openTab(b.dataset.goto);
  document.querySelectorAll('.dm-tabs').forEach((e) => e.scrollIntoView({block: 'start'}));
}));
if (['neighbourhoods', 'signals'].includes(location.hash.slice(1))) openTab(location.hash.slice(1));
let shownCodes = [];
document.querySelectorAll('.dm-copy').forEach((b) => b.addEventListener('click', () => {
  const done = () => document.querySelectorAll('.dm-copied').forEach((e) => { e.hidden = false; });
  navigator.clipboard.writeText(shownCodes.join(', ')).then(done).catch(() => {});
}));

/* city search */
const fold = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint').trim();
const cityIn = document.getElementById('dm-city'), cityList = document.getElementById('dm-city-list');
const cityNow = () => {
  const u = D('municipalities'), r = u && u.find((x) => x.id === P().city);
  return r && r.market_id === P().market ? r : null;
};
const cityRows = (r) => {
  const n = D('neighbourhoods'), codes = r && r.fsas ? r.fsas.split(' ') : [];
  return n ? n.filter((x) => codes.includes(x.fsa)) : [];
};
const cityOpen = (open) => {
  cityList.hidden = !open; cityIn.setAttribute('aria-expanded', String(open));
  if (!open) cityIn.removeAttribute('aria-activedescendant');
};
const cityChoose = (r) => { cityOpen(false); cityIn.value = r.name; dash.setParams({city: r.id, market: r.market_id, area: '', zones: ''}); };
let cityHits = [], cityAt = -1;
const cityMark = (i) => {
  cityAt = i;
  [...cityList.children].forEach((li, k) => {
    li.setAttribute('aria-selected', String(k === i));
    if (k === i) { cityIn.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({block: 'nearest'}); }
  });
};
const citySearch = () => {
  const q = fold(cityIn.value), u = D('municipalities') || [];
  if (!q) { cityOpen(false); return; }
  const score = (r) => { const n = fold(r.name); return n.startsWith(q) ? 2 : n.includes(q) ? 1 : 0; };
  cityHits = u.map((r) => [score(r), r]).filter((x) => x[0]).sort((a, b) => b[0] - a[0] || b[1].pop - a[1].pop).slice(0, 8).map((x) => x[1]);
  cityAt = -1;
  cityList.replaceChildren(...cityHits.map((r, i) => {
    const li = document.createElement('li'), s = document.createElement('span');
    li.id = 'dm-city-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
    s.textContent = `${r.prov}, ${r.market} market, ${f.int(r.pop)} people`;
    li.append(r.name, s);
    li.addEventListener('mousedown', (ev) => { ev.preventDefault(); cityChoose(r); });
    return li;
  }));
  if (!cityHits.length) {
    const li = document.createElement('li');
    li.setAttribute('aria-disabled', 'true'); li.textContent = 'No place of 5,000 people or more matches. Smaller places are covered by their market.';
    cityList.appendChild(li);
  }
  cityOpen(true);
};
cityIn.addEventListener('input', citySearch);
cityIn.addEventListener('focus', () => { if (!cityNow()) citySearch(); });
cityIn.addEventListener('blur', () => cityOpen(false));
cityIn.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { cityOpen(false); return; }
  if (cityList.hidden || !cityHits.length) return;
  if (ev.key === 'ArrowDown') { ev.preventDefault(); cityMark((cityAt + 1) % cityHits.length); }
  if (ev.key === 'ArrowUp') { ev.preventDefault(); cityMark((cityAt - 1 + cityHits.length) % cityHits.length); }
  if (ev.key === 'Enter') { ev.preventDefault(); cityChoose(cityHits[Math.max(cityAt, 0)]); }
});
document.querySelectorAll('.dm-area-go').forEach((b) => b.addEventListener('click', () => { cityIn.value = ''; dash.setParams({area: b.dataset.area, zones: '', city: '', market: AREAS[b.dataset.area].market}); }));
document.querySelectorAll('.dm-area-reset').forEach((b) => b.addEventListener('click', () => dash.setParams({zones: ''})));
document.querySelectorAll('.dm-area-clear').forEach((b) => b.addEventListener('click', () => dash.setParams({area: '', zones: ''})));
document.querySelectorAll('.dm-area-copy').forEach((b) => b.addEventListener('click', () => {
  const a = areaNow();
  if (!a) return;
  navigator.clipboard.writeText(areaFsas().join(', ')).then(() => document.querySelectorAll('.dm-area-copied').forEach((e) => { e.hidden = false; })).catch(() => {});
}));
document.querySelectorAll('.dm-city-clear').forEach((b) => b.addEventListener('click', () => { cityIn.value = ''; dash.setParams({city: ''}); }));
document.querySelectorAll('.dm-city-copy').forEach((b) => b.addEventListener('click', () => {
  const r = cityNow();
  if (!r || !r.fsas) return;
  navigator.clipboard.writeText(r.fsas.split(' ').join(', ')).then(() => document.querySelectorAll('.dm-city-copied').forEach((e) => { e.hidden = false; })).catch(() => {});
}));

dash.onData(() => {
  const meta = D('meta');
  if (meta) document.querySelectorAll('[data-label]').forEach((e) => { e.textContent = meta[e.dataset.label] ?? e.textContent; });
  document.querySelectorAll('.dm-ctl').forEach((c) => { c.value = P()[c.dataset.param] ?? ''; });
  const cn = cityNow();
  document.querySelectorAll('#city-card').forEach((e) => { e.hidden = !cn; });
  document.querySelectorAll('.dm-city-copied').forEach((e) => { e.hidden = true; });
  document.querySelectorAll('.dm-city-copy, [data-city-table]').forEach((e) => { e.hidden = !cn || !cn.fsas; });
  if (document.activeElement !== cityIn) cityIn.value = cn ? cn.name : '';
  document.querySelectorAll('#area-card').forEach((e) => { e.hidden = !areaNow(); });
  document.querySelectorAll('.dm-area-copied').forEach((e) => { e.hidden = true; });
  document.querySelectorAll('.dm-area-go').forEach((b) => b.setAttribute('aria-pressed', String(P().area === b.dataset.area)));
  const m = D('markets'), s = m && pick(m);
  document.querySelectorAll('[data-action]').forEach((e) => { e.hidden = !s || e.dataset.action !== s.action; });
  document.querySelectorAll('[data-play]').forEach((e) => { e.hidden = !s || e.dataset.play !== s.segment; });
  document.querySelectorAll('#metro-card').forEach((e) => { e.hidden = !s || !s.metro; });
});

/* text pieces */
const withMarket = (name, field, fn) => dash.draw(name, (el) => {
  const m = D('markets'), s = m && pick(m);
  if (!s) { el.textContent = '—'; return; }
  el.textContent = dash_(s[field], fn);
});
const best = (name, field, fn) => dash.draw(name, (el) => {
  const m = D('markets'), s = m && ranked(m)[0];
  el.textContent = s ? dash_(s[field], fn) : '—';
});
best('t-market', 'market', (v) => v);
best('t-rate', 'arr_office', f.int);
withMarket('d-name', 'market', (v) => v);
withMarket('d-action', 'action', (v) => v);
withMarket('d-seg', 'segment', (v) => v);
withMarket('d-rate', 'net_rate', f.rate);
withMarket('d-ppo', 'people_office', f.int);
withMarket('d-apo', 'arr_office', f.int);
withMarket('d-inc', 'income', f.usd);
const withCity = (name, field, fn) => dash.draw(name, (el) => {
  const r = cityNow();
  if (!r) { el.textContent = '—'; return; }
  el.textContent = dash_(r[field], fn);
});
withCity('city-name', 'name', (v) => v);
withCity('city-pop', 'pop', f.int);
withCity('city-growth', 'growth', f.spct);
withCity('city-off', 'offices', f.int);
withCity('city-ppo', 'people_office', f.int);
const cityMarket = () => { const r = cityNow(), m = D('markets'); return r && m ? m.find((x) => x.id === r.market_id) : null; };
dash.draw('city-sub', (el) => { const r = cityNow(); el.textContent = r ? `${PROV[r.prov]}, in the ${r.market} market` : '—'; });
dash.draw('city-compare', (el) => {
  const s = cityMarket(), t = D('totals'), c = t && t.find((x) => x.prov === 'All');
  el.textContent = s && c ? `For comparison: ${f.int(s.people_office)} people per office across the ${s.market} market and ${f.int(Math.round(c.pop / c.offices))} across Canada. A city with few people per office may also draw patients from nearby towns.` : '—';
});
dash.draw('city-moves', (el) => {
  const s = cityMarket(), t = D('trend');
  el.textContent = s && t ? `Statistics Canada does not publish arrivals or departures by city, so these are for the whole ${s.market} market, ${latest(t)}: about ${f.int(s.arrivals)} new residents and ${f.int(s.departures)} people leaving. Market status: ${s.action}.` : '—';
});
dash.draw('t-scope', (el) => { el.textContent = P().prov ? PROV[P().prov] : 'Canada'; });
for (const n of ['t-period', 'k-period', 'k-period2']) dash.draw(n, (el) => { const t = D('trend'); el.textContent = t ? latest(t) : '—'; });
const canada = (fld, name) => dash.draw(name, (el) => {
  const p = D('provinces'), r = p && p.find((x) => x.province === 'Canada');
  if (!r) { el.textContent = '—'; return; }
  el.textContent = f.pct(r[fld]);
});
canada('growth_latest', 't-now');
canada('growth_prior', 't-prev');
const kpi = (name, fld, fn) => dash.draw(name, (el) => {
  const t = D('totals'), k = P().prov || 'All', r = t && t.find((x) => x.prov === k);
  if (!r) { el.textContent = '—'; return; }
  el.textContent = fn(r[fld]);
});
kpi('k-net', 'net', f.sgn); kpi('k-arr', 'arrivals', f.int); kpi('k-dep', 'departures', f.int); kpi('k-off', 'offices', f.int);
dash.draw('c-arr', (el) => { el.textContent = T.arr; });
dash.draw('c-dep', (el) => { el.textContent = T.dep; });
dash.draw('c-net', (el) => { el.textContent = T.net; });

dash.draw('provs', (sel) => {
  const m = D('markets') || [];
  const ps = [...new Set(m.map((r) => r.prov))].sort((a, b) => PROV[a].localeCompare(PROV[b]));
  sel.replaceChildren(new Option('All of Canada', ''), ...ps.map((p) => new Option(PROV[p], p)));
  sel.value = P().prov ?? '';
  sel.onchange = () => dash.setParams({prov: sel.value, market: '', area: '', zones: ''});
});
dash.draw('mkts', (sel) => {
  const m = D('markets') || [], p = P();
  const list = m.filter((r) => !p.prov || r.prov === p.prov).sort((a, b) => a.market.localeCompare(b.market));
  sel.replaceChildren(...list.map((r) => new Option(`${r.market}, ${r.prov}`, r.id)));
  const s = m.length ? pick(m) : null;
  if (s) sel.value = s.id;
  sel.onchange = () => dash.setParams({market: sel.value, area: '', zones: ''});
});

/* market map */
dash.draw('map', (el) => {
  const g = D('map_markets'), m = D('markets');
  el.replaceChildren();
  if (!g || !m) { el.textContent = '—'; return; }
  fixRings(g);
  const p = P(), by = new Map(m.map((r) => [r.id, r])), keep = new Set(filtered(m).map((r) => r.id)), s = pick(m);
  const feats = g.features.filter((x) => !p.prov || by.get(x.properties.CDUID)?.prov === p.prov);
  let fit = feats;
  if (p.prov && feats.length > 8) { const a = feats.map((x) => d3.geoArea(x)).sort(d3.ascending), cut = a[Math.floor(a.length * .75)]; fit = feats.filter((x) => d3.geoArea(x) <= cut); }
  const {w, svg} = svgIn(el, 0);
  const h = Math.max(320, Math.min(520, w * .78));
  svg.attr('viewBox', `0 0 ${w} ${h}`);
  const proj = d3.geoConicConformal().parallels([49, 77]).rotate([96, 0]).fitExtent([[6, 6], [w - 6, h - 6]], {type: 'FeatureCollection', features: fit});
  const path = d3.geoPath(proj);
  const div = d3.scaleDiverging([-25, 0, 25], d3.interpolateBrBG).clamp(true);
  const hi = d3.quantile(filtered(m).map((r) => r.arr_office).filter((v) => v != null).sort(d3.ascending), .95) || 1;
  const seq = d3.scaleSequential([0, hi], (t) => d3.interpolateBlues(.12 + .83 * t)).clamp(true);
  const col = (r) => {
    if (!r || !keep.has(r.id)) return 'var(--cds-chart-muted)';
    if (p.metric === 'seg') return segColor(r.segment);
    if (p.metric === 'office') return r.arr_office == null ? 'var(--cds-chart-muted)' : seq(r.arr_office);
    return div(r.net_rate);
  };
  const tip = makeTip(el);
  svg.selectAll('path').data(feats).join('path').attr('d', path)
    .style('fill', (x) => col(by.get(x.properties.CDUID)))
    .style('fill-opacity', (x) => (keep.has(x.properties.CDUID) ? 1 : .35))
    .style('stroke', (x) => (s && x.properties.CDUID === s.id ? 'var(--color-fg)' : 'var(--color-panel)'))
    .style('stroke-width', (x) => (s && x.properties.CDUID === s.id ? 2 : .5))
    .style('cursor', 'pointer')
    .on('mousemove', (ev, x) => { const r = by.get(x.properties.CDUID); if (r) tip.show(ev, [`${r.market}, ${r.prov}`, `Net per 1,000: ${f.rate(r.net_rate)}`, `New residents per office: ${dash_(r.arr_office, f.int)}`, r.segment]); })
    .on('mouseleave', () => tip.hide())
    .on('click', (ev, x) => dash.setParams({market: x.properties.CDUID, area: '', zones: ''}));
  svg.selectAll('path').filter((x) => s && x.properties.CDUID === s.id).raise();
  if (p.metric === 'seg') legendSwatches(el, SEG);
  else if (p.metric === 'office') legendRamp(el, (t) => seq(t * hi), '0', f.int(Math.round(hi)) + '+ per office');
  else legendRamp(el, (t) => div(-25 + t * 50), 'Losing 25', 'Gaining 25 per 1,000');
});

/* diverging bars */
const divBars = (el, items) => {
  el.replaceChildren();
  const rowH = 30, {w, svg} = svgIn(el, items.length * rowH);
  const lw = Math.min(118, w * .38), vw = 62;
  const mx = d3.max(items, (d) => Math.abs(d.value)) || 1;
  const hasNeg = items.some((d) => d.value < 0), hasPos = items.some((d) => d.value > 0);
  const x = d3.scaleLinear([hasNeg ? -mx : 0, hasPos ? mx : 0], [lw + (hasNeg ? vw : 0), w - vw]);
  const tip = makeTip(el);
  svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', items.length * rowH).style('stroke', 'var(--cds-chart-axis)');
  const g = svg.selectAll('g.r').data(items).join('g').attr('transform', (d, i) => `translate(0,${i * rowH})`);
  g.append('text').attr('x', 0).attr('y', rowH / 2 + 4).text((d) => d.label).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
  g.append('rect').attr('x', (d) => Math.min(x(0), x(d.value))).attr('y', 7).attr('height', rowH - 14).attr('width', (d) => Math.max(1, Math.abs(x(d.value) - x(0)))).attr('rx', 3).style('fill', (d) => (d.value >= 0 ? gain : loss));
  g.append('text').attr('x', (d) => (d.value >= 0 ? x(d.value) + 4 : x(d.value) - 4)).attr('text-anchor', (d) => (d.value >= 0 ? 'start' : 'end')).attr('y', rowH / 2 + 4).text((d) => f.sgn(d.value)).style('fill', 'var(--color-fg)').style('font-size', 'var(--cds-font-size-caption)');
  g.append('rect').attr('width', w).attr('height', rowH).style('fill', 'transparent').on('mousemove', (ev, d) => tip.show(ev, [d.label, f.sgn(d.value) + ' people'])).on('mouseleave', () => tip.hide());
};
dash.draw('d-streams', (el) => {
  const m = D('markets'), s = m && pick(m);
  if (!s) { el.textContent = '—'; return; }
  divBars(el, [{label: 'Within Canada', value: s.domestic}, {label: 'New immigrants', value: s.immigrants}, {label: 'Temporary residents', value: s.temporary}, {label: 'Emigration', value: -s.emigration}]);
});
dash.draw('d-ages', (el) => {
  const m = D('markets'), s = m && pick(m);
  if (!s) { el.textContent = '—'; return; }
  divBars(el, [{label: 'Young families', value: s.f_yf}, {label: 'Young adults', value: s.f_ya}, {label: 'Ages 45–64', value: s.f_op}, {label: 'Retirees', value: s.f_rt}]);
});
dash.draw('d-mix', (el) => {
  const m = D('markets'), t = D('totals'), s = m && pick(m), base = t && t.find((x) => x.prov === (P().prov || 'All'));
  el.replaceChildren();
  if (!s || !base) { el.textContent = '—'; return; }
  const parts = [['s_yf', 'Young families', 0], ['s_ya', 'Young adults', 1], ['s_op', 'Ages 45–64', 2], ['s_rt', 'Retirees', 4]];
  const rows = [[s.market, s], [P().prov ? PROV[P().prov] : 'Canada', base]];
  const rowH = 46, {w, svg} = svgIn(el, rowH * 2), tip = makeTip(el);
  rows.forEach(([name, r], i) => {
    const g = svg.append('g').attr('transform', `translate(0,${i * rowH})`);
    g.append('text').attr('y', 12).text(name.length > 40 ? name.slice(0, 39) + '…' : name).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
    let x0 = 0;
    for (const [k, label, c] of parts) {
      const bw = r[k] * w;
      g.append('rect').attr('x', x0).attr('y', 18).attr('width', Math.max(0, bw - 2)).attr('height', 20).attr('rx', 3).style('fill', dash.colors[c])
        .on('mousemove', (ev) => tip.show(ev, [name, `${label}: ${f.pct0(r[k])}`])).on('mouseleave', () => tip.hide());
      if (bw > 34) g.append('text').attr('x', x0 + 5).attr('y', 32).text(f.pct0(r[k])).style('fill', '#fff').style('font-size', 'var(--cds-font-size-caption)').style('pointer-events', 'none');
      x0 += bw;
    }
  });
  const l = document.createElement('div'); l.className = 'dm-legend';
  for (const [, label, c] of parts) { const sp = document.createElement('span'), i = document.createElement('i'); i.style.background = dash.colors[c]; sp.append(i, label); l.appendChild(sp); }
  el.appendChild(l);
});
dash.draw('d-trend', (el) => {
  const m = D('markets'), t = D('trend'), s = m && pick(m);
  el.replaceChildren();
  if (!s || !t) { el.textContent = '—'; return; }
  const rows = t.filter((r) => r.id === s.id).sort((a, b) => d3.ascending(a.period, b.period));
  const {w, h, svg} = svgIn(el, 190), tip = makeTip(el);
  const y0 = d3.min(rows, (r) => Math.min(r.domestic, r.international, 0)), y1 = d3.max(rows, (r) => Math.max(r.domestic, r.international, 0));
  const y = d3.scaleLinear([y0, y1], [h - 24, 8]).nice(4);
  const ticks = y.ticks(4), lab = d3.format('~s');
  const probe = svg.append('text').text(lab(y.domain()[0])).style('font-size', 'var(--cds-font-size-caption)');
  const ml = Math.ceil(d3.max(ticks, (v) => { probe.text(lab(v)); return probe.node().getComputedTextLength(); })) + 8;
  probe.remove();
  const x = d3.scaleBand(rows.map((r) => r.period), [ml, w]).paddingInner(.25), x2 = d3.scaleBand(['domestic', 'international'], [0, x.bandwidth()]).padding(.08);
  for (const v of ticks) {
    svg.append('line').attr('x1', ml).attr('x2', w).attr('y1', y(v)).attr('y2', y(v)).style('stroke', v === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
    svg.append('text').attr('x', ml - 6).attr('y', y(v) + 4).attr('text-anchor', 'end').text(lab(v)).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
  }
  rows.forEach((r, i) => {
    if (w > 420 || (rows.length - 1 - i) % 2 === 0) svg.append('text').attr('x', i === rows.length - 1 ? w : x(r.period) + x.bandwidth() / 2).attr('y', h - 6).attr('text-anchor', i === rows.length - 1 ? 'end' : 'middle').text(r.period).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
    [['domestic', 0], ['international', 1]].forEach(([k, c]) => {
      svg.append('rect').attr('x', x(r.period) + x2(k)).attr('width', x2.bandwidth()).attr('y', Math.min(y(r[k]), y(0))).attr('height', Math.max(1, Math.abs(y(r[k]) - y(0)))).attr('rx', 3).style('fill', dash.colors[c]);
    });
    svg.append('rect').attr('x', x(r.period)).attr('width', x.bandwidth()).attr('y', 0).attr('height', h - 20).style('fill', 'transparent')
      .on('mousemove', (ev) => tip.show(ev, [r.period, `Within Canada: ${f.sgn(r.domestic)}`, `International: ${f.sgn(r.international)}`])).on('mouseleave', () => tip.hide());
  });
  const l = document.createElement('div'); l.className = 'dm-legend';
  [['Within Canada', 0], ['International', 1]].forEach(([n, c]) => { const sp = document.createElement('span'), i = document.createElement('i'); i.style.background = dash.colors[c]; sp.append(i, n); l.appendChild(sp); });
  el.appendChild(l);
});
dash.draw('d-towns', (tb) => {
  const m = D('markets'), u = D('municipalities'), s = m && pick(m);
  if (!s || !u) { tb.replaceChildren(); return; }
  fill(tb, sorted('d-towns', u.filter((r) => r.market_id === s.id)), 'id', [[(r) => r.name], [(r) => f.int(r.pop), 'n'], [(r) => f.spct(r.growth), 'n'], [(r) => f.int(r.offices), 'n'], [(r) => dash_(r.people_office, f.int), 'n']]);
});
dash.draw('city-postal', (tb) => { fill(tb, sorted('city-postal', cityRows(cityNow())), 'fsa', [[(r) => r.fsa], [(r) => segCell(r.segment)], [(r) => f.int(r.pop), 'n'], [(r) => f.usd(r.income), 'n'], [(r) => f.pct(r.mover_rate), 'n'], [(r) => f.pct(r.newcomer_rate), 'n']]); });
dash.draw('city-postal-note', (el) => {
  const r = cityNow();
  el.textContent = !r ? '—' : r.fsas ? 'Whole postal areas from the 2021 Census, so a row can include people outside the city. Moving rates cover May 2020 to May 2021. Postal areas are matched to the city by boundary overlap.' : 'No postal area with full census figures is matched to this place. Use the postal areas for its market.';
});
const areaPlaces = () => { const u = D('municipalities'), ids = new Set(areaGroups().flatMap((g) => g.places)); return u ? u.filter((r) => ids.has(r.id)) : []; };
const areaSum = (k) => areaPlaces().reduce((t, r) => t + (r[k] || 0), 0);
const areaText = (name, fn) => dash.draw(name, (el) => { const a = areaNow(); el.textContent = a && D('municipalities') ? fn(a) : '—'; });
areaText('area-name', (a) => a.name);
areaText('area-sub', (a) => `Where patients of a clinic in ${a.town} can realistically come from. The suggestion covers about 15 minutes by car.`);
areaText('area-note', (a) => a.note + ' Places under 5,000 people are inside the postal areas but not listed. Postal areas are whole areas from the 2021 Census, so they can include people outside the listed places.');
dash.draw('area-zones', (el) => {
  const a = areaNow();
  if (!a) { el.replaceChildren(); delete el.dataset.area; return; }
  if (el.dataset.area !== P().area) {
    el.dataset.area = P().area;
    el.replaceChildren(...a.groups.map((g) => {
      const l = document.createElement('label'), c = document.createElement('input'), n = document.createElement('span');
      c.type = 'checkbox'; c.dataset.fsas = g.fsas.join(',');
      c.addEventListener('change', () => areaToggle(g, c.checked));
      n.className = 'dm-note'; n.textContent = g.fsas.join(' ') + (g.on ? ' · suggested' : '');
      l.append(c, g.label, n);
      return l;
    }));
  }
  const on = new Set(areaFsas());
  el.querySelectorAll('input').forEach((c) => { c.checked = c.dataset.fsas.split(',').every((x) => on.has(x)); });
});
areaText('area-pop', () => f.int(areaSum('pop')));
areaText('area-off', () => f.int(areaSum('offices')));
areaText('area-ppo', () => (areaSum('offices') ? f.int(Math.round(areaSum('pop') / areaSum('offices'))) : '—'));
areaText('area-mov', () => f.int((D('neighbourhoods') || []).filter((r) => areaFsas().includes(r.fsa)).reduce((t, r) => t + r.movers1, 0)));
dash.draw('area-places', (tb) => { fill(tb, sorted('area-places', areaPlaces()), 'id', [[(r) => r.name], [(r) => f.int(r.pop), 'n'], [(r) => f.spct(r.growth), 'n'], [(r) => f.int(r.offices), 'n'], [(r) => dash_(r.people_office, f.int), 'n']]); });
const metroOf = () => {
  const m = D('markets'), fl = D('metro_flows'), s = m && pick(m);
  return s && fl ? fl.find((r) => r.metro === s.metro) : null;
};
const metroText = (name, fld, fn) => dash.draw(name, (el) => {
  const r = metroOf();
  if (!r) { el.textContent = '—'; return; }
  el.textContent = fn(r[fld]);
});
dash.draw('m-name', (el) => { const r = metroOf(); el.textContent = r ? r.metro : '—'; });
metroText('m-in', 'moved_in', f.int); metroText('m-out', 'moved_out', f.int);
metroText('m-from', 'from_top', (v) => v); metroText('m-to', 'to_top', (v) => v);
dash.draw('mtable', (tb) => {
  const m = D('markets');
  if (!m) { tb.replaceChildren(); return; }
  fill(tb, sorted('mtable', filtered(m)), 'id', [[(r) => r.market], [(r) => r.prov], [(r) => r.action], [(r) => segCell(r.segment)], [(r) => f.int(r.pop), 'n'], [(r) => f.rate(r.net_rate), 'n'], [(r) => f.int(r.arrivals), 'n'], [(r) => f.int(r.departures), 'n'], [(r) => f.int(r.offices), 'n'], [(r) => dash_(r.people_office, f.int), 'n'], [(r) => dash_(r.arr_office, f.int), 'n']]);
});

/* postal areas */
const hoodAll = () => {
  const m = D('markets'), n = D('neighbourhoods'), s = m && pick(m), a = areaNow(), on = areaFsas();
  return s && n ? n.filter((r) => (a ? on.includes(r.fsa) : r.market_id === s.id)) : [];
};
const hoodRows = () => { const seg = P().seg; return hoodAll().filter((r) => !seg || r.segment === seg); };
const hoodKpi = (name, fld) => dash.draw(name, (el) => {
  const m = D('markets'), t = D('hood_totals'), s = m && pick(m);
  let r = t && s && t.find((x) => x.market_id === s.id);
  if (areaNow()) { const rows = hoodAll(); r = rows.length ? {areas: rows.length, pop: d3.sum(rows, (x) => x.pop), movers: d3.sum(rows, (x) => x.movers1), newcomers: d3.sum(rows, (x) => x.newcomer1)} : null; }
  if (!r) { el.textContent = '—'; return; }
  el.textContent = f.int(r[fld]);
});
dash.draw('h-title', (el) => { const m = D('markets'), s = m && pick(m), a = areaNow(); el.textContent = a ? a.name : s ? s.market : '—'; });
/* dentist pins: the market's, or for an area the ones inside its postal areas */
const pinRows = () => {
  const m = D('markets'), d = D('dentists'), g = D('map_neighbourhoods'), s = m && pick(m), a = areaNow();
  if (!s || !d) return [];
  if (!a || !g) return d.filter((r) => r.market_id === s.id);
  fixRings(g);
  const rows = hoodAll(), mk = new Set(rows.map((r) => r.market_id)), on = areaFsas(), feats = g.features.filter((x) => on.includes(x.properties.CFSAUID));
  return d.filter((r) => mk.has(r.market_id) && feats.some((x) => d3.geoContains(x, [r.lon, r.lat])));
};
hoodKpi('h-n', 'areas'); hoodKpi('h-pop', 'pop'); hoodKpi('h-mov', 'movers'); hoodKpi('h-new', 'newcomers');
dash.draw('s-head', (el) => {
  const p = (D('provinces') || []).filter((r) => r.province !== 'Canada');
  if (p.length) el.textContent = `Population growth slowed in ${p.filter((r) => r.growth_latest < r.growth_prior).length} of ${p.length} provinces and territories`;
});
dash.draw('h-pins', (el) => {
  const m = D('markets'), d = D('dentists'), s = m && pick(m);
  if (P().pins === 'off') { el.textContent = 'Dentist pins are hidden.'; return; }
  if (!s || !d) { el.textContent = '—'; return; }
  const a = areaNow();
  el.textContent = `Pins show ${f.int(pinRows().length)} dentist listings from OpenStreetMap, against ${f.int(a ? areaSum('offices') : s.offices)} offices counted by Statistics Canada in ${a ? 'the listed places' : 'this market'}. The map is incomplete and volunteer-made: an empty area does not mean there is no dentist, and a listing may be out of date. Map data © OpenStreetMap contributors.`;
});
dash.draw('htable', (tb) => {
  const rows = sorted('htable', hoodRows());
  shownCodes = rows.map((r) => r.fsa);
  fill(tb, rows, 'fsa', [[(r) => r.fsa], [(r) => r.place], [(r) => segCell(r.segment)], [(r) => f.int(r.pop), 'n'], [(r) => f.int(r.movers1), 'n'], [(r) => f.pct(r.mover_rate), 'n'], [(r) => f.pct(r.newcomer_rate), 'n'], [(r) => f.pct(r.arrived5_rate), 'n'], [(r) => f.pct(r.recent_imm), 'n'], [(r) => f.usd(r.income), 'n'], [(r) => f.pct(r.renter), 'n'], [(r) => f.pct(r.degree), 'n']]);
});
dash.draw('hmap', (el) => {
  const g = D('map_neighbourhoods'), m = D('markets'), n = D('neighbourhoods'), s = m && pick(m);
  el.replaceChildren();
  if (!g || !n || !s) { el.textContent = '—'; return; }
  fixRings(g);
  const a = areaNow(), cand = a ? new Set(a.groups.flatMap((x) => x.fsas)) : null;
  const rows = a ? n.filter((r) => cand.has(r.fsa)) : hoodAll(), by = new Map(rows.map((r) => [r.fsa, r]));
  const shown = new Set(hoodRows().map((r) => r.fsa));
  const feats = g.features.filter((x) => by.has(x.properties.CFSAUID));
  if (!feats.length) { el.textContent = '—'; return; }
  const {w, svg} = svgIn(el, 0), h = Math.max(320, Math.min(540, w * .62));
  svg.attr('viewBox', `0 0 ${w} ${h}`);
  const proj = d3.geoConicConformal().parallels([49, 77]).rotate([96, 0]).fitExtent([[6, 6], [w - 6, h - 6]], {type: 'FeatureCollection', features: feats});
  const path = d3.geoPath(proj), tip = makeTip(el);
  const ext = d3.extent(rows, (r) => r.mover_rate);
  const seq = d3.scaleSequential(ext, (t) => d3.interpolateBlues(.12 + .83 * t));
  const hm = P().hmetric === 'seg';
  svg.selectAll('path').data(feats).join('path').attr('d', path)
    .style('fill', (x) => { const r = by.get(x.properties.CFSAUID); return hm ? segColor(r.segment) : seq(r.mover_rate); })
    .style('fill-opacity', (x) => (shown.has(x.properties.CFSAUID) ? 1 : .2))
    .style('stroke', 'var(--color-panel)').style('stroke-width', 1)
    .on('mousemove', (ev, x) => { const r = by.get(x.properties.CFSAUID); tip.show(ev, [`${r.fsa}, ${r.place}`, r.segment, `Moved in past year: ${f.pct(r.mover_rate)}`, `Household income: ${f.usd(r.income)}`]); })
    .on('mouseleave', () => tip.hide());
  if (a) svg.selectAll('path').style('cursor', 'pointer').on('click', (ev, x) => { const grp = a.groups.find((q) => q.fsas.includes(x.properties.CFSAUID)); areaToggle(grp, !areaGroups().includes(grp)); });
  const big = feats.filter((x) => { const b = path.bounds(x); return b[1][0] - b[0][0] > 34 && b[1][1] - b[0][1] > 18; });
  const used = [];
  svg.selectAll('text.l').data(big).join('text').attr('class', 'l')
    .attr('transform', (x) => `translate(${path.centroid(x)})`).attr('text-anchor', 'middle').attr('dy', '.35em')
    .text((x) => { const c = path.centroid(x); if (used.some((u) => Math.abs(u[0] - c[0]) < 34 && Math.abs(u[1] - c[1]) < 16)) return ''; used.push(c); return x.properties.CFSAUID; })
    .style('font-size', 'var(--cds-font-size-caption)').style('fill', 'var(--color-fg)').style('paint-order', 'stroke').style('stroke', 'var(--color-panel)').style('stroke-width', 3).style('pointer-events', 'none');
  const pins = P().pins === 'off' ? [] : pinRows().map((r) => ({r, c: proj([r.lon, r.lat])})).filter((x) => x.c && x.c[0] >= 0 && x.c[0] <= w && x.c[1] >= 0 && x.c[1] <= h);
  svg.selectAll('circle.pin').data(pins).join('circle').attr('class', 'pin').attr('cx', (x) => x.c[0]).attr('cy', (x) => x.c[1]).attr('r', 4)
    .style('fill', 'var(--color-fg)').style('stroke', 'var(--color-panel)').style('stroke-width', 2)
    .on('mousemove', (ev, x) => tip.show(ev, [x.r.name, ...(x.r.address ? [x.r.address] : []), 'OpenStreetMap listing'])).on('mouseleave', () => tip.hide());
  if (hm) legendSwatches(el, SEG);
  else legendRamp(el, (t) => seq(ext[0] + t * (ext[1] - ext[0])), f.pct0(ext[0]), f.pct0(ext[1]) + ' moved in the past year');
});

/* latest signals */
dash.draw('provchart', (el) => {
  const p = D('provinces');
  el.replaceChildren();
  if (!p) { el.textContent = '—'; return; }
  const rows = p.slice().sort((a, b) => b.growth_latest - a.growth_latest), rowH = 26;
  const {w, svg} = svgIn(el, rows.length * rowH + 24), tip = makeTip(el);
  const lw = Math.max(150, Math.min(180, w * .42));
  const dom = d3.extent(rows.flatMap((r) => [r.growth_latest, r.growth_prior, 0]));
  const x = d3.scaleLinear(dom, [lw + 8, w - 12]).nice(5);
  x.ticks(5).forEach((v) => {
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 0).attr('y2', rows.length * rowH).style('stroke', v === 0 ? 'var(--cds-chart-axis)' : 'var(--cds-chart-grid)');
    svg.append('text').attr('x', x(v)).attr('y', rows.length * rowH + 16).attr('text-anchor', 'middle').text(f.pct0(v)).style('fill', 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
  });
  const sel = PROV[P().prov];
  rows.forEach((r, i) => {
    const y = i * rowH + rowH / 2, on = r.province === sel || r.province === 'Canada';
    svg.append('text').attr('x', 0).attr('y', y + 4).text(r.province).style('fill', on ? 'var(--color-fg)' : 'var(--color-fg-muted)').style('font-size', 'var(--cds-font-size-caption)');
    svg.append('line').attr('x1', x(r.growth_prior)).attr('x2', x(r.growth_latest)).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-muted)').style('stroke-width', 2);
    svg.append('circle').attr('cx', x(r.growth_prior)).attr('cy', y).attr('r', 4).style('fill', 'var(--cds-chart-muted)');
    svg.append('circle').attr('cx', x(r.growth_latest)).attr('cy', y).attr('r', 5).style('fill', dash.colors[0]);
    svg.append('rect').attr('x', 0).attr('y', i * rowH).attr('width', w).attr('height', rowH).style('fill', 'transparent')
      .on('mousemove', (ev) => tip.show(ev, [r.province, `Year to ${label("july")}: ${f.pct(r.growth_latest)}`, `Year before: ${f.pct(r.growth_prior)}`])).on('mouseleave', () => tip.hide());
  });
  const l = document.createElement('div'); l.className = 'dm-legend';
  [[`Year to ${label('july')}`, dash.colors[0]], ['Year before', 'var(--cds-chart-muted)']].forEach(([n, c]) => { const sp = document.createElement('span'), i = document.createElement('i'); i.style.background = c; sp.append(i, n); l.appendChild(sp); });
  el.appendChild(l);
});
const provMatch = (r) => !P().prov || r.prov.includes(PROV[P().prov]);
dash.draw('htbl', (tb) => {
  const h = D('housing');
  if (!h) { tb.replaceChildren(); return; }
  fill(tb, sorted('htbl', h.filter(provMatch)), 'metro', [[(r) => r.metro], [(r) => f.int(r.starts_12m), 'n'], [(r) => dash_(r.change, f.spct), 'n'], [(r) => dash_(r.family_share, f.pct), 'n']]);
});
dash.draw('ftbl', (tb) => {
  const h = D('metro_flows');
  if (!h) { tb.replaceChildren(); return; }
  fill(tb, sorted('ftbl', h.filter(provMatch)), 'metro', [[(r) => r.metro], [(r) => f.int(r.moved_in), 'n'], [(r) => f.int(r.moved_out), 'n'], [(r) => f.sgn(r.net), 'n'], [(r) => r.from_top, 'wrap']]);
});
