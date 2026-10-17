/* BUhostels — admin dashboard. */
(function () {
  'use strict';
  const { api, esc, fmtMoney, fmtPhone, timeAgo, fullDate, icon, toast, confirmBox, formDialog, busy } = BU;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const main = $('#main');

  let me = null;
  let rt = 0;
  let timers = [];
  let pendingCount = 0;

  boot();

  async function boot() {
    const s = await BU.requireRole('admin');
    if (!s) return;
    me = s.profile;
    $('#who').textContent = me.full_name;
    $('#whoMail').textContent = me.email;
    $('#nOverview').innerHTML = icon('chart') + 'Overview';
    $('#nActivity').innerHTML = icon('pulse') + 'Live activity';
    $('#nHostels').innerHTML = icon('home') + 'Hostels';
    $('#nOwners').innerHTML = icon('users') + 'Owners<span class="count" id="pendBadge" hidden></span>';
    $('#nSite').innerHTML = icon('external') + 'View public site';
    $('#logout').innerHTML = icon('logout') + 'Sign out';
    $('#logout').addEventListener('click', BU.logout);
    window.addEventListener('hashchange', route);
    route();
  }

  function setPending(n) {
    pendingCount = n;
    const b = $('#pendBadge');
    if (!b) return;
    b.textContent = n;
    b.hidden = !n;
  }

  function stopTimers() {
    timers.forEach(clearInterval);
    timers = [];
  }

  function route() {
    stopTimers();
    main.onclick = null;
    const a = location.hash.replace(/^#/, '') || 'overview';
    $$('.side nav a').forEach((l) => l.classList.toggle('on', l.dataset.nav === a));
    window.scrollTo(0, 0);
    if (a === 'overview') return viewOverview();
    if (a === 'activity') return viewActivity();
    if (a === 'hostels') return viewHostels();
    if (a === 'owners') return viewOwners();
    location.hash = '#overview';
  }

  const loading = () => (main.innerHTML = '<div class="loading">Loading…</div>');
  function fail(e) {
    main.innerHTML = '<div class="panel"><h2>Something went wrong</h2><p class="muted">' + esc(e.message) + '</p><p style="margin-top:14px"><button class="btn btn-solid" onclick="location.reload()">Reload</button></p></div>';
  }
  const tile = (k, v, s, hot) => '<div class="tile' + (hot ? ' hot' : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
  const num = (n) => Number(n || 0).toLocaleString('en-US');

  // ───────── overview ─────────
  async function viewOverview(quiet) {
    const mine = ++rt;
    if (!quiet) loading();
    const days = Number(localStorage.getItem('buh.days')) || 14;
    try {
      const o = await api('/admin/overview?days=' + days);
      if (mine !== rt) return;
      setPending(o.totals.owners_pending);
      const p = o.period;
      const t = o.totals;

      main.innerHTML =
        '<div class="dhead"><div><h1>Overview</h1><p>What is happening on BUhostels right now.</p></div>' +
        '<div class="acts"><div class="seg" id="range" role="group" aria-label="Time range">' +
        [7, 14, 30].map((d) => '<button type="button" data-d="' + d + '" aria-pressed="' + (d === days) + '">' + d + ' days</button>').join('') + '</div></div></div>' +
        '<div class="tiles six">' +
          tile('Visits', num(p.visits), 'last ' + days + ' days') +
          tile('Unique visitors', num(p.visitors), 'different devices') +
          tile('Hostel views', num(p.views), 'pages opened') +
          tile('WhatsApp taps', num(p.whatsapp), 'students messaging owners', true) +
          tile('Call taps', num(p.calls), 'students calling') +
          tile('Searches', num(p.searches), 'typed on the site') +
        '</div>' +
        '<div class="panel"><div class="ph2"><h2>Visits and contacts per day</h2></div><div class="chart">' + chart(o.series) + '</div>' +
          '<div class="legend"><span><i class="l-bar"></i>Visits</span><span><i class="l-line"></i>WhatsApp + call taps</span></div></div>' +
        '<div class="cols">' +
          '<div class="panel"><h2>Most viewed hostels</h2>' + topHostels(o.top_hostels) + '</div>' +
          '<div class="panel"><h2>What students search for</h2>' + topSearches(o.top_searches) + '</div>' +
        '</div>' +
        '<div class="tiles" style="margin-top:18px">' +
          tile('Hostels', t.published + ' / ' + t.hostels, 'live / total') +
          tile('Room types', num(t.rooms), 'with prices') +
          tile('Photos', num(t.photos), 'uploaded') +
          tile('Owners', t.owners_approved + ' / ' + t.owners, 'approved / total') +
        '</div>' +
        (o.pending.length
          ? '<div class="panel"><div class="ph2"><h2>Waiting for your approval</h2><a class="link" href="#owners">All owners</a></div><div class="tbl-wrap"><table class="tbl"><tbody>' +
            o.pending.map((x) =>
              '<tr><td><div class="cell-main">' + esc(x.full_name) + '</div><div class="cell-sub">' + esc(fmtPhone(x.phone)) + ' · ' + esc(x.email) + '</div></td>' +
              '<td class="cell-sub">Signed up ' + esc(timeAgo(x.created_at)) + '</td>' +
              '<td><div class="row-acts"><button class="btn btn-solid btn-sm" data-approve="' + esc(x.id) + '">Approve</button></div></td></tr>').join('') +
            '</tbody></table></div></div>'
          : '');

      $('#range').addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (!b) return;
        localStorage.setItem('buh.days', b.dataset.d);
        viewOverview();
      });
      main.onclick = async (e) => {
        const a = e.target.closest('[data-approve]');
        if (!a) return;
        await busy(a, '…', async () => {
          try {
            await api('/admin/owners/' + a.dataset.approve + '/status', { method: 'PATCH', body: { status: 'approved' } });
            toast('Owner approved', 'ok');
            viewOverview(true);
          } catch (ex) {
            toast(ex.message, 'err');
          }
        });
      };

      timers.push(setInterval(() => { if (!document.hidden) viewOverview(true); }, 45000));
    } catch (e) {
      if (mine === rt && !quiet) fail(e);
    }
  }

  function topHostels(list) {
    const rows = (list || []).filter((h) => h.views || h.contacts);
    if (!rows.length) return '<p class="empty-s">No hostel views yet in this period.</p>';
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hostel</th><th class="num">Views</th><th class="num">Contacts</th></tr></thead><tbody>' +
      rows.map((h) => '<tr><td><a class="cell-main" href="hostel.html?id=' + esc(h.id) + '" target="_blank" rel="noopener">' + esc(h.name) + '</a><div class="cell-sub">' + esc(h.area) + '</div></td><td class="num">' + h.views + '</td><td class="num">' + h.contacts + '</td></tr>').join('') +
      '</tbody></table></div>';
  }
  function topSearches(list) {
    if (!list || !list.length) return '<p class="empty-s">No searches yet in this period.</p>';
    return '<ul class="rank">' + list.map((s) => '<li><span>“' + esc(s.term) + '”</span><span class="n">' + s.n + '×</span></li>').join('') + '</ul>';
  }

  // Hand-drawn SVG chart: bars = visits, line = contact taps.
  function chart(series) {
    if (!series || !series.length) return '<p class="empty-s">No data yet.</p>';
    const W = 760, H = 250, L = 38, R = 12, T = 14, B = 30;
    const iw = W - L - R, ih = H - T - B;
    const peak = Math.max(4, ...series.map((d) => Math.max(d.visits, d.contacts)));
    const raw = peak / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.max(1, [1, 2, 5, 10].find((m) => raw <= m * mag) * mag);
    const top = step * 4;
    const bw = iw / series.length;
    const y = (v) => T + ih - (ih * v) / top;
    const every = Math.ceil(series.length / 8);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      g += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(step * i) + '" y2="' + y(step * i) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (y(step * i) + 4) + '" text-anchor="end">' + step * i + '</text>';
    }
    const label = (day) => new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    series.forEach((d, i) => {
      const x = L + i * bw + bw * 0.2;
      const h = ih * (d.visits / top);
      g += '<rect class="bar" x="' + x.toFixed(1) + '" y="' + (T + ih - h).toFixed(1) + '" width="' + (bw * 0.6).toFixed(1) + '" height="' + h.toFixed(1) + '"><title>' + esc(label(d.day)) + ': ' + d.visits + ' visits, ' + d.visitors + ' visitors, ' + d.contacts + ' contact taps</title></rect>';
      if (i % every === 0 || i === series.length - 1) {
        g += '<text class="ax" x="' + (L + i * bw + bw / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle">' + esc(label(d.day)) + '</text>';
      }
    });
    const pts = series.map((d, i) => (L + i * bw + bw / 2).toFixed(1) + ',' + y(d.contacts).toFixed(1)).join(' ');
    g += '<polyline class="ln" points="' + pts + '"/>';
    series.forEach((d, i) => {
      g += '<circle class="dt" cx="' + (L + i * bw + bw / 2).toFixed(1) + '" cy="' + y(d.contacts).toFixed(1) + '" r="3.2"><title>' + esc(label(d.day)) + ': ' + d.contacts + ' contact taps</title></circle>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visits and contact taps per day">' + g + '</svg>';
  }

  // ───────── live activity ─────────
  const GROUPS = [['all', 'Everything'], ['visitors', 'Visitors'], ['contacts', 'Contacts'], ['owners', 'Owners & admin']];

  function who(ev) {
    const v = ev.meta && ev.meta.vid;
    return '<b>Visitor ' + esc(v ? '#' + v.slice(0, 4) : '') + '</b>';
  }
  function describe(ev) {
    const m = ev.meta || {};
    const h = '<b>' + esc(m.hostel || 'a hostel') + '</b>';
    const a = '<b>' + esc(m.actor || 'An owner') + '</b>';
    switch (ev.type) {
      case 'visit': return who(ev) + ' opened the site';
      case 'view': return who(ev) + ' viewed ' + h;
      case 'search': return who(ev) + ' searched “' + esc(m.q) + '”';
      case 'whatsapp': return who(ev) + ' tapped <b>WhatsApp</b> on ' + h;
      case 'call': return who(ev) + ' tapped <b>Call</b> on ' + h;
      case 'owner_signup': return a + ' signed up as an owner and is waiting for approval';
      case 'owner_login': return a + ' signed in';
      case 'owner_created': return 'You added owner <b>' + esc(m.owner) + '</b>';
      case 'owner_approved': return 'Owner <b>' + esc(m.owner) + '</b> was approved';
      case 'owner_suspended': return 'Owner <b>' + esc(m.owner) + '</b> was suspended';
      case 'owner_pending': return 'Owner <b>' + esc(m.owner) + '</b> was set back to waiting';
      case 'owner_deleted': return 'Owner <b>' + esc(m.owner) + '</b> was deleted';
      case 'hostel_created': return a + ' posted a new hostel, ' + h;
      case 'hostel_updated': return a + ' updated the details of ' + h;
      case 'hostel_deleted': return (m.by === 'admin' ? 'You deleted ' : a + ' deleted ') + h;
      case 'hostel_status': return h + ' was ' + (m.status === 'hidden' ? 'hidden' : 'published') + ' by admin';
      case 'room_saved': return a + ' ' + esc(m.action || 'saved') + ' <b>' + esc(m.room || 'a room') + '</b>' + (m.price ? ' (' + esc(fmtMoney(m.price)) + ')' : '') + ' in ' + h;
      case 'room_deleted': return a + ' removed <b>' + esc(m.room || 'a room') + '</b> from ' + h;
      case 'photo_added': return a + ' added ' + (m.count || 1) + ' photo' + (m.count === 1 ? '' : 's') + ' to ' + h;
      default: return esc(ev.type);
    }
  }
  const kind = (t) => (t === 'whatsapp' || t === 'call' ? 'k-contact' : t === 'visit' ? 'k-visit' : ['view', 'search'].includes(t) ? '' : 'k-owner');

  function viewActivity() {
    const mine = ++rt;
    let group = 'all';
    let items = [];
    let newest = 0;
    let paused = false;

    main.innerHTML =
      '<div class="dhead"><div><h1>Live activity</h1><p>Visitors, contact taps and owner changes as they happen.</p></div>' +
      '<div class="acts"><span class="live" id="live"><i></i><span id="liveTxt">Live</span></span><button class="btn btn-ghost btn-sm" id="pause" type="button">Pause</button></div></div>' +
      '<div class="panel" style="margin-top:0"><div class="ph2"><div class="seg" id="groups" role="group" aria-label="Filter activity">' +
      GROUPS.map(([k, l]) => '<button type="button" data-g="' + k + '" aria-pressed="' + (k === group) + '">' + l + '</button>').join('') +
      '</div></div><ul class="feed" id="feed"></ul><div style="margin-top:14px;text-align:center"><button class="btn btn-ghost btn-sm" id="older" type="button" hidden>Load older</button></div></div>';

    const feed = $('#feed');
    const li = (ev, fresh) =>
      '<li class="' + kind(ev.type) + (fresh ? ' fresh' : '') + '" data-id="' + ev.id + '"><span class="dot"></span><span>' + describe(ev) + '</span><span class="when" title="' + esc(fullDate(ev.created_at)) + '" data-t="' + esc(ev.created_at) + '">' + esc(timeAgo(ev.created_at)) + '</span></li>';

    async function first() {
      feed.innerHTML = '<li class="muted" style="display:block">Loading…</li>';
      try {
        const r = await api('/admin/activity?limit=60&group=' + group);
        if (mine !== rt) return;
        items = r.items;
        newest = items.length ? items[0].id : 0;
        feed.innerHTML = items.length ? items.map((e) => li(e)).join('') : '<li class="muted" style="display:block">Nothing yet. Open the public site in another tab and it will show up here.</li>';
        $('#older').hidden = items.length < 60;
      } catch (e) {
        if (mine === rt) feed.innerHTML = '<li class="muted" style="display:block">' + esc(e.message) + '</li>';
      }
    }

    async function poll() {
      if (paused || document.hidden || mine !== rt) return;
      try {
        const r = await api('/admin/activity?limit=100&since=' + newest + '&group=' + group);
        if (mine !== rt || !r.items.length) return;
        newest = r.items[0].id;
        if (feed.querySelector('.muted')) feed.innerHTML = '';
        feed.insertAdjacentHTML('afterbegin', r.items.map((e) => li(e, true)).join(''));
        while (feed.children.length > 300) feed.lastElementChild.remove();
      } catch (e) {
        /* try again on the next tick */
      }
    }

    $('#groups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]');
      if (!b) return;
      group = b.dataset.g;
      $$('#groups button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      first();
    });
    $('#pause').addEventListener('click', (e) => {
      paused = !paused;
      e.target.textContent = paused ? 'Resume' : 'Pause';
      $('#live').classList.toggle('paused', paused);
      $('#liveTxt').textContent = paused ? 'Paused' : 'Live';
      if (!paused) poll();
    });
    $('#older').addEventListener('click', async (e) => {
      const last = feed.lastElementChild;
      if (!last || !last.dataset.id) return;
      await busy(e.target, 'Loading…', async () => {
        try {
          const r = await api('/admin/activity?limit=60&before=' + last.dataset.id + '&group=' + group);
          feed.insertAdjacentHTML('beforeend', r.items.map((x) => li(x)).join(''));
          if (r.items.length < 60) $('#older').hidden = true;
        } catch (ex) {
          toast(ex.message, 'err');
        }
      });
    });

    first();
    timers.push(setInterval(poll, 5000));
    timers.push(setInterval(() => { $$('#feed .when').forEach((w) => (w.textContent = timeAgo(w.dataset.t))); }, 30000));
  }

  // ───────── hostels ─────────
  async function viewHostels() {
    const mine = ++rt;
    loading();
    try {
      let list = (await api('/admin/hostels')).items;
      if (mine !== rt) return;
      let q = '';
      let st = '';

      const draw = () => {
        const rows = list.filter((h) => {
          if (st && h.status !== st) return false;
          if (q && !(h.name + ' ' + h.area + ' ' + (h.owner ? h.owner.full_name : '')).toLowerCase().includes(q)) return false;
          return true;
        });
        $('#hBody').innerHTML = rows.length
          ? rows.map((h) =>
              '<tr><td><a class="cell-main" href="hostel.html?id=' + esc(h.id) + '" target="_blank" rel="noopener">' + esc(h.name) + '</a><div class="cell-sub">' + esc(h.area) + '</div></td>' +
              '<td>' + (h.owner ? '<div>' + esc(h.owner.full_name) + '</div><div class="cell-sub">' + esc(fmtPhone(h.owner.phone)) + '</div>' : '<span class="muted">—</span>') + '</td>' +
              '<td class="num">' + h.rooms_count + '</td><td class="num">' + (h.min_price != null ? esc(fmtMoney(h.min_price)) : '—') + '</td>' +
              '<td class="num">' + h.photos_count + '</td><td class="num">' + h.views + ' / ' + h.contacts + '</td>' +
              '<td><span class="badge ' + (h.status === 'published' ? 'ok' : 'warn') + '">' + (h.status === 'published' ? 'Live' : 'Hidden') + '</span></td>' +
              '<td><div class="row-acts"><button class="btn-icon' + (h.featured ? ' on' : '') + '" data-feat="' + esc(h.id) + '" aria-pressed="' + h.featured + '" aria-label="' + (h.featured ? 'Remove from featured' : 'Feature this hostel') + '" title="Featured hostels are shown first">' + icon('star') + '</button>' +
              '<button class="btn btn-ghost btn-sm" data-vis="' + esc(h.id) + '">' + (h.status === 'published' ? 'Hide' : 'Publish') + '</button>' +
              '<button class="btn-icon" data-del="' + esc(h.id) + '" aria-label="Delete ' + esc(h.name) + '">' + icon('trash') + '</button></div></td></tr>').join('')
          : '<tr><td colspan="8" class="muted" style="padding:28px 10px">No hostels match.</td></tr>';
      };

      main.innerHTML =
        '<div class="dhead"><div><h1>Hostels</h1><p>' + list.length + ' listed by owners.</p></div>' +
        '<div class="acts"><input id="hSearch" type="search" placeholder="Search name, area or owner" style="width:250px" aria-label="Search hostels">' +
        '<select id="hStatus" style="width:auto" aria-label="Status"><option value="">All</option><option value="published">Live</option><option value="hidden">Hidden</option></select></div></div>' +
        '<div class="panel" style="margin-top:0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hostel</th><th>Owner</th><th class="num">Rooms</th><th class="num">From</th><th class="num">Photos</th><th class="num">Views / contacts</th><th>Status</th><th></th></tr></thead><tbody id="hBody"></tbody></table></div></div>';
      draw();

      $('#hSearch').addEventListener('input', BU.debounce((e) => { q = e.target.value.trim().toLowerCase(); draw(); }, 150));
      $('#hStatus').addEventListener('change', (e) => { st = e.target.value; draw(); });

      $('#hBody').addEventListener('click', async (e) => {
        const f = e.target.closest('[data-feat]');
        const v = e.target.closest('[data-vis]');
        const d = e.target.closest('[data-del]');
        try {
          if (f) {
            const h = list.find((x) => x.id === f.dataset.feat);
            await api('/admin/hostels/' + h.id, { method: 'PATCH', body: { featured: !h.featured } });
            h.featured = !h.featured;
            draw();
          }
          if (v) {
            const h = list.find((x) => x.id === v.dataset.vis);
            const next = h.status === 'published' ? 'hidden' : 'published';
            await api('/admin/hostels/' + h.id, { method: 'PATCH', body: { status: next } });
            h.status = next;
            draw();
            toast(next === 'hidden' ? 'Hostel hidden' : 'Hostel published', 'ok');
          }
          if (d) {
            const h = list.find((x) => x.id === d.dataset.del);
            if (!(await confirmBox({ title: 'Delete ' + h.name + '?', text: 'The hostel, its rooms and photos will be removed for good.', ok: 'Delete hostel', danger: true }))) return;
            await api('/admin/hostels/' + h.id, { method: 'DELETE' });
            list = list.filter((x) => x.id !== h.id);
            draw();
            toast('Hostel deleted', 'ok');
          }
        } catch (ex) {
          toast(ex.message, 'err');
        }
      });
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }

  // ───────── owners ─────────
  const STATUS = { approved: ['ok', 'Approved'], pending: ['warn', 'Waiting'], suspended: ['bad', 'Suspended'] };

  async function viewOwners() {
    const mine = ++rt;
    loading();
    try {
      let list = (await api('/admin/owners')).items;
      if (mine !== rt) return;
      setPending(list.filter((o) => o.status === 'pending').length);

      const draw = () => {
        $('#oBody').innerHTML = list.length
          ? list.map((o) => {
              const s = STATUS[o.status] || ['', o.status];
              return '<tr><td><div class="cell-main">' + esc(o.full_name) + '</div><div class="cell-sub">' + esc(o.email) + '</div></td>' +
                '<td>' + esc(fmtPhone(o.phone)) + '</td><td class="num">' + o.hostels_count + '</td>' +
                '<td class="cell-sub">' + esc(timeAgo(o.created_at)) + '</td><td><span class="badge ' + s[0] + '">' + s[1] + '</span></td>' +
                '<td><div class="row-acts">' +
                (o.status !== 'approved' ? '<button class="btn btn-solid btn-sm" data-st="approved" data-id="' + esc(o.id) + '">Approve</button>' : '') +
                (o.status === 'approved' ? '<button class="btn btn-ghost btn-sm" data-st="suspended" data-id="' + esc(o.id) + '">Suspend</button>' : '') +
                (o.status === 'suspended' ? '' : '') +
                '<button class="btn-icon" data-pw="' + esc(o.id) + '" aria-label="Reset password for ' + esc(o.full_name) + '" title="Reset password">' + icon('key') + '</button>' +
                '<button class="btn-icon" data-rm="' + esc(o.id) + '" aria-label="Delete ' + esc(o.full_name) + '">' + icon('trash') + '</button></div></td></tr>';
            }).join('')
          : '<tr><td colspan="6" class="muted" style="padding:28px 10px">No owners yet. Owners sign up from the public site, or add one yourself.</td></tr>';
      };

      main.innerHTML =
        '<div class="dhead"><div><h1>Owners</h1><p>Approve new accounts, suspend, reset passwords.</p></div>' +
        '<div class="acts"><button class="btn btn-solid" id="addOwner" type="button">' + icon('plus') + 'Add owner</button></div></div>' +
        '<div class="panel" style="margin-top:0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Owner</th><th>Phone</th><th class="num">Hostels</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody id="oBody"></tbody></table></div></div>';
      draw();

      const reload = async () => {
        list = (await api('/admin/owners')).items;
        setPending(list.filter((o) => o.status === 'pending').length);
        draw();
      };

      $('#addOwner').addEventListener('click', async () => {
        const v = await formDialog({
          title: 'Add an owner',
          note: 'Creates an approved account. Give them the email and password so they can sign in.',
          ok: 'Create owner',
          body:
            '<div class="field"><label for="n1">Full name</label><input id="n1" name="full_name" type="text" required></div>' +
            '<div class="field"><label for="n2">Phone</label><input id="n2" name="phone" type="tel" placeholder="0772 123 456" required></div>' +
            '<div class="field"><label for="n3">Email</label><input id="n3" name="email" type="email" required></div>' +
            '<div class="field"><label for="n4">Password</label><input id="n4" name="password" type="text" minlength="8" required><span class="hint">At least 8 characters.</span></div>',
        });
        if (!v) return;
        try {
          await api('/admin/owners', { method: 'POST', body: v });
          toast('Owner created', 'ok');
          reload();
        } catch (ex) {
          toast(ex.message, 'err');
        }
      });

      $('#oBody').addEventListener('click', async (e) => {
        const st = e.target.closest('[data-st]');
        const pw = e.target.closest('[data-pw]');
        const rm = e.target.closest('[data-rm]');
        try {
          if (st) {
            await api('/admin/owners/' + st.dataset.id + '/status', { method: 'PATCH', body: { status: st.dataset.st } });
            toast(st.dataset.st === 'approved' ? 'Owner approved' : 'Owner suspended', 'ok');
            reload();
          }
          if (pw) {
            const o = list.find((x) => x.id === pw.dataset.pw);
            const v = await formDialog({
              title: 'Reset password',
              note: 'Set a new password for ' + o.full_name + ', then tell them what it is.',
              ok: 'Set password',
              body: '<div class="field"><label for="rp">New password</label><input id="rp" name="password" type="text" minlength="8" required></div>',
            });
            if (!v) return;
            await api('/admin/owners/' + o.id + '/password', { method: 'POST', body: v });
            toast('Password updated', 'ok');
          }
          if (rm) {
            const o = list.find((x) => x.id === rm.dataset.rm);
            if (!(await confirmBox({ title: 'Delete ' + o.full_name + '?', text: 'Their account, ' + o.hostels_count + ' hostel(s), rooms and photos will be removed for good.', ok: 'Delete owner', danger: true }))) return;
            await api('/admin/owners/' + o.id, { method: 'DELETE' });
            toast('Owner deleted', 'ok');
            reload();
          }
        } catch (ex) {
          toast(ex.message, 'err');
        }
      });
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }
})();
