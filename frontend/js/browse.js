/* BUhostels — browse page: search, filter, sort. */
(function () {
  'use strict';
  const { api, esc, fmtMoney, icon, hostelCard, debounce } = BU;
  const $ = (s) => document.querySelector(s);

  const EMPTY = { q: '', area: '', min: '', max: '', type: '', gender: '', dist: '', amen: [], sort: 'recommended' };
  const state = Object.assign({}, EMPTY, { amen: [] });
  let meta = { amenities: [], roomTypes: [], genders: [] };
  let facets = null;
  let page = 1;
  let pages = 1;
  let ticket = 0;

  // ───────── boot ─────────
  $('#heroIcon').innerHTML = icon('search');
  $('#filtIcon').innerHTML = icon('filter');
  $('#closeFilters').innerHTML = icon('close');
  $('#footer').innerHTML = BU.footer();

  readUrl();
  init();

  async function init() {
    if (!sessionStorage.getItem('buh.visited')) {
      sessionStorage.setItem('buh.visited', '1');
      BU.track('visit');
    }
    try {
      meta = await api('/meta', { auth: false });
    } catch (e) {
      /* filters still work with defaults */
    }
    buildControls();
    syncControls();
    bind();
    BU.bindCardTracking($('#grid'));
    load(true);
  }

  // ───────── url <-> state ─────────
  function readUrl() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') || '';
    state.area = p.get('area') || '';
    state.min = p.get('min') || '';
    state.max = p.get('max') || '';
    state.type = p.get('type') || '';
    state.gender = p.get('gender') || '';
    state.dist = p.get('dist') || '';
    state.amen = (p.get('amen') || '').split(',').filter(Boolean);
    state.sort = p.get('sort') || 'recommended';
  }
  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.area) p.set('area', state.area);
    if (state.min) p.set('min', state.min);
    if (state.max) p.set('max', state.max);
    if (state.type) p.set('type', state.type);
    if (state.gender) p.set('gender', state.gender);
    if (state.dist) p.set('dist', state.dist);
    if (state.amen.length) p.set('amen', state.amen.join(','));
    if (state.sort !== 'recommended') p.set('sort', state.sort);
    const qs = p.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  // ───────── controls ─────────
  function pillGroup(el, items, key) {
    el.innerHTML = [{ value: '', label: 'Any' }]
      .concat(items)
      .map((it) => '<button type="button" class="pill" data-v="' + esc(it.value) + '" aria-pressed="false">' + esc(it.label) + '</button>')
      .join('');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.pill');
      if (!b) return;
      state[key] = b.getAttribute('data-v');
      syncControls();
      load(true);
    });
  }

  function buildControls() {
    pillGroup($('#ftype'), meta.roomTypes || [], 'type');
    pillGroup($('#fgender'), meta.genders || [], 'gender');
    $('#famen').innerHTML = (meta.amenities || [])
      .map((a) => '<label class="check"><input type="checkbox" value="' + esc(a) + '"><span>' + esc(a) + '</span></label>')
      .join('');
  }

  function fillAreas() {
    if (!facets) return;
    const opts = '<option value="">Any area</option>' + facets.areas.map((a) => '<option value="' + esc(a.name) + '">' + esc(a.name) + ' (' + a.count + ')</option>').join('');
    ['#farea', '#harea'].forEach((id) => {
      const el = $(id);
      el.innerHTML = opts;
      el.value = state.area;
    });
  }

  function syncControls() {
    $('#fq').value = state.q;
    $('#hq').value = state.q;
    $('#farea').value = state.area;
    $('#harea').value = state.area;
    $('#fmin').value = state.min;
    $('#fmax').value = state.max;
    $('#fdist').value = state.dist;
    $('#sort').value = state.sort;
    document.querySelectorAll('#ftype .pill').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === state.type)));
    document.querySelectorAll('#fgender .pill').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === state.gender)));
    document.querySelectorAll('#famen input').forEach((i) => (i.checked = state.amen.includes(i.value)));
  }

  function bind() {
    const go = debounce(() => load(true), 350);

    $('#fq').addEventListener('input', (e) => {
      state.q = e.target.value.trim();
      $('#hq').value = e.target.value;
      go();
    });
    $('#fq').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') BU.track('search', { q: state.q });
    });
    $('#farea').addEventListener('change', (e) => {
      state.area = e.target.value;
      $('#harea').value = state.area;
      load(true);
    });
    $('#fmin').addEventListener('input', (e) => {
      state.min = e.target.value;
      go();
    });
    $('#fmax').addEventListener('input', (e) => {
      state.max = e.target.value;
      go();
    });
    $('#fdist').addEventListener('change', (e) => {
      state.dist = e.target.value;
      load(true);
    });
    $('#famen').addEventListener('change', () => {
      state.amen = [...document.querySelectorAll('#famen input:checked')].map((i) => i.value);
      load(true);
    });
    $('#sort').addEventListener('change', (e) => {
      state.sort = e.target.value;
      load(true);
    });
    $('#more').addEventListener('click', () => load(false));

    $('#resetFilters').addEventListener('click', resetAll);

    $('#heroSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      state.q = $('#hq').value.trim();
      state.area = $('#harea').value;
      syncControls();
      if (state.q) BU.track('search', { q: state.q });
      load(true);
      $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const panel = $('#filters');
    $('#openFilters').addEventListener('click', () => {
      panel.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    const closePanel = () => {
      panel.classList.remove('open');
      document.body.style.overflow = '';
    };
    $('#closeFilters').addEventListener('click', closePanel);
    $('#applyFilters').addEventListener('click', closePanel);

    $('#chips').addEventListener('click', (e) => {
      const c = e.target.closest('[data-clear]');
      if (!c) return;
      const k = c.getAttribute('data-clear');
      if (k === 'price') {
        state.min = '';
        state.max = '';
      } else if (k.startsWith('amen:')) {
        state.amen = state.amen.filter((a) => a !== k.slice(5));
      } else state[k] = '';
      syncControls();
      load(true);
    });

    $('#grid').addEventListener('click', (e) => {
      if (e.target.closest('[data-reset]')) resetAll();
    });
  }

  function resetAll() {
    Object.assign(state, EMPTY, { amen: [], sort: state.sort });
    syncControls();
    load(true);
  }

  // ───────── chips + count ─────────
  function activeFilters() {
    const out = [];
    if (state.q) out.push({ k: 'q', label: '“' + state.q + '”' });
    if (state.area) out.push({ k: 'area', label: state.area });
    if (state.min || state.max) {
      const a = state.min ? fmtMoney(state.min) : 'Any';
      const b = state.max ? fmtMoney(state.max) : 'Any';
      out.push({ k: 'price', label: a + ' – ' + b });
    }
    if (state.type) {
      const t = (meta.roomTypes || []).find((x) => x.value === state.type);
      out.push({ k: 'type', label: t ? t.label : state.type });
    }
    if (state.gender) out.push({ k: 'gender', label: BU.genderLabel(state.gender) });
    if (state.dist) out.push({ k: 'dist', label: 'Within ' + state.dist + ' km' });
    state.amen.forEach((a) => out.push({ k: 'amen:' + a, label: a }));
    return out;
  }

  function renderChips() {
    const f = activeFilters();
    $('#chips').innerHTML = f
      .map((c) => '<button type="button" class="chip" data-clear="' + esc(c.k) + '" aria-label="Remove filter ' + esc(c.label) + '">' + esc(c.label) + icon('close') + '</button>')
      .join('');
    $('#filtN').textContent = f.length ? ' (' + f.length + ')' : '';
  }

  // ───────── loading results ─────────
  function query(p) {
    const q = new URLSearchParams();
    if (state.q) q.set('q', state.q);
    if (state.area) q.set('area', state.area);
    if (state.min) q.set('minPrice', state.min);
    if (state.max) q.set('maxPrice', state.max);
    if (state.type) q.set('type', state.type);
    if (state.gender) q.set('gender', state.gender);
    if (state.dist) q.set('maxDistance', state.dist);
    if (state.amen.length) q.set('amenities', state.amen.join(','));
    q.set('sort', state.sort);
    q.set('page', p);
    q.set('limit', 12);
    return q.toString();
  }

  function skeleton() {
    $('#grid').innerHTML = '<div class="skel skel-card"></div>'.repeat(3);
  }

  async function load(reset) {
    const mine = ++ticket;
    if (reset) {
      page = 1;
      skeleton();
      $('#more').hidden = true;
    } else {
      page += 1;
    }
    writeUrl();
    renderChips();

    let res;
    try {
      res = await api('/hostels?' + query(page), { auth: false });
    } catch (e) {
      if (mine !== ticket) return;
      $('#grid').innerHTML =
        '<div class="empty"><h3>We could not load the hostels</h3><p>' + esc(e.message) + '</p><button class="btn btn-solid" id="retry" type="button">Try again</button></div>';
      $('#retry').addEventListener('click', () => load(true));
      return;
    }
    if (mine !== ticket) return;

    if (!facets) {
      facets = res.facets;
      fillAreas();
      renderLedger();
    }
    pages = res.pages;

    $('#count').textContent = res.total === 1 ? '1 hostel' : res.total + ' hostels';

    const html = res.items.map(hostelCard).join('');
    if (reset) {
      if (!res.items.length) {
        const anyFilter = activeFilters().length > 0;
        $('#grid').innerHTML = anyFilter
          ? '<div class="empty"><h3>No hostels match those filters</h3><p>Try a wider price range, a different room type, or remove a filter.</p><button class="btn btn-solid" data-reset type="button">Clear all filters</button></div>'
          : '<div class="empty"><h3>Hostels are being added</h3><p>Owners are putting their listings up right now. Check back soon, or ask your hostel owner to list on BUhostels.</p><a class="btn btn-solid" href="login.html#register">List a hostel</a></div>';
      } else {
        $('#grid').innerHTML = html;
      }
    } else {
      $('#grid').insertAdjacentHTML('beforeend', html);
    }
    $('#more').hidden = page >= pages;
  }

  function renderLedger() {
    if (!facets) return;
    $('#lgHostels').textContent = facets.total;
    $('#lgRooms').textContent = facets.rooms;
    $('#lgMin').textContent = facets.price ? Number(facets.price.min).toLocaleString('en-US') : '—';
    $('#lgAreas').textContent = facets.areas.length;
    if (facets.price) {
      $('#fmin').placeholder = 'Min · ' + Number(facets.price.min).toLocaleString('en-US');
      $('#fmax').placeholder = 'Max · ' + Number(facets.price.max).toLocaleString('en-US');
    }
  }
})();
