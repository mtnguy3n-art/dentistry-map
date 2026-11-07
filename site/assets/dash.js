// Small runtime for the dashboard: loads data/*.json, holds the filters and redraws.
window.dash = (() => {
  const DATASETS = ['markets', 'trend', 'neighbourhoods', 'metro_flows', 'housing', 'provinces', 'municipalities', 'dentists', 'map_markets', 'map_neighbourhoods', 'meta'];
  const DEFAULTS = {prov: '', seg: '', minpop: '50000', metric: 'net', market: '', hmetric: 'movers', city: '', pins: 'on'};
  const store = new Map(), calcs = new Map(), draws = new Map();
  const dataHooks = [];
  const query = new URLSearchParams(location.search);
  const state = {...DEFAULTS};
  for (const k of Object.keys(DEFAULTS)) if (query.has(k)) state[k] = query.get(k);
  let ready = false, queued = false;

  const paint = (name) => document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => draws.get(name)(el));
  const render = () => {
    queued = false;
    if (!ready) return;
    dataHooks.forEach((fn) => fn());
    for (const name of draws.keys()) paint(name);
  };
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(render); } };
  const saveUrl = () => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v !== DEFAULTS[k]) q.set(k, v);
    const s = q.toString();
    history.replaceState(null, '', (s ? '?' + s : location.pathname) + location.hash);
  };

  Promise.all(DATASETS.map((id) => fetch(`data/${id}.json`).then((r) => {
    if (!r.ok) throw new Error(`${id}: ${r.status}`);
    return r.json();
  }).then((rows) => store.set(id, rows)))).then(() => {
    for (const [id, c] of calcs) store.set(id, c.fn(...c.inputs.map((i) => store.get(i))));
    ready = true;
    render();
  }).catch((err) => {
    console.error(err);
    const p = document.createElement('p');
    p.className = 'dm-error'; p.textContent = 'The data did not load. Reload the page, or check that the site is being served from a web server.';
    document.querySelector('.dm').prepend(p);
  });

  let width = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== width) { width = innerWidth; schedule(); } });

  return {
    colors: ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'],
    calc(id, def) { calcs.set(id, def); },
    draw(name, fn) {
      if (fn) { draws.set(name, fn); if (ready) paint(name); } else if (draws.has(name)) paint(name);
    },
    data(id) { return store.has(id) ? {status: 'ok', data: store.get(id)} : {status: 'loading'}; },
    params() { return state; },
    setParams(next) { Object.assign(state, next); saveUrl(); schedule(); },
    resetParams() { Object.assign(state, DEFAULTS); saveUrl(); schedule(); },
    onData(fn) { dataHooks.push(fn); },
    setLink(id) { history.replaceState(null, '', location.pathname + location.search + '#' + id); schedule(); },
  };
})();
