/* BUhostels — owner dashboard. One account can manage several hostels. */
(function () {
  'use strict';
  const { api, esc, fmtMoney, localPhone, icon, toast, confirmBox, busy } = BU;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const main = $('#main');
  const BASE = ((window.BU_CONFIG && window.BU_CONFIG.API_BASE) || '').replace(/\/+$/, '');

  let me = null;
  let meta = { amenities: [], roomTypes: [], genders: [], campuses: [], areas: [] };
  let hostels = [];
  let hostel = null;
  let rt = 0; // render ticket: ignore stale async renders

  const canPost = () => me && me.status === 'approved';
  const hostelLimit = () => Math.max(1, Number(me && me.max_hostels) || 1);
  const typeLabelOf = (t) => (meta.roomTypes.find((x) => x.value === t) || { label: t }).label;

  boot();

  async function boot() {
    const s = await BU.requireRole('owner');
    if (!s) return;
    me = s.profile;

    $('#nOverview').innerHTML = icon('chart') + 'Overview';
    $('#nHostel').innerHTML = icon('home') + 'My hostel';
    $('#nAccount').innerHTML = icon('user') + 'Account';
    $('#nSite').innerHTML = icon('external') + 'View public site';
    $('#logout').innerHTML = icon('logout') + 'Sign out';
    $('#logout').addEventListener('click', BU.logout);
    paintWho();

    try {
      meta = Object.assign(meta, await api('/meta', { auth: false }));
    } catch (e) {
      toast(e.message, 'err');
    }
    paintBanner();
    BU.markPending(me);
    if (BU.takeApprovalNotice(me)) approvedPopup();
    watchApproval();
    window.addEventListener('hashchange', route);
    route();
  }

  // Top-centre pop-up, visible for 5 seconds.
  function approvedPopup() {
    const old = document.getElementById('approvePop');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'approvePop';
    el.className = 'approve-pop';
    el.setAttribute('role', 'status');
    el.innerHTML = icon('check') + '<div><b>You are approved!</b><span>You can now create hostels and add rooms.</span></div>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 5000);
  }

  // While the owner is on the site, check every 20 s (and when they come back to the tab) whether the admin approved them.
  function watchApproval() {
    let busyCheck = false;
    async function check() {
      if (busyCheck || document.hidden) return;
      if (me.status === 'approved' && !localStorage.getItem('buh.pending.' + me.id)) return;
      busyCheck = true;
      try {
        const r = await api('/auth/me');
        const was = me.status;
        me = r.profile;
        BU.session.set(Object.assign({}, BU.session.get(), { profile: me }));
        if (was !== me.status) {
          paintBanner();
          route();
        }
        if (BU.takeApprovalNotice(me)) approvedPopup();
      } catch (e) {
        /* try again next time */
      } finally {
        busyCheck = false;
      }
    }
    setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
  }

  function paintWho() {
    $('#who').textContent = me.full_name;
    $('#whoMail').textContent = me.email;
  }

  function paintBanner() {
    $('#banner').innerHTML = canPost()
      ? ''
      : '<div class="banner"><b>Waiting for approval.</b> Your account is waiting for admin approval. You\'ll be able to add rooms as soon as it\'s approved.</div>';
  }

  // ───────── routing ─────────
  function route() {
    const parts = (location.hash.replace(/^#/, '') || 'overview').split('/');
    const a = parts[0];
    $$('.side nav a').forEach((l) => l.classList.toggle('on', l.dataset.nav === a));
    window.scrollTo(0, 0);
    if (a === 'overview') return viewOverview();
    if (a === 'hostel') return viewHostel(parts[1] || '');
    if (a === 'account') return viewAccount();
    location.hash = '#overview';
  }

  const loading = () => {
    main.onclick = null;
    main.innerHTML = '<div class="loading">Loading…</div>';
  };
  function fail(e) {
    main.innerHTML = '<div class="panel"><h2>Something went wrong</h2><p class="muted">' + esc(e.message) + '</p><p style="margin-top:14px"><button class="btn btn-solid" onclick="location.reload()">Reload</button></p></div>';
  }

  async function refreshHostels() {
    const items = (await api('/owner/hostels')).items || [];
    hostels = items;
    return hostels;
  }

  function saveLastHostel(id) {
    try {
      localStorage.setItem('buh.hostel', id);
    } catch (e) {
      /* private mode */
    }
  }

  function pickHostel(id) {
    let h = id ? hostels.find((x) => x.id === id) : null;
    if (!h) {
      let last = '';
      try {
        last = localStorage.getItem('buh.hostel') || '';
      } catch (e) {
        /* private mode */
      }
      h = last ? hostels.find((x) => x.id === last) : null;
    }
    hostel = h || hostels[0] || null;
    if (hostel) saveLastHostel(hostel.id);
    return hostel;
  }

  function hostelCover(h) {
    if (h.images && h.images.length) return h.images[0].url;
    for (const r of h.rooms || []) {
      if (r.images && r.images.length) return r.images[0].url;
    }
    return '';
  }

  // ───────── overview ─────────
  async function viewOverview() {
    const mine = ++rt;
    loading();
    try {
      const [stats] = await Promise.all([api('/owner/stats?days=30'), refreshHostels()]);
      if (mine !== rt) return;
      pickHostel();
      const t = stats.items.reduce((a, r) => ({ views: a.views + r.views, whatsapp: a.whatsapp + r.whatsapp, calls: a.calls + r.calls }), { views: 0, whatsapp: 0, calls: 0 });
      const rooms = hostels.reduce((n, h) => n + (h.rooms || []).length, 0);
      const name = hostels.length === 1 ? hostels[0].name : 'your hostels';

      const todo = [];
      for (const h of hostels) {
        if (!h.rooms.length) todo.push([h, 'has no rooms or prices yet']);
        if (h.status === 'hidden') todo.push([h, 'is hidden, so visitors cannot see it']);
      }

      main.innerHTML =
        '<div class="dhead"><div><h1>Overview</h1><p>How students are finding ' + esc(name) + ' over the last 30 days.</p></div>' +
        '<div class="acts"><a class="btn btn-solid" href="#hostel">' + icon('home') + 'My hostel</a></div></div>' +
        renderHostelBoxes() +
        nextSteps() +
        '<div class="tiles">' +
          tile('Page views', t.views, 'hostel page opened') +
          tile('WhatsApp taps', t.whatsapp, 'students who messaged you', true) +
          tile('Call taps', t.calls, 'students who tapped call') +
          tile('Rooms', rooms, 'with prices listed') +
        '</div>' +
        (hostels.length
          ? '<div class="panel"><h2>Your hostel' + (hostels.length === 1 ? '' : 's') + '</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hostel</th><th class="num">Views</th><th class="num">WhatsApp</th><th class="num">Calls</th><th></th></tr></thead><tbody>' +
            stats.items.map((r) => '<tr><td class="cell-main">' + esc(r.name) + '</td><td class="num">' + r.views + '</td><td class="num">' + r.whatsapp + '</td><td class="num">' + r.calls + '</td><td class="num"><a class="link" href="#hostel/' + esc(r.hostel_id) + '">Manage</a></td></tr>').join('') +
            '</tbody></table></div></div>'
          : '<div class="panel"><h2>Your hostels</h2><p class="muted">' + (canPost() ? 'Tap Add hostel above to create your first listing.' : 'You can create your first hostel once your account is approved.') + '</p></div>') +
        (todo.length
          ? '<div class="panel"><h2>To get noticed</h2><ul class="todo">' +
            todo.map(([h, msg]) => '<li>' + icon('arrow') + '<span><b>' + esc(h.name) + '</b> ' + msg + '.</span> <a class="link" href="#hostel/' + esc(h.id) + '">Fix</a></li>').join('') +
            '</ul></div>'
          : '');

      const add = $('#addHostel');
      if (add) add.addEventListener('click', () => openHostelForm(null, true));
      const req = $('#requestHostels');
      if (req) req.addEventListener('click', openRequestForm);
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }

  function renderHostelBoxes() {
    const limit = hostelLimit();
    const count = hostels.length;
    const atLimit = count >= limit;
    const controls = canPost() && atLimit
      ? '<button class="btn btn-ghost btn-sm" type="button" id="requestHostels">' + icon('chat') + 'Need more hostels? Request access</button>'
      : '';
    const add = canPost() && !atLimit
      ? '<button class="hostel-box add" type="button" id="addHostel">' + icon('plus') + '<span>Add hostel</span></button>'
      : '';

    return (
      '<section class="hostels-top" aria-labelledby="yourHostels">' +
        '<div class="hostels-head"><h2 id="yourHostels">Your hostels</h2></div>' +
        '<div class="hostel-boxes">' + hostels.map(hostelBox).join('') + add + '</div>' +
        '<div class="hostel-count-row">' +
          '<p class="hostel-count">You manage ' + count + ' of ' + limit + ' hostel' + (limit === 1 ? '' : 's') + '.</p>' +
          controls +
        '</div>' +
      '</section>'
    );
  }

  function hostelBox(h) {
    const cover = hostelCover(h);
    const rooms = h.rooms || [];
    const available = rooms.reduce((n, r) => n + (Number(r.available) || 0), 0);
    const full = rooms.length > 0 && rooms.every((r) => Number(r.available) <= 0);
    return (
      '<a class="hostel-box" href="#hostel/' + esc(h.id) + '" aria-label="Open ' + esc(h.name) + '">' +
        '<span class="hb-cover"' + (cover ? ' style="background-image:url(' + esc(cover) + ')"' : '') + '>' +
          (cover ? '' : '<span class="hb-initials">' + esc(BU.initials(h.name)) + '</span>') +
          '<span class="hb-badges">' +
            '<span class="badge ' + (h.status === 'published' ? 'ok' : '') + '">' + (h.status === 'published' ? 'Live' : 'Hidden') + '</span>' +
            (full ? '<span class="badge bad">Fully booked</span>' : '') +
          '</span>' +
        '</span>' +
        '<span class="hb-body">' +
          '<span class="hb-name">' + esc(h.name) + '</span>' +
          '<span class="hb-campus">' + esc(h.campus ? h.campus + ' campus' : h.area || '') + '</span>' +
          '<span class="hb-rooms">' + rooms.length + ' room' + (rooms.length === 1 ? '' : 's') + ' · ' + available + ' available</span>' +
        '</span>' +
      '</a>'
    );
  }

  function nextSteps() {
    const totalRooms = hostels.reduce((n, h) => n + (h.rooms || []).length, 0);
    let hint;
    if (!canPost()) hint = 'Wait for approval. We will email you when your account is ready.';
    else if (!hostels.length) hint = 'Tap Add hostel to create your first listing.';
    else if (!totalRooms) hint = 'Open your hostel and tap Add room to list your first rooms.';
    else hint = 'Keep availability up to date: tap a room and mark it Booked when it is full.';
    return '<div class="next-steps">' + icon('arrow') + '<span><b>Next step:</b> ' + esc(hint) + '</span></div>';
  }

  function tile(k, v, s, hot) {
    return '<div class="tile' + (hot ? ' hot' : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
  }

  // ───────── my hostel ─────────
  async function viewHostel(id) {
    const mine = ++rt;
    loading();
    try {
      await refreshHostels();
      if (mine !== rt) return;
      pickHostel(id);
      if (!hostel) {
        main.innerHTML = '<div class="dhead"><div><h1>My hostel</h1></div></div><div class="panel"><p class="muted">We could not find a hostel on your account. Please contact support.</p></div>';
        return;
      }
      paintHostel();
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }

  function paintHostel() {
    const h = hostel;
    const approved = canPost();
    const cover = hostelCover(h) || me.avatar_url;
    const statusBadge = !approved
      ? '<span class="badge warn">Pending approval</span>'
      : h.status === 'published'
        ? '<span class="badge ok">Live</span>'
        : '<span class="badge">Hidden</span>';

    const switcher = hostels.length > 1
      ? '<label class="switch-hostel"><span>Switch hostel</span><select id="switchHostel" aria-label="Switch hostel">' +
        hostels.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === h.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') +
        '</select></label>'
      : '';

    const header =
      '<section class="hostel-card">' +
        '<div class="hostel-cover"' + (cover ? ' style="background-image:url(' + esc(cover) + ')"' : '') + '>' +
          (cover ? '' : '<span>' + esc(BU.initials(h.name)) + '</span>') +
        '</div>' +
        '<div class="hostel-info">' +
          '<div class="hostel-title"><h1>' + esc(h.name) + '</h1><span class="lock-hint">' + icon('key') + 'Name is set when the hostel is created</span></div>' +
          '<div class="hostel-meta">' + esc([h.campus && h.campus + ' campus', h.area].filter(Boolean).join(' · ')) + '</div>' +
          '<div class="hostel-tags">' + statusBadge + '</div>' +
          '<div class="hostel-contact">' +
            '<span>' + icon('phone') + esc(localPhone(h.phone)) + '</span>' +
            (h.whatsapp ? '<span>' + icon('chat') + esc(localPhone(h.whatsapp)) + '</span>' : '') +
          '</div>' +
          '<div class="hostel-actions">' +
            (approved ? '<button class="btn btn-ghost btn-sm" id="editDetails" type="button">' + icon('edit') + 'Edit details</button>' : '') +
            (approved ? '<button class="btn btn-ghost btn-sm" id="uploadPhoto" type="button">' + icon('camera') + 'Upload photo</button><input type="file" id="coverFile" accept="image/jpeg,image/png,image/webp" hidden>' : '') +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="hostel.html?id=' + esc(h.id) + '">' + icon('eye') + 'See public page</a>' +
          '</div>' +
        '</div>' +
      '</section>';

    const notice = approved
      ? ''
      : '<div class="notice pending"><b>Waiting for admin approval.</b> Your account is waiting for admin approval. You\'ll be able to add rooms as soon as it\'s approved.</div>';

    const roomsHead =
      '<div class="dhead" style="margin-top:26px"><div><h2 style="font-size:24px">Rooms</h2><p>' + h.rooms.length + ' room' + (h.rooms.length === 1 ? '' : 's') + ' listed.</p></div>' +
      (approved ? '<div class="acts"><button class="btn btn-solid" id="addRoom" type="button">' + icon('plus') + 'Add room</button></div>' : '') +
      '</div>';

    const rooms = h.rooms.length
      ? '<div class="room-grid">' + h.rooms.map(roomCard).join('') + '</div>'
      : '<div class="panel"><p class="muted">' + (approved ? 'No rooms yet. Add your first room.' : 'Your rooms will appear here once approved.') + '</p></div>';

    main.innerHTML = '<a class="back-link" href="#overview">' + icon('left') + 'Back to overview</a>' + switcher + header + notice + roomsHead + rooms;

    const sw = $('#switchHostel');
    if (sw) {
      sw.addEventListener('change', () => {
        saveLastHostel(sw.value);
        location.hash = '#hostel/' + sw.value;
      });
    }
    const ed = $('#editDetails');
    if (ed) ed.addEventListener('click', () => openHostelForm(h, false));
    const upBtn = $('#uploadPhoto');
    const upFile = $('#coverFile');
    if (upBtn && upFile) {
      upBtn.addEventListener('click', () => upFile.click());
      upFile.addEventListener('change', () => uploadHostelPhoto(h, upFile, upBtn));
    }
    const ar = $('#addRoom');
    if (ar) ar.addEventListener('click', () => openRoomForm(null));

    main.onclick = (e) => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      const thumb = e.target.closest('[data-thumb]');
      const book = e.target.closest('[data-book]');
      const reopen = e.target.closest('[data-reopen]');
      if (thumb) {
        const room = hostel.rooms.find((r) => r.id === thumb.dataset.thumb);
        if (room && room.images.length) openLightbox(room.images, Number(thumb.dataset.i), room.name);
        return;
      }
      if (book) {
        const room = hostel.rooms.find((r) => r.id === book.dataset.book);
        if (room) markBooked(room);
        return;
      }
      if (reopen) {
        const room = hostel.rooms.find((r) => r.id === reopen.dataset.reopen);
        if (room) reopenRoom(room);
        return;
      }
      if (edit) {
        const room = hostel.rooms.find((r) => r.id === edit.dataset.edit);
        if (room) openRoomForm(room);
        return;
      }
      if (del) {
        const room = hostel.rooms.find((r) => r.id === del.dataset.del);
        if (room) deleteRoom(room);
      }
    };
  }

  async function uploadHostelPhoto(h, input, btn) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;

    let small;
    try {
      small = await BU.shrinkImage(file, 1800, 0.85);
    } catch (e) {
      toast(e.message, 'err');
      return;
    }

    const label = btn.innerHTML;
    let uploaded = false;
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    try {
      const fd = new FormData();
      fd.append('images', small);
      const r = await api('/owner/hostels/' + h.id + '/images', { method: 'POST', form: fd });
      uploaded = true;
      const img = r.items && r.items[0];
      if (img) await api('/owner/images/' + img.id + '/cover', { method: 'POST' });
      toast('Photo uploaded', 'ok');
      viewHostel(h.id);
    } catch (e) {
      toast(e.message, 'err');
      if (uploaded) viewHostel(h.id);
      else {
        btn.disabled = false;
        btn.innerHTML = label;
      }
    }
  }

  function roomCard(r) {
    const imgs = r.images || [];
    const cover = imgs[0];
    const available = Number(r.available) || 0;
    const thumbs = imgs.map((im, i) => '<button type="button" class="rthumb" data-thumb="' + esc(r.id) + '" data-i="' + i + '" aria-label="View photo ' + (i + 1) + ' of ' + esc(r.name) + '"><img src="' + esc(im.url) + '" alt="" loading="lazy"></button>').join('');
    return (
      '<article class="room-card" data-room="' + esc(r.id) + '">' +
        '<div class="room-media">' + (cover ? '<img src="' + esc(cover.url) + '" alt="">' : '<div class="ph">' + icon('camera') + '</div>') + '</div>' +
        '<div class="room-body">' +
          '<h3>' + esc(r.name) + '</h3>' +
          '<div class="room-sub">' + esc(typeLabelOf(r.type)) + '</div>' +
          '<div class="room-facts"><span class="room-price">' + esc(fmtMoney(r.price)) + '</span><span class="muted">per semester</span></div>' +
          '<div class="room-facts">' + (available > 0 ? '<span>' + available + ' available</span>' : '<span class="badge bad">Booked</span>') + '</div>' +
          (imgs.length ? '<div class="rthumbs">' + thumbs + '</div>' : '') +
          '<div class="room-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-edit="' + esc(r.id) + '">' + icon('edit') + 'Edit</button>' +
            (available > 0
              ? '<button class="btn btn-ghost btn-sm" type="button" data-book="' + esc(r.id) + '">' + icon('check') + 'Mark booked</button>'
              : '<button class="btn btn-ghost btn-sm" type="button" data-reopen="' + esc(r.id) + '">' + icon('plus') + 'Reopen</button>') +
            '<button class="btn btn-ghost btn-sm" type="button" data-del="' + esc(r.id) + '">' + icon('trash') + 'Delete</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function applyRoom(room) {
    if (!hostel) return;
    const i = hostel.rooms.findIndex((r) => r.id === room.id);
    if (i === -1) return;
    hostel.rooms[i] = Object.assign({}, hostel.rooms[i], room);
    const card = main.querySelector('[data-room="' + room.id + '"]');
    if (card) {
      const wrap = document.createElement('div');
      wrap.innerHTML = roomCard(hostel.rooms[i]);
      card.replaceWith(wrap.firstElementChild);
    }
  }

  async function markBooked(room) {
    if (!(await confirmBox({ title: 'Mark this room as booked?', text: room.name + ' will show as booked to students.', ok: 'Mark booked' }))) return;
    try {
      const r = await api('/owner/rooms/' + room.id + '/booked', { method: 'PATCH', body: { booked: true } });
      applyRoom(r.room);
      toast('Room marked booked', 'ok');
    } catch (ex) {
      toast(ex.message, 'err');
    }
  }

  function reopenRoom(room) {
    const d = document.createElement('dialog');
    d.className = 'dlg details-dialog';
    d.innerHTML =
      '<form class="dlg-body details-form" novalidate>' +
        '<div class="room-form-head"><h3>Reopen this room</h3>' +
          '<button class="btn-icon" type="button" id="roClose" aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="room-form-scroll">' +
          field('How many rooms are available now?', '<input id="roAvail" type="number" min="1" max="999" inputmode="numeric" value="1" required>') +
          '<div class="form-err" id="roErr" role="alert"></div>' +
        '</div>' +
        '<div class="room-form-foot"><button class="btn btn-solid" type="submit" id="roSave">Reopen</button></div>' +
      '</form>';
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();
    requestAnimationFrame(() => {
      const input = $('#roAvail', d);
      if (input) input.select();
    });

    $('#roClose', d).addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    $('.details-form', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#roErr', d);
      err.textContent = '';
      const n = Number($('#roAvail', d).value);
      if (!Number.isInteger(n) || n < 1 || n > 999) {
        err.textContent = 'Enter a number from 1 to 999.';
        return;
      }
      const btn = $('#roSave', d);
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const r = await api('/owner/rooms/' + room.id + '/booked', { method: 'PATCH', body: { booked: false, available: n } });
        toast('Room reopened', 'ok');
        d.close();
        applyRoom(r.room);
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'Reopen';
      }
    });
  }

  async function deleteRoom(room) {
    if (!(await confirmBox({ title: 'Delete this room?', text: room.name + ' will be removed from your page.', ok: 'Delete room', danger: true }))) return;
    try {
      await api('/owner/rooms/' + room.id, { method: 'DELETE' });
      toast('Room deleted', 'ok');
      viewHostel();
    } catch (ex) {
      toast(ex.message, 'err');
    }
  }

  function field(label, input, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + input + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }

  // ───────── lightbox (reuses the public page dialog) ─────────
  function openLightbox(images, start, title) {
    if (!images || !images.length) return;
    let cur = (start || 0) % images.length;
    const d = BU.dialog(
      '<div class="lb-wrap"><img alt=""><button class="lb-btn lb-close" type="button" aria-label="Close">' + icon('close') + '</button>' +
        (images.length > 1 ? '<button class="lb-btn lb-prev" type="button" aria-label="Previous photo">' + icon('left') + '</button><button class="lb-btn lb-next" type="button" aria-label="Next photo">' + icon('right') + '</button>' : '') +
        '<span class="lb-count"></span></div>',
      'lightbox'
    );
    const im = d.querySelector('img');
    const count = d.querySelector('.lb-count');
    const paint = () => {
      im.src = images[cur].url;
      im.alt = title || '';
      count.textContent = cur + 1 + ' / ' + images.length;
    };
    paint();
    d.querySelector('.lb-close').addEventListener('click', () => d.close());
    const prev = d.querySelector('.lb-prev');
    const next = d.querySelector('.lb-next');
    if (prev) prev.addEventListener('click', () => { cur = (cur - 1 + images.length) % images.length; paint(); });
    if (next) next.addEventListener('click', () => { cur = (cur + 1) % images.length; paint(); });
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && prev) prev.click();
      if (e.key === 'ArrowRight' && next) next.click();
    });
  }

  // ───────── add / edit room ─────────
  const emptySlot = () => ({ status: 'empty' });

  // The staged photo path is the public URL minus the Supabase prefix.
  function storagePath(url) {
    const m = String(url || '').match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)$/);
    return m ? m[1] : '';
  }

  function mostRecentRoom() {
    if (!hostel || !hostel.rooms.length) return null;
    return [...hostel.rooms].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  function openRoomForm(existing) {
    const editing = !!existing;
    const recent = editing ? null : mostRecentRoom();
    const src = existing || recent || { type: 'single', name: '', price: '', available: 1, description: '' };
    const originalPaths = editing ? (existing.images || []).map((i) => storagePath(i.url)) : null;
    const slots = editing
      ? [0, 1, 2].map((i) => {
          const im = (existing.images || [])[i];
          return im ? { status: 'done', path: storagePath(im.url), url: im.url, preview: im.url } : emptySlot();
        })
      : [emptySlot(), emptySlot(), emptySlot()];

    const d = document.createElement('dialog');
    d.className = 'dlg room-dialog';
    d.innerHTML =
      '<form class="dlg-body room-form" novalidate>' +
        '<div class="room-form-head"><h3>' + (editing ? 'Edit room' : 'Add a room') + '</h3>' +
          '<button class="btn-icon" type="button" id="rfClose" aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="room-form-scroll"><div class="form-grid">' +
          field('Room type', '<select id="rfType" required>' + meta.roomTypes.map((t) => '<option value="' + esc(t.value) + '"' + (t.value === src.type ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select>') +
          field('Room name (optional)', '<input id="rfName" type="text" maxlength="80" value="' + esc(editing ? src.name : '') + '" placeholder="' + esc(typeLabelOf(src.type)) + '">') +
          field('Price per semester (UGX)', '<input id="rfPrice" type="number" min="0" step="1000" inputmode="numeric" value="' + esc(src.price) + '" required>') +
          field('Rooms available', '<input id="rfAvail" type="number" min="0" max="999" inputmode="numeric" value="' + esc(src.available) + '">', 'Put 0 when this type is full.') +
          '<div class="field span2"><label for="rfDesc">Short description (optional)</label><textarea id="rfDesc" maxlength="200" placeholder="e.g. own bathroom, balcony, bed and mattress included">' + esc(src.description || '') + '</textarea><span class="hint"><span id="rfCount">' + esc((src.description || '').length) + '</span>/200</span></div>' +
          '<div class="field span2"><span class="f-label">Room photos (optional, up to 3)</span><div class="slots" id="rfSlots"></div><div class="hint" id="rfCounter" aria-live="polite">0 of 3 uploaded</div></div>' +
        '</div><div class="form-err" id="rfErr" role="alert"></div></div>' +
        '<div class="room-form-foot"><span class="hint" id="rfHelper">Photos are optional. You can add up to 3.</span>' +
          '<button class="btn btn-solid" type="submit" id="rfSave" disabled>Save room</button></div>' +
      '</form>';
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();

    const slotsEl = $('#rfSlots');

    function slotHTML(i, s) {
      if (s.status === 'done') {
        return '<div class="slot done" data-slot="' + i + '"><img src="' + esc(s.preview) + '" alt="Photo ' + (i + 1) + '">' +
          '<span class="slot-check">' + icon('check') + '</span>' +
          '<button type="button" class="slot-x" data-remove="' + i + '" aria-label="Remove photo ' + (i + 1) + '">' + icon('close') + '</button></div>';
      }
      if (s.status === 'uploading') {
        return '<div class="slot uploading" data-slot="' + i + '">' + (s.preview ? '<img src="' + esc(s.preview) + '" alt="">' : '') +
          '<div class="slot-progress"><div class="slot-bar"><i style="width:' + s.progress + '%"></i></div><span>' + s.progress + '%</span></div></div>';
      }
      if (s.status === 'failed') {
        return '<div class="slot failed" data-slot="' + i + '"><div class="slot-fail">' + icon('close') + '<span>' + esc(s.error || 'Upload failed') + '</span></div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-retry="' + i + '">Retry</button></div>';
      }
      return '<label class="slot empty" data-slot="' + i + '"><input type="file" accept="image/*" data-file="' + i + '" hidden>' + icon('plus') + '<span>Add photo</span></label>';
    }

    function paintSlots() {
      slotsEl.innerHTML = slots.map((s, i) => slotHTML(i, s)).join('');
      $('#rfCounter').textContent = slots.filter((s) => s.status === 'done').length + ' of 3 uploaded';
      updateSave();
    }

    function validFields() {
      const price = $('#rfPrice').value;
      const avail = $('#rfAvail').value === '' ? 0 : Number($('#rfAvail').value);
      return Boolean($('#rfType').value) && price !== '' && Number(price) >= 0 && Number(price) <= 50000000 && Number.isInteger(avail) && avail >= 0 && avail <= 999;
    }

    function updateSave() {
      const done = slots.filter((s) => s.status === 'done').length;
      const uploading = slots.some((s) => s.status === 'uploading');
      const btn = $('#rfSave');
      const helper = $('#rfHelper');
      if (uploading) {
        btn.disabled = true;
        btn.textContent = 'Uploading photos...';
        helper.textContent = 'Wait for the photos to finish uploading.';
        return;
      }
      btn.textContent = editing ? 'Save room' : 'Add room';
      const ok = validFields();
      btn.disabled = !ok;
      helper.textContent = ok ? (done ? '' : 'Photos are optional. You can add up to 3.') : 'Fill in the required fields';
    }

    function updateProgress(i) {
      const bar = slotsEl.querySelector('[data-slot="' + i + '"] .slot-bar i');
      const txt = slotsEl.querySelector('[data-slot="' + i + '"] .slot-progress span');
      if (bar) bar.style.width = slots[i].progress + '%';
      if (txt) txt.textContent = slots[i].progress + '%';
    }

    async function doUpload(i) {
      const s = slots[i];
      if (!s || !s.file) return;
      s.status = 'uploading';
      s.progress = 0;
      s.error = '';
      paintSlots();
      try {
        const token = (BU.session.get() || {}).access_token;
        const r = await uploadPhoto(s.file, token, (p) => {
          if (slots[i] === s) {
            s.progress = p;
            updateProgress(i);
          }
        });
        s.status = 'done';
        s.path = r.path;
        s.url = r.url;
        s.preview = r.url;
      } catch (e) {
        s.status = 'failed';
        s.error = e.message;
      }
      paintSlots();
    }

    async function choosePhoto(i, file) {
      if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        toast('Choose a JPG, PNG or WebP photo.', 'err');
        return;
      }
      let small;
      try {
        small = await BU.shrinkImage(file, 1600, 0.82);
      } catch (e) {
        toast(e.message, 'err');
        return;
      }
      slots[i] = { status: 'uploading', progress: 0, preview: URL.createObjectURL(small), file: small };
      paintSlots();
      doUpload(i);
    }

    function samePhotos() {
      if (!originalPaths) return false;
      const done = slots.filter((s) => s.status === 'done');
      return done.length === originalPaths.length && done.every((s, i) => s.path === originalPaths[i]);
    }

    const hasUnsaved = () => (editing ? !samePhotos() : slots.some((s) => s.status !== 'empty'));

    function askDiscard() {
      confirmBox({ title: 'Discard this room?', text: 'Your uploaded photos will not be saved.', ok: 'Discard', danger: true }).then((ok) => {
        if (ok) d.close();
      });
    }

    function requestClose() {
      if (hasUnsaved()) askDiscard();
      else d.close();
    }

    slotsEl.addEventListener('change', (e) => {
      const inp = e.target.closest('input[data-file]');
      if (inp && inp.files[0]) choosePhoto(Number(inp.dataset.file), inp.files[0]);
    });
    slotsEl.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      const retry = e.target.closest('[data-retry]');
      if (rm) {
        slots[Number(rm.dataset.remove)] = emptySlot();
        paintSlots();
      } else if (retry) {
        const i = Number(retry.dataset.retry);
        if (slots[i] && slots[i].file) doUpload(i);
      }
    });

    $('#rfType').addEventListener('change', () => {
      $('#rfName').placeholder = typeLabelOf($('#rfType').value);
    });
    ['#rfType', '#rfPrice', '#rfAvail'].forEach((s) => $(s).addEventListener('input', updateSave));
    $('#rfDesc').addEventListener('input', () => {
      $('#rfCount').textContent = $('#rfDesc').value.length;
    });
    $('#rfClose').addEventListener('click', requestClose);
    d.addEventListener('click', (e) => {
      if (e.target === d) requestClose();
    });
    d.addEventListener('cancel', (e) => {
      if (hasUnsaved()) {
        e.preventDefault();
        askDiscard();
      }
    });

    $('.room-form', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#rfErr');
      err.textContent = '';
      if (slots.some((s) => s.status === 'uploading')) {
        err.textContent = 'Wait for the photos to finish uploading.';
        return;
      }
      if (!validFields()) {
        err.textContent = 'Check the room type, price and rooms available.';
        return;
      }
      const payload = {
        type: $('#rfType').value,
        name: $('#rfName').value,
        price: $('#rfPrice').value,
        available: $('#rfAvail').value,
        description: $('#rfDesc').value,
      };
      const photos = slots.filter((s) => s.status === 'done').map((s) => ({ path: s.path, url: s.url }));
      if (!editing || !samePhotos()) payload.photos = photos;

      const btn = $('#rfSave');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        if (editing) await api('/owner/rooms/' + existing.id, { method: 'PUT', body: payload });
        else await api('/owner/hostels/' + hostel.id + '/rooms', { method: 'POST', body: payload });
        toast(editing ? 'Room updated' : 'Room added', 'ok');
        d.close();
        viewHostel();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        updateSave();
      }
    });

    paintSlots();
  }

  // Uploads one photo and reports real progress. Returns { path, url }.
  function uploadPhoto(file, token, onProgress) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', BASE + '/api/owner/room-photos');
      x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      x.onload = () => {
        try {
          const j = JSON.parse(x.responseText);
          x.status < 300 ? res(j) : rej(new Error(j.error || 'Upload failed'));
        } catch {
          rej(new Error('Upload failed'));
        }
      };
      x.onerror = () => rej(new Error('Network error. Try again.'));
      const f = new FormData();
      f.append('photo', file);
      x.send(f);
    });
  }

  // ───────── add / edit hostel details ─────────
  function openHostelForm(h, create) {
    const src = h || {};
    const v = {
      description: src.description || '',
      area: create ? me.location || '' : src.area || '',
      address: create ? me.address || '' : src.address || '',
      distance_km: src.distance_km == null ? '' : src.distance_km,
      campus: create ? me.campus || '' : src.campus || '',
      latitude: src.latitude == null ? '' : src.latitude,
      longitude: src.longitude == null ? '' : src.longitude,
      phone: create ? me.phone || '' : src.phone || '',
      whatsapp: src.whatsapp && src.whatsapp !== src.phone ? src.whatsapp : '',
      gender: src.gender || 'mixed',
      amenities: src.amenities || [],
      status: src.status || 'published',
    };
    const areas = (meta.areas || []).map((a) => '<option value="' + esc(a) + '">').join('');
    const nameField = create
      ? field('Hostel name', '<input id="fName" type="text" maxlength="80" placeholder="e.g. Sunset Hostel" required>', 'Students will see this name. It cannot be changed later.')
      : '';

    const d = document.createElement('dialog');
    d.className = 'dlg details-dialog';
    d.innerHTML =
      '<form class="dlg-body details-form" novalidate>' +
        '<div class="room-form-head"><h3>' + (create ? 'Add a hostel' : 'Edit hostel details') + '</h3><button class="btn-icon" type="button" id="dfClose" aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="room-form-scroll"><div class="form-grid">' +
          nameField +
          field('Area or town', '<input id="fArea" type="text" list="areaList" maxlength="60" value="' + esc(v.area) + '" required><datalist id="areaList">' + areas + '</datalist>', 'Where the hostel is, e.g. the trading centre.') +
          field('Campus', '<select id="fCampus" required><option value="">Choose a campus</option>' + (meta.campuses || []).map((c) => '<option value="' + esc(c) + '"' + (c === v.campus ? ' selected' : '') + '>' + esc(c) + ' campus</option>').join('') + '</select>') +
          field('Distance from campus (km)', '<input id="fDist" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="' + esc(v.distance_km) + '">', 'Roughly, to the main gate.') +
          field('Who it is for', '<select id="fGender">' + meta.genders.map((g) => '<option value="' + esc(g.value) + '"' + (g.value === v.gender ? ' selected' : '') + '>' + esc(g.label) + '</option>').join('') + '</select>') +
          field('Phone number', '<input id="fPhone" type="tel" value="' + esc(v.phone ? localPhone(v.phone) : '') + '" placeholder="0772 123 456" required>', 'Shown on your page, with a Call button.') +
          field('WhatsApp number', '<input id="fWa" type="tel" value="' + esc(v.whatsapp ? localPhone(v.whatsapp) : '') + '" placeholder="Leave empty if it is the same">') +
          '<div class="field span2"><label for="fAddr">Directions or address</label><input id="fAddr" type="text" maxlength="160" value="' + esc(v.address) + '" placeholder="e.g. 200 m past the market"></div>' +
          '<div class="field span2"><span class="f-label">Map location (optional)</span><div class="geo"><input id="fLat" type="text" inputmode="decimal" placeholder="Latitude" value="' + esc(v.latitude) + '" aria-label="Latitude"><input id="fLng" type="text" inputmode="decimal" placeholder="Longitude" value="' + esc(v.longitude) + '" aria-label="Longitude"><button class="btn btn-ghost btn-sm" type="button" id="fGeo">Use my current location</button></div></div>' +
          '<div class="field span2"><label for="fDesc">About the hostel</label><textarea id="fDesc" maxlength="2000" placeholder="Rules, security, water and power, what makes it a good place to stay…">' + esc(v.description) + '</textarea></div>' +
          '<div class="field span2"><span class="f-label">Amenities</span><div class="checks" id="fAmen">' + meta.amenities.map((a) => '<label class="check"><input type="checkbox" value="' + esc(a) + '"' + (v.amenities.includes(a) ? ' checked' : '') + '><span>' + esc(a) + '</span></label>').join('') + '</div></div>' +
          '<div class="field span2"><label class="check"><input type="checkbox" id="fLive"' + (v.status === 'published' ? ' checked' : '') + '><span>Visible to students</span></label><span class="hint">Untick to hide the hostel without deleting it.</span></div>' +
        '</div><div class="form-err" id="dfErr" role="alert"></div></div>' +
        '<div class="room-form-foot"><button class="btn btn-solid" type="submit" id="dfSave">' + (create ? 'Add hostel' : 'Save changes') + '</button></div>' +
      '</form>';
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();

    $('#dfClose', d).addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    $('#fGeo', d).addEventListener('click', () => {
      if (!navigator.geolocation) return toast('This browser cannot share your location.', 'err');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          $('#fLat', d).value = pos.coords.latitude.toFixed(6);
          $('#fLng', d).value = pos.coords.longitude.toFixed(6);
          toast('Location captured. Save to keep it.', 'ok');
        },
        () => toast('Could not get your location. Allow location access and try again.', 'err'),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });

    $('.details-form', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#dfErr', d);
      err.textContent = '';
      const payload = {
        area: $('#fArea', d).value,
        distance_km: $('#fDist', d).value,
        campus: $('#fCampus', d).value,
        latitude: $('#fLat', d).value.trim(),
        longitude: $('#fLng', d).value.trim(),
        gender: $('#fGender', d).value,
        phone: $('#fPhone', d).value,
        whatsapp: $('#fWa', d).value,
        address: $('#fAddr', d).value,
        description: $('#fDesc', d).value,
        amenities: $$('#fAmen input:checked', d).map((i) => i.value),
        status: $('#fLive', d).checked ? 'published' : 'hidden',
      };
      if (create) payload.name = $('#fName', d).value;
      await busy($('#dfSave', d), create ? 'Creating…' : 'Saving…', async () => {
        try {
          if (create) {
            const r = await api('/owner/hostels', { method: 'POST', body: payload });
            toast('Hostel added', 'ok');
            d.close();
            location.hash = '#hostel/' + r.hostel.id;
          } else {
            await api('/owner/hostels/' + h.id, { method: 'PUT', body: payload });
            toast('Saved', 'ok');
            d.close();
            viewHostel();
          }
        } catch (ex) {
          err.textContent = ex.message;
        }
      });
    });
  }

  function openRequestForm() {
    const d = document.createElement('dialog');
    d.className = 'dlg details-dialog';
    d.innerHTML =
      '<form class="dlg-body details-form" novalidate>' +
        '<div class="room-form-head"><h3>Request more hostels</h3>' +
          '<button class="btn-icon" type="button" id="reqClose" aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="room-form-scroll">' +
          '<p class="muted">Tell the admin why you need another hostel. We will reply by email.</p>' +
          field('Message (optional)', '<textarea id="reqMsg" maxlength="500" rows="5" placeholder="e.g. I have a second hostel near the same campus."></textarea>') +
          '<div class="hint" id="reqCount">0 / 500</div>' +
          '<div class="form-err" id="reqErr" role="alert"></div>' +
        '</div>' +
        '<div class="room-form-foot"><button class="btn btn-solid" type="submit" id="reqSend">Send request</button></div>' +
      '</form>';
    document.body.appendChild(d);
    d.addEventListener('close', () => d.remove());
    d.showModal();

    const msg = $('#reqMsg', d);
    msg.addEventListener('input', () => {
      $('#reqCount', d).textContent = msg.value.length + ' / 500';
    });
    $('#reqClose', d).addEventListener('click', () => d.close());
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
    $('.details-form', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#reqErr', d);
      err.textContent = '';
      const btn = $('#reqSend', d);
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        await api('/owner/request-more-hostels', { method: 'POST', body: { message: msg.value } });
        toast('Request sent. We will reply by email.', 'ok');
        d.close();
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'Send request';
      }
    });
  }

  // ───────── account ─────────
  function viewAccount() {
    ++rt;
    main.onclick = null;
    main.innerHTML =
      '<div class="dhead"><div><h1>Account</h1><p>Your details and password.</p></div></div>' +
      '<form class="panel" id="aForm" novalidate><h2>Your details</h2><div class="form-grid">' +
        field('Full name', '<input id="aName" type="text" maxlength="80" value="' + esc(me.full_name) + '" required>') +
        field('Phone number', '<input id="aPhone" type="tel" value="' + esc(localPhone(me.phone)) + '" required>') +
        field('Email', '<input type="email" value="' + esc(me.email) + '" disabled>', 'To change your email, ask the admin.') +
        field('Account status', '<input type="text" value="' + esc(me.status === 'approved' ? 'Approved' : 'Waiting for approval') + '" disabled>') +
      '</div><div class="form-err" id="aErr" role="alert" style="margin-top:14px"></div><div class="form-foot"><button class="btn btn-solid" type="submit" id="aSave">Save details</button></div></form>' +
      '<form class="panel" id="bForm" novalidate><h2>Your business</h2>' +
        '<div class="logo-pick" style="margin-bottom:16px"><span class="avatar lg" id="bLogo"></span><div><label class="btn btn-ghost btn-sm" for="bFile">' + (me.avatar_url ? 'Change logo' : 'Add logo or photo') + '</label><input id="bFile" type="file" accept="image/jpeg,image/png,image/webp" hidden>' + (me.avatar_url ? ' <button class="btn btn-ghost btn-sm" type="button" id="bDel">Remove</button>' : '') + '<div class="hint">Shown on your hostel page.</div></div></div>' +
        '<div class="form-grid">' +
        field('Hostel or business name', '<input id="bName" type="text" value="' + esc(me.business_name || '') + '" disabled>', 'This is your hostel name. It cannot be changed here.') +
      '</div></form>' +
      '<form class="panel" id="pForm" novalidate><h2>Change password</h2><div class="form-grid">' +
        field('Current password', '<input id="pOld" type="password" autocomplete="current-password" required>') +
        field('New password', '<input id="pNew" type="password" autocomplete="new-password" minlength="8" required>', 'At least 8 characters.') +
      '</div><div class="form-err" id="pErr" role="alert" style="margin-top:14px"></div><div class="form-foot"><button class="btn btn-solid" type="submit" id="pSave">Change password</button></div></form>';

    $('#aForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#aErr').textContent = '';
      await busy($('#aSave'), 'Saving…', async () => {
        try {
          const r = await api('/auth/me', {
            method: 'PATCH',
            body: {
              full_name: $('#aName').value,
              phone: $('#aPhone').value,
              business_name: me.business_name,
              campus: me.campus,
              location: me.location,
              address: me.address,
            },
          });
          me = r.profile;
          BU.session.set(Object.assign({}, BU.session.get(), { profile: me }));
          paintWho();
          toast('Details saved', 'ok');
        } catch (ex) {
          $('#aErr').textContent = ex.message;
        }
      });
    });

    const paintLogo = () => {
      const el = $('#bLogo');
      el.style.backgroundImage = me.avatar_url ? 'url(' + me.avatar_url + ')' : '';
      el.textContent = me.avatar_url ? '' : BU.initials(me.business_name || me.full_name);
    };
    paintLogo();
    const saveMe = (p) => {
      me = p;
      BU.session.set(Object.assign({}, BU.session.get(), { profile: me }));
      paintWho();
    };
    $('#bFile').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const small = await BU.shrinkImage(f, 600, 0.85);
        const fd = new FormData();
        fd.append('avatar', small, small.name);
        saveMe((await api('/owner/avatar', { method: 'POST', form: fd })).profile);
        toast('Logo updated', 'ok');
        viewAccount();
      } catch (ex) {
        toast(ex.message, 'err');
      }
    });
    if ($('#bDel'))
      $('#bDel').addEventListener('click', async () => {
        try {
          saveMe((await api('/owner/avatar', { method: 'DELETE' })).profile);
          viewAccount();
        } catch (ex) {
          toast(ex.message, 'err');
        }
      });

    $('#pForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#pErr').textContent = '';
      await busy($('#pSave'), 'Saving…', async () => {
        try {
          await api('/auth/password', { method: 'POST', body: { current: $('#pOld').value, next: $('#pNew').value } });
          $('#pForm').reset();
          toast('Password changed', 'ok');
        } catch (ex) {
          $('#pErr').textContent = ex.message;
        }
      });
    });
  }
})();
