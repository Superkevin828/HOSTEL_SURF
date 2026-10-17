/* BUhostels — single hostel page. */
(function () {
  'use strict';
  const { api, esc, fmtMoney, fmtPhone, waLink, icon, initials, hostelCard, toast } = BU;
  const $ = (s) => document.querySelector(s);
  const app = $('#app');
  const id = new URLSearchParams(location.search).get('id');

  $('#footer').innerHTML = BU.footer();

  if (!id) notFound('That link is missing a hostel.');
  else load();

  function notFound(msg) {
    document.title = 'Hostel not found — BUhostels';
    app.innerHTML =
      '<div class="empty" style="margin:56px 0"><h3>Hostel not found</h3><p>' + esc(msg || 'It may have been removed or hidden by the owner.') +
      '</p><a class="btn btn-solid" href="index.html">Browse all hostels</a></div>';
  }

  async function load() {
    let res;
    try {
      res = await api('/hostels/' + encodeURIComponent(id), { auth: 'optional' });
    } catch (e) {
      return notFound(e.status === 404 ? '' : e.message);
    }
    render(res.hostel, res.related || []);
    if (!sessionStorage.getItem('buh.visited')) {
      sessionStorage.setItem('buh.visited', '1');
      BU.track('visit');
    }
    BU.track('view', { hostel_id: res.hostel.id });
  }

  function availability(r) {
    if (r.available <= 0) return '<span class="avail none">Full</span>';
    if (r.available <= 2) return '<span class="avail low">' + r.available + ' left</span>';
    return '<span class="avail ok">' + r.available + ' available</span>';
  }

  function render(h, related) {
    document.title = h.name + ' — BUhostels';
    const prices = h.rooms.map((r) => r.price);
    const from = prices.length ? Math.min(...prices) : null;
    const tel = '+' + h.phone;
    const waNum = h.whatsapp || h.phone;
    const hidden = h.status !== 'published';

    const tags =
      '<span class="tag">' + esc(BU.genderLabel(h.gender)) + '</span>' +
      (h.featured ? '<span class="tag accent">Featured</span>' : '') +
      (hidden ? '<span class="tag bad">Hidden from visitors</span>' : '');

    const gallery = h.images.length
      ? '<div class="gallery-main" id="gMain" role="button" tabindex="0" aria-label="Open photo viewer"><img id="gImg" src="' + esc(h.images[0].url) + '" alt="' + esc(h.name) + ' photo 1"></div>' +
        (h.images.length > 1
          ? '<div class="thumbs" id="gThumbs">' +
            h.images.map((im, i) => '<button type="button" data-i="' + i + '" aria-label="Show photo ' + (i + 1) + '"' + (i === 0 ? ' aria-current="true"' : '') + '><img src="' + esc(im.url) + '" alt="" loading="lazy"></button>').join('') +
            '</div>'
          : '')
      : '<div class="gallery-main" style="cursor:default"><div class="ph"><span>' + esc(initials(h.name)) + '</span></div></div>';

    const rooms = h.rooms.length
      ? '<div class="rooms">' +
        h.rooms
          .map(
            (r) =>
              '<div class="room"><div><h3>' + esc(r.name) + '</h3><div class="sub">' +
              esc((BU.roomTypeLabel && BU.roomTypeLabel(r.type)) || r.type.replace('_', '-')) +
              (r.description ? ' · ' + esc(r.description) : '') + '</div></div>' +
              '<div class="rp">' + esc(fmtMoney(r.price)) + '<small>per semester</small></div>' +
              '<div class="act">' + availability(r) + '<br><a class="link" style="font-size:14px" data-room="' + esc(r.id) + '" target="_blank" rel="noopener" href="' +
              esc(waLink(waNum, BU.waMessage(h.name, r))) + '">Ask about this room</a></div></div>'
          )
          .join('') +
        '</div>'
      : '<p class="muted">The owner has not listed room prices yet. Message them to ask.</p>';

    const amenities = h.amenities.length
      ? '<ul class="amen">' + h.amenities.map((a) => '<li>' + icon('check') + esc(a) + '</li>').join('') + '</ul>'
      : '';

    app.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Hostels</a> / <a href="index.html?area=' + encodeURIComponent(h.area) + '">' + esc(h.area) + '</a></nav>' +
      '<header class="h-head"><div><p class="eyebrow">' + esc(h.area) + (h.distance_km != null ? ' · ' + esc(h.distance_km) + ' km from campus' : '') + '</p>' +
      '<h1>' + esc(h.name) + '</h1><div class="tags">' + tags + '</div></div>' +
      '<button class="btn btn-ghost btn-sm" id="shareBtn" type="button">' + icon('share') + 'Share</button></header>' +
      '<div class="h-grid"><div>' + gallery +
        '<section class="sec"><h2>Rooms and prices</h2>' + rooms + '</section>' +
        (h.description ? '<section class="sec"><h2>About this hostel</h2><p class="body">' + esc(h.description) + '</p></section>' : '') +
        (amenities ? '<section class="sec"><h2>What is included</h2>' + amenities + '</section>' : '') +
        (h.address ? '<section class="sec"><h2>Where to find it</h2><p class="body">' + esc(h.address) + '</p></section>' : '') +
      '</div>' +
      '<aside><div class="contact-card"><h2>Contact the owner</h2>' +
        (from != null ? '<div class="from-price"><span class="muted">Rooms from</span><strong>' + esc(fmtMoney(from)) + '</strong><span class="muted">per semester</span></div>' : '') +
        (h.contact_name ? '<div><div class="small">Contact person</div><div style="font-weight:650">' + esc(h.contact_name) + '</div></div>' : '') +
        '<div><div class="small">Phone</div><div class="num">' + esc(fmtPhone(h.phone)) + '</div></div>' +
        '<a class="btn btn-clay btn-block" id="waBtn" target="_blank" rel="noopener" href="' + esc(waLink(waNum, BU.waMessage(h.name))) + '">' + icon('chat') + 'Message on WhatsApp</a>' +
        '<a class="btn btn-ghost btn-block" id="callBtn" href="tel:' + esc(tel) + '">' + icon('phone') + 'Call</a>' +
        '<button class="btn btn-ghost btn-block" id="copyBtn" type="button">' + icon('copy') + 'Copy number</button>' +
        '<p class="small">Tell them you found the hostel on BUhostels. Always see the room and agree the price before you pay.</p>' +
      '</div></aside></div>' +
      (related.length ? '<section class="related"><h2>More in ' + esc(h.area) + '</h2><div class="grid" id="relGrid">' + related.map(hostelCard).join('') + '</div></section>' : '');

    // bottom bar for phones
    const bar = $('#ctaBar');
    bar.hidden = false;
    bar.innerHTML =
      '<a class="btn btn-clay" id="waBar" target="_blank" rel="noopener" href="' + esc(waLink(waNum, BU.waMessage(h.name))) + '">' + icon('chat') + 'WhatsApp</a>' +
      '<a class="btn btn-ghost" id="callBar" href="tel:' + esc(tel) + '">' + icon('phone') + 'Call</a>';
    document.body.classList.add('has-cta');

    const wa = () => BU.track('whatsapp', { hostel_id: h.id });
    const call = () => BU.track('call', { hostel_id: h.id });
    ['#waBtn', '#waBar'].forEach((s) => $(s).addEventListener('click', wa));
    ['#callBtn', '#callBar'].forEach((s) => $(s).addEventListener('click', call));
    document.querySelectorAll('[data-room]').forEach((a) => a.addEventListener('click', wa));

    $('#copyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('+' + h.phone);
        toast('Number copied', 'ok');
        call();
      } catch (e) {
        toast('Copy failed. The number is ' + fmtPhone(h.phone), 'err');
      }
    });
    $('#shareBtn').addEventListener('click', async () => {
      const url = location.href;
      if (navigator.share) {
        try {
          await navigator.share({ title: h.name + ' — BUhostels', url });
        } catch (e) {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copied', 'ok');
        } catch (e) {
          toast(url);
        }
      }
    });

    const rel = $('#relGrid');
    if (rel) BU.bindCardTracking(rel);

    setupGallery(h);
  }

  function setupGallery(h) {
    const imgs = h.images;
    if (!imgs.length) return;
    let cur = 0;
    const main = $('#gImg');
    const thumbs = $('#gThumbs');

    function show(i) {
      cur = (i + imgs.length) % imgs.length;
      main.src = imgs[cur].url;
      main.alt = h.name + ' photo ' + (cur + 1);
      if (thumbs) thumbs.querySelectorAll('button').forEach((b, n) => (n === cur ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
    }
    if (thumbs) thumbs.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) show(Number(b.getAttribute('data-i')));
    });

    function lightbox() {
      const d = BU.dialog(
        '<div class="lb-wrap"><img alt=""><button class="lb-btn lb-close" type="button" aria-label="Close">' + icon('close') + '</button>' +
          (imgs.length > 1
            ? '<button class="lb-btn lb-prev" type="button" aria-label="Previous photo">' + icon('left') + '</button><button class="lb-btn lb-next" type="button" aria-label="Next photo">' + icon('right') + '</button>'
            : '') +
          '<span class="lb-count"></span></div>',
        'lightbox'
      );
      const im = d.querySelector('img');
      const count = d.querySelector('.lb-count');
      const paint = () => {
        im.src = imgs[cur].url;
        im.alt = h.name + ' photo ' + (cur + 1);
        count.textContent = cur + 1 + ' / ' + imgs.length;
        show(cur);
      };
      paint();
      d.querySelector('.lb-close').addEventListener('click', () => d.close());
      const prev = d.querySelector('.lb-prev');
      const next = d.querySelector('.lb-next');
      if (prev) prev.addEventListener('click', () => { cur = (cur - 1 + imgs.length) % imgs.length; paint(); });
      if (next) next.addEventListener('click', () => { cur = (cur + 1) % imgs.length; paint(); });
      d.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && prev) prev.click();
        if (e.key === 'ArrowRight' && next) next.click();
      });
    }
    const gm = $('#gMain');
    gm.addEventListener('click', lightbox);
    gm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        lightbox();
      }
    });
  }
})();
