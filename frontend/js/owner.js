/* BUhostels — owner dashboard. */
(function () {
  'use strict';
  const { api, esc, fmtMoney, localPhone, icon, toast, confirmBox, busy } = BU;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const main = $('#main');
  const MAX_PHOTOS = 20;

  let me = null;
  let meta = { amenities: [], roomTypes: [], genders: [], areas: [] };
  let hostels = [];
  let rt = 0; // render ticket: ignore stale async renders

  const canPost = () => me && me.status === 'approved';

  boot();

  async function boot() {
    const s = await BU.requireRole('owner');
    if (!s) return;
    me = s.profile;

    $('#nOverview').innerHTML = icon('chart') + 'Overview';
    $('#nHostels').innerHTML = icon('home') + 'My hostels';
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
    window.addEventListener('hashchange', route);
    route();
  }

  function paintWho() {
    $('#who').textContent = me.full_name;
    $('#whoMail').textContent = me.email;
  }

  function paintBanner() {
    $('#banner').innerHTML = canPost()
      ? ''
      : '<div class="banner"><b>Waiting for approval.</b> The admin will approve your account soon. You can look around now, and posting unlocks as soon as you are approved.</div>';
  }

  // ───────── routing ─────────
  function route() {
    const parts = (location.hash.replace(/^#/, '') || 'overview').split('/');
    const a = parts[0];
    $$('.side nav a').forEach((l) => l.classList.toggle('on', l.dataset.nav === (a === 'hostel' ? 'hostels' : a)));
    window.scrollTo(0, 0);
    if (a === 'overview') return viewOverview();
    if (a === 'hostels') return viewHostels();
    if (a === 'hostel') return viewEditor(parts[1], parts[2] || 'details');
    if (a === 'account') return viewAccount();
    location.hash = '#overview';
  }

  const loading = () => (main.innerHTML = '<div class="loading">Loading…</div>');
  function fail(e) {
    main.innerHTML = '<div class="panel"><h2>Something went wrong</h2><p class="muted">' + esc(e.message) + '</p><p style="margin-top:14px"><button class="btn btn-solid" onclick="location.reload()">Reload</button></p></div>';
  }

  async function refreshHostels() {
    hostels = (await api('/owner/hostels')).items;
    return hostels;
  }

  // ───────── overview ─────────
  async function viewOverview() {
    const mine = ++rt;
    loading();
    try {
      const [stats] = await Promise.all([api('/owner/stats?days=30'), refreshHostels()]);
      if (mine !== rt) return;
      const t = stats.items.reduce((a, r) => ({ views: a.views + r.views, whatsapp: a.whatsapp + r.whatsapp, calls: a.calls + r.calls }), { views: 0, whatsapp: 0, calls: 0 });
      const rooms = hostels.reduce((n, h) => n + h.rooms.length, 0);

      const todo = [];
      hostels.forEach((h) => {
        if (!h.rooms.length) todo.push([h, 'has no rooms or prices yet', 'rooms']);
        if (h.images.length < 3) todo.push([h, 'has ' + h.images.length + ' photo' + (h.images.length === 1 ? '' : 's') + ' — add at least 3', 'photos']);
        if (h.status === 'hidden') todo.push([h, 'is hidden, so visitors cannot see it', 'details']);
      });

      main.innerHTML =
        '<div class="dhead"><div><h1>Overview</h1><p>How visitors are finding your hostels over the last 30 days.</p></div>' +
        '<div class="acts"><a class="btn btn-solid" href="#hostel/new">' + icon('plus') + 'Add a hostel</a></div></div>' +
        '<div class="tiles">' +
          tile('Page views', t.views, 'hostel pages opened') +
          tile('WhatsApp taps', t.whatsapp, 'students who messaged you', true) +
          tile('Call taps', t.calls, 'students who tapped call') +
          tile('Hostels', hostels.length, hostels.filter((h) => h.status === 'published').length + ' visible') +
          tile('Room types', rooms, 'with prices listed') +
        '</div>' +
        (hostels.length
          ? '<div class="panel"><h2>Per hostel</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hostel</th><th class="num">Views</th><th class="num">WhatsApp</th><th class="num">Calls</th><th></th></tr></thead><tbody>' +
            stats.items.map((r) => '<tr><td class="cell-main">' + esc(r.name) + '</td><td class="num">' + r.views + '</td><td class="num">' + r.whatsapp + '</td><td class="num">' + r.calls + '</td><td class="num"><a class="link" href="#hostel/' + esc(r.hostel_id) + '/details">Edit</a></td></tr>').join('') +
            '</tbody></table></div></div>'
          : '<div class="panel"><h2>Post your first hostel</h2><p class="muted" style="max-width:56ch;margin-bottom:16px">Add the hostel details, list each room type with its price per semester, then upload clear photos. It goes live straight away.</p>' +
            '<a class="btn btn-clay" href="#hostel/new">' + icon('plus') + 'Add a hostel</a></div>') +
        (todo.length
          ? '<div class="panel"><h2>To get noticed</h2><ul class="todo">' +
            todo.map(([h, msg, tab]) => '<li>' + icon('arrow') + '<span><b>' + esc(h.name) + '</b> ' + msg + '.</span> <a class="link" href="#hostel/' + esc(h.id) + '/' + tab + '">Fix</a></li>').join('') +
            '</ul></div>'
          : '');
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }

  function tile(k, v, s, hot) {
    return '<div class="tile' + (hot ? ' hot' : '') + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="s">' + esc(s) + '</div></div>';
  }

  // ───────── hostel list ─────────
  async function viewHostels() {
    const mine = ++rt;
    loading();
    try {
      await refreshHostels();
      if (mine !== rt) return;
      main.innerHTML =
        '<div class="dhead"><div><h1>My hostels</h1><p>Everything you have listed on BUhostels.</p></div>' +
        '<div class="acts"><a class="btn btn-solid' + (canPost() ? '' : ' disabled') + '" href="#hostel/new">' + icon('plus') + 'Add a hostel</a></div></div>' +
        (hostels.length
          ? '<div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Hostel</th><th>Status</th><th class="num">Rooms</th><th class="num">Photos</th><th></th></tr></thead><tbody>' +
            hostels.map(row).join('') + '</tbody></table></div></div>'
          : '<div class="panel"><p class="muted">You have not added a hostel yet.</p></div>');

      main.onclick = async (e) => {
        const t = e.target.closest('[data-act]');
        if (!t) return;
        const h = hostels.find((x) => x.id === t.dataset.id);
        if (!h) return;
        if (t.dataset.act === 'toggle') {
          if (!guard()) return;
          await busy(t, '…', async () => {
            try {
              await api('/owner/hostels/' + h.id, { method: 'PUT', body: Object.assign(hostelBody(h), { status: h.status === 'published' ? 'hidden' : 'published' }) });
              toast(h.status === 'published' ? 'Hostel hidden' : 'Hostel is live', 'ok');
              viewHostels();
            } catch (ex) {
              toast(ex.message, 'err');
            }
          });
        }
        if (t.dataset.act === 'delete') {
          if (!guard()) return;
          const ok = await confirmBox({ title: 'Delete ' + h.name + '?', text: 'This removes the hostel, its rooms and all its photos. It cannot be undone.', ok: 'Delete hostel', danger: true });
          if (!ok) return;
          try {
            await api('/owner/hostels/' + h.id, { method: 'DELETE' });
            toast('Hostel deleted', 'ok');
            viewHostels();
          } catch (ex) {
            toast(ex.message, 'err');
          }
        }
      };
    } catch (e) {
      if (mine === rt) fail(e);
    }
  }

  function row(h) {
    const cover = h.images[0];
    return (
      '<tr><td><div class="thumb">' + (cover ? '<img src="' + esc(cover.url) + '" alt="">' : '<div class="ph"><span>' + esc(BU.initials(h.name)) + '</span></div>') + '</div></td>' +
      '<td><div class="cell-main">' + esc(h.name) + '</div><div class="cell-sub">' + esc(h.area) + '</div></td>' +
      '<td><span class="badge ' + (h.status === 'published' ? 'ok' : '') + '">' + (h.status === 'published' ? 'Live' : 'Hidden') + '</span></td>' +
      '<td class="num">' + h.rooms.length + '</td><td class="num">' + h.images.length + '</td>' +
      '<td><div class="row-acts"><a class="btn btn-ghost btn-sm" href="#hostel/' + esc(h.id) + '/details">' + icon('edit') + 'Edit</a>' +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="hostel.html?id=' + esc(h.id) + '">' + icon('eye') + 'View</a>' +
      '<button class="btn btn-ghost btn-sm" data-act="toggle" data-id="' + esc(h.id) + '">' + (h.status === 'published' ? 'Hide' : 'Show') + '</button>' +
      '<button class="btn-icon" data-act="delete" data-id="' + esc(h.id) + '" aria-label="Delete ' + esc(h.name) + '">' + icon('trash') + '</button></div></td></tr>'
    );
  }

  function guard() {
    if (canPost()) return true;
    toast('You can post once the admin approves your account.', 'err');
    return false;
  }

  function hostelBody(h) {
    return {
      name: h.name, description: h.description || '', area: h.area, address: h.address || '', distance_km: h.distance_km == null ? '' : h.distance_km,
      phone: h.phone, whatsapp: h.whatsapp && h.whatsapp !== h.phone ? h.whatsapp : '', gender: h.gender, amenities: h.amenities || [], status: h.status,
    };
  }

  // ───────── editor ─────────
  async function viewEditor(id, tab) {
    const mine = ++rt;
    loading();
    let h = null;
    try {
      if (id !== 'new') h = (await api('/owner/hostels/' + encodeURIComponent(id))).hostel;
      if (mine !== rt) return;
    } catch (e) {
      if (mine !== rt) return;
      return fail(e);
    }

    const base = h ? '#hostel/' + h.id : '';
    main.innerHTML =
      '<div class="dhead"><div><p class="eyebrow">' + (h ? 'Editing' : 'New hostel') + '</p><h1>' + esc(h ? h.name : 'Add a hostel') + '</h1></div>' +
      '<div class="acts">' + (h ? '<a class="btn btn-ghost" target="_blank" rel="noopener" href="hostel.html?id=' + esc(h.id) + '">' + icon('eye') + 'See public page</a>' : '') +
      '<a class="btn btn-ghost" href="#hostels">Back to list</a></div></div>' +
      '<div class="etabs">' +
        '<a class="' + (tab === 'details' ? 'on' : '') + '" href="' + (h ? base + '/details' : '#hostel/new') + '">Details</a>' +
        '<a class="' + (tab === 'rooms' ? 'on' : '') + (h ? '' : ' off') + '" href="' + base + '/rooms">Rooms &amp; prices' + (h ? ' (' + h.rooms.length + ')' : '') + '</a>' +
        '<a class="' + (tab === 'photos' ? 'on' : '') + (h ? '' : ' off') + '" href="' + base + '/photos">Photos' + (h ? ' (' + h.images.length + ')' : '') + '</a>' +
      '</div><div id="tabBody"></div>';

    const body = $('#tabBody');
    if (tab === 'rooms' && h) roomsTab(body, h);
    else if (tab === 'photos' && h) photosTab(body, h);
    else detailsTab(body, h);
  }

  // — details —
  function detailsTab(body, h) {
    const v = h
      ? hostelBody(h)
      : { name: '', description: '', area: '', address: '', distance_km: '', phone: me.phone || '', whatsapp: '', gender: 'mixed', amenities: [], status: 'published' };
    const areas = (meta.areas || []).map((a) => '<option value="' + esc(a) + '">').join('');

    body.innerHTML =
      '<form class="panel" id="hForm" novalidate><div class="form-grid">' +
        field('Hostel name', '<input id="fName" type="text" maxlength="80" value="' + esc(v.name) + '" required>') +
        field('Area or town', '<input id="fArea" type="text" list="areaList" maxlength="60" value="' + esc(v.area) + '" required><datalist id="areaList">' + areas + '</datalist>', 'Where the hostel is, e.g. the trading centre or village.') +
        field('Distance from campus (km)', '<input id="fDist" type="number" step="0.1" min="0" max="100" inputmode="decimal" value="' + esc(v.distance_km) + '">', 'Roughly, to the main gate. Students filter by this.') +
        field('Who it is for', '<select id="fGender">' + meta.genders.map((g) => '<option value="' + esc(g.value) + '"' + (g.value === v.gender ? ' selected' : '') + '>' + esc(g.label) + '</option>').join('') + '</select>') +
        field('Phone number', '<input id="fPhone" type="tel" value="' + esc(v.phone ? localPhone(v.phone) : '') + '" placeholder="0772 123 456" required>', 'Shown on your page, with a Call button.') +
        field('WhatsApp number', '<input id="fWa" type="tel" value="' + esc(v.whatsapp ? localPhone(v.whatsapp) : '') + '" placeholder="Leave empty if it is the same">', 'Students message this number.') +
        '<div class="field span2"><label for="fAddr">Directions or address</label><input id="fAddr" type="text" maxlength="160" value="' + esc(v.address) + '" placeholder="e.g. 200 m past the market, opposite the clinic"></div>' +
        '<div class="field span2"><label for="fDesc">About the hostel</label><textarea id="fDesc" maxlength="2000" placeholder="Rules, security, water and power, what makes it a good place to stay…">' + esc(v.description) + '</textarea></div>' +
        '<div class="field span2"><span class="f-label">Amenities</span><div class="checks" id="fAmen">' +
          meta.amenities.map((a) => '<label class="check"><input type="checkbox" value="' + esc(a) + '"' + (v.amenities.includes(a) ? ' checked' : '') + '><span>' + esc(a) + '</span></label>').join('') +
        '</div></div>' +
        '<div class="field span2"><label class="check"><input type="checkbox" id="fLive"' + (v.status === 'published' ? ' checked' : '') + '><span>Visible to students</span></label><span class="hint">Untick to hide the hostel without deleting it.</span></div>' +
      '</div><div class="form-err" id="hErr" role="alert" style="margin-top:14px"></div>' +
      '<div class="form-foot"><button class="btn btn-solid" type="submit" id="hSave">' + (h ? 'Save changes' : 'Create hostel') + '</button>' +
      (h ? '' : '<span class="muted">You will add rooms and photos next.</span>') + '</div></form>';

    $('#hForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#hErr');
      err.textContent = '';
      if (!guard()) return;
      const payload = {
        name: $('#fName').value, area: $('#fArea').value, distance_km: $('#fDist').value, gender: $('#fGender').value,
        phone: $('#fPhone').value, whatsapp: $('#fWa').value, address: $('#fAddr').value, description: $('#fDesc').value,
        amenities: $$('#fAmen input:checked').map((i) => i.value), status: $('#fLive').checked ? 'published' : 'hidden',
      };
      await busy($('#hSave'), 'Saving…', async () => {
        try {
          if (h) {
            await api('/owner/hostels/' + h.id, { method: 'PUT', body: payload });
            toast('Saved', 'ok');
            viewEditor(h.id, 'details');
          } else {
            const r = await api('/owner/hostels', { method: 'POST', body: payload });
            toast('Hostel created. Now add your rooms.', 'ok');
            location.hash = '#hostel/' + r.hostel.id + '/rooms';
          }
        } catch (ex) {
          err.textContent = ex.message;
        }
      });
    });
  }

  function field(label, input, hint) {
    return '<div class="field"><label>' + esc(label) + '</label>' + input + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }

  // — rooms —
  function roomsTab(body, h) {
    const typeLabel = (t) => (meta.roomTypes.find((x) => x.value === t) || { label: t }).label;
    let editing = null;

    function paint() {
      const r = editing || { type: 'single', name: '', price: '', available: 1, description: '' };
      body.innerHTML =
        '<div class="panel"><h2>Rooms and prices</h2>' +
        (h.rooms.length
          ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Room</th><th>Type</th><th class="num">Per semester</th><th class="num">Available</th><th></th></tr></thead><tbody>' +
            h.rooms.map((x) =>
              '<tr><td class="cell-main">' + esc(x.name) + (x.description ? '<div class="cell-sub">' + esc(x.description) + '</div>' : '') + '</td><td>' + esc(typeLabel(x.type)) + '</td>' +
              '<td class="num">' + esc(fmtMoney(x.price)) + '</td><td class="num">' + x.available + '</td>' +
              '<td><div class="row-acts"><button class="btn-icon" data-edit="' + esc(x.id) + '" aria-label="Edit ' + esc(x.name) + '">' + icon('edit') + '</button>' +
              '<button class="btn-icon" data-del="' + esc(x.id) + '" aria-label="Delete ' + esc(x.name) + '">' + icon('trash') + '</button></div></td></tr>').join('') +
            '</tbody></table></div>'
          : '<p class="muted">No rooms yet. Add each room type you rent out, with its price per semester.</p>') +
        '</div>' +
        '<form class="panel" id="rForm" novalidate><h2>' + (editing ? 'Edit room' : 'Add a room') + '</h2><div class="form-grid">' +
          field('Room type', '<select id="rType">' + meta.roomTypes.map((t) => '<option value="' + esc(t.value) + '"' + (t.value === r.type ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select>') +
          field('Label (optional)', '<input id="rName" type="text" maxlength="80" value="' + esc(editing ? r.name : '') + '" placeholder="e.g. Single room, upstairs">') +
          field('Price per semester (UGX)', '<input id="rPrice" type="number" min="0" step="1000" inputmode="numeric" value="' + esc(r.price) + '" required>') +
          field('Rooms available now', '<input id="rAvail" type="number" min="0" max="999" inputmode="numeric" value="' + esc(r.available) + '">', 'Put 0 when this type is full.') +
          '<div class="field span2"><label for="rDesc">Note (optional)</label><input id="rDesc" type="text" maxlength="200" value="' + esc(r.description || '') + '" placeholder="e.g. own bathroom, balcony, bed and mattress included"></div>' +
        '</div><div class="form-err" id="rErr" role="alert" style="margin-top:14px"></div>' +
        '<div class="form-foot"><button class="btn btn-solid" type="submit" id="rSave">' + (editing ? 'Save room' : 'Add room') + '</button>' +
        (editing ? '<button class="btn btn-ghost" type="button" id="rCancel">Cancel</button>' : '') + '</div></form>';

      $('#rForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const err = $('#rErr');
        err.textContent = '';
        if (!guard()) return;
        const payload = { type: $('#rType').value, name: $('#rName').value, price: $('#rPrice').value, available: $('#rAvail').value, description: $('#rDesc').value };
        await busy($('#rSave'), 'Saving…', async () => {
          try {
            if (editing) await api('/owner/rooms/' + editing.id, { method: 'PUT', body: payload });
            else await api('/owner/hostels/' + h.id + '/rooms', { method: 'POST', body: payload });
            toast(editing ? 'Room updated' : 'Room added', 'ok');
            h = (await api('/owner/hostels/' + h.id)).hostel;
            editing = null;
            paint();
          } catch (ex) {
            err.textContent = ex.message;
          }
        });
      });
      const cancel = $('#rCancel');
      if (cancel) cancel.addEventListener('click', () => { editing = null; paint(); });
    }

    body.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-del]');
      if (ed) {
        editing = h.rooms.find((x) => x.id === ed.dataset.edit) || null;
        paint();
        $('#rForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (del) {
        if (!guard()) return;
        const room = h.rooms.find((x) => x.id === del.dataset.del);
        if (!room) return;
        if (!(await confirmBox({ title: 'Delete this room?', text: room.name + ' will be removed from your page.', ok: 'Delete room', danger: true }))) return;
        try {
          await api('/owner/rooms/' + room.id, { method: 'DELETE' });
          toast('Room deleted', 'ok');
          h = (await api('/owner/hostels/' + h.id)).hostel;
          editing = null;
          paint();
        } catch (ex) {
          toast(ex.message, 'err');
        }
      }
    });
    paint();
  }

  // — photos —
  async function shrink(file, max, quality) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(file.name + ' is not a JPG, PNG or WebP photo.');
    let bmp;
    if (window.createImageBitmap) bmp = await createImageBitmap(file);
    else {
      bmp = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('Could not read ' + file.name));
        im.src = URL.createObjectURL(file);
      });
    }
    const w0 = bmp.width || bmp.naturalWidth;
    const h0 = bmp.height || bmp.naturalHeight;
    const scale = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * scale);
    c.height = Math.round(h0 * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not prepare ' + file.name);
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  }

  function photosTab(body, h) {
    function paint() {
      body.innerHTML =
        '<div class="panel"><div class="ph2"><h2>Photos</h2><span class="muted">' + h.images.length + ' of ' + MAX_PHOTOS + '</span></div>' +
        '<label class="dropzone" id="drop" for="pFiles">' + icon('camera') + '<strong>Add photos</strong><span class="muted">Tap to choose, or drop them here. JPG, PNG or WebP. They are shrunk automatically to save your data.</span></label>' +
        '<input id="pFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden>' +
        '<div class="muted" id="upStatus" style="margin-top:10px;min-height:1.4em"></div>' +
        (h.images.length
          ? '<div class="photos">' + h.images.map((im) =>
              '<div class="photo"><div class="img"><img src="' + esc(im.url) + '" alt=""></div>' + (im.is_cover ? '<span class="cover-tag">Cover</span>' : '') +
              '<div class="bar">' + (im.is_cover ? '<span class="muted">Shown first</span>' : '<button class="link" data-cover="' + esc(im.id) + '">Make cover</button>') +
              '<button class="btn-icon" data-rm="' + esc(im.id) + '" aria-label="Delete photo">' + icon('trash') + '</button></div></div>').join('') + '</div>'
          : '<p class="muted" style="margin-top:18px">No photos yet. Hostels with clear photos of the room, bathroom and compound get far more messages.</p>') +
        '</div>';

      const input = $('#pFiles');
      input.addEventListener('change', () => upload(input.files));
      const drop = $('#drop');
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
      drop.addEventListener('drop', (e) => upload(e.dataTransfer.files));
    }

    async function reload() {
      h = (await api('/owner/hostels/' + h.id)).hostel;
      paint();
    }

    async function upload(fileList) {
      const files = [...fileList];
      if (!files.length) return;
      if (!guard()) return;
      if (h.images.length + files.length > MAX_PHOTOS) return toast('A hostel can have up to ' + MAX_PHOTOS + ' photos.', 'err');
      const status = $('#upStatus');
      try {
        for (let i = 0; i < files.length; i += 3) {
          const slice = files.slice(i, i + 3);
          status.textContent = 'Uploading ' + Math.min(i + 3, files.length) + ' of ' + files.length + '…';
          const small = [];
          for (const f of slice) small.push(await shrink(f, 1600, 0.82));
          const fd = new FormData();
          small.forEach((f) => fd.append('images', f, f.name));
          await api('/owner/hostels/' + h.id + '/images', { method: 'POST', form: fd });
        }
        toast(files.length === 1 ? 'Photo added' : files.length + ' photos added', 'ok');
      } catch (ex) {
        toast(ex.message, 'err');
      }
      await reload();
    }

    body.addEventListener('click', async (e) => {
      const cv = e.target.closest('[data-cover]');
      const rm = e.target.closest('[data-rm]');
      if (cv) {
        if (!guard()) return;
        try {
          await api('/owner/images/' + cv.dataset.cover + '/cover', { method: 'POST' });
          await reload();
        } catch (ex) {
          toast(ex.message, 'err');
        }
      }
      if (rm) {
        if (!guard()) return;
        if (!(await confirmBox({ title: 'Delete this photo?', ok: 'Delete photo', danger: true }))) return;
        try {
          await api('/owner/images/' + rm.dataset.rm, { method: 'DELETE' });
          await reload();
        } catch (ex) {
          toast(ex.message, 'err');
        }
      }
    });
    paint();
  }

  // ───────── account ─────────
  function viewAccount() {
    ++rt;
    main.innerHTML =
      '<div class="dhead"><div><h1>Account</h1><p>Your details and password.</p></div></div>' +
      '<form class="panel" id="aForm" novalidate><h2>Your details</h2><div class="form-grid">' +
        field('Full name', '<input id="aName" type="text" maxlength="80" value="' + esc(me.full_name) + '" required>') +
        field('Phone number', '<input id="aPhone" type="tel" value="' + esc(localPhone(me.phone)) + '" required>') +
        field('Email', '<input type="email" value="' + esc(me.email) + '" disabled>', 'To change your email, ask the admin.') +
        field('Account status', '<input type="text" value="' + esc(me.status === 'approved' ? 'Approved' : 'Waiting for approval') + '" disabled>') +
      '</div><div class="form-err" id="aErr" role="alert" style="margin-top:14px"></div><div class="form-foot"><button class="btn btn-solid" type="submit" id="aSave">Save details</button></div></form>' +
      '<form class="panel" id="pForm" novalidate><h2>Change password</h2><div class="form-grid">' +
        field('Current password', '<input id="pOld" type="password" autocomplete="current-password" required>') +
        field('New password', '<input id="pNew" type="password" autocomplete="new-password" minlength="8" required>', 'At least 8 characters.') +
      '</div><div class="form-err" id="pErr" role="alert" style="margin-top:14px"></div><div class="form-foot"><button class="btn btn-solid" type="submit" id="pSave">Change password</button></div></form>';

    $('#aForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#aErr').textContent = '';
      await busy($('#aSave'), 'Saving…', async () => {
        try {
          const r = await api('/auth/me', { method: 'PATCH', body: { full_name: $('#aName').value, phone: $('#aPhone').value } });
          me = r.profile;
          BU.session.set(Object.assign({}, BU.session.get(), { profile: me }));
          paintWho();
          toast('Details saved', 'ok');
        } catch (ex) {
          $('#aErr').textContent = ex.message;
        }
      });
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
