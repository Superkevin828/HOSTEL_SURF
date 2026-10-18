/* BUhostels — hostel card + shared public-page chrome. */
(function (w) {
  'use strict';
  const BU = (w.BU = w.BU || {});
  const { esc, fmtMoney, waLink, initials, icon } = BU;

  const GENDER = { mixed: 'Mixed', male: 'Men only', female: 'Women only' };
  BU.genderLabel = (g) => GENDER[g] || 'Mixed';

  const ROOM_TYPES = { single: 'Single room', double: 'Double room', triple: 'Triple room', self_contained: 'Self-contained', shared: 'Shared dormitory' };
  BU.roomTypeLabel = (t) => ROOM_TYPES[t] || t;

  BU.waMessage = (hostelName, room) =>
    room
      ? 'Hello, I found ' + hostelName + ' on BUhostels. I am interested in the ' + room.name + ' (UGX ' + Number(room.price).toLocaleString('en-US') + ' per semester). Is it still available?'
      : 'Hello, I found ' + hostelName + ' on BUhostels. Do you still have rooms available?';

  BU.hostelCard = function (h) {
    const href = 'hostel.html?id=' + encodeURIComponent(h.id);
    const media = h.cover
      ? '<img src="' + esc(h.cover) + '" alt="' + esc(h.name) + '" loading="lazy">'
      : '<div class="ph" aria-hidden="true"><span>' + esc(initials(h.name)) + '</span></div>';
    const full = h.rooms_count > 0 && h.available_total === 0;
    const where = esc(h.area) + (h.distance_km != null ? ' · ' + esc(h.distance_km) + ' km from ' + (h.campus ? esc(h.campus) + ' campus' : 'campus') : '');
    const price =
      h.min_price != null
        ? '<div class="price"><span class="from">From</span><strong>' + esc(fmtMoney(h.min_price)) + '</strong><span class="per">per semester</span></div>'
        : '<div class="price none">Prices not listed yet</div>';
    const extra = (h.amenities || []).slice(0, 3).map(esc).join(' · ');

    return (
      '<article class="hcard">' +
        '<a class="hcard-media" href="' + href + '" tabindex="-1" aria-hidden="true">' + media +
          (h.featured ? '<span class="tag-feat">Featured</span>' : '') +
          (full ? '<span class="tag-full">Full</span>' : '') +
          (h.image_count > 1 ? '<span class="photo-count">' + icon('camera') + h.image_count + '</span>' : '') +
        '</a>' +
        '<div class="hcard-body">' +
          '<h3><a href="' + href + '">' + esc(h.name) + '</a></h3>' +
          '<div class="meta">' + icon('pin') + '<span>' + where + '</span></div>' +
          '<div class="facts"><b>' + esc(BU.genderLabel(h.gender)) + '</b>' +
            (h.rooms_count ? ' · ' + h.rooms_count + (h.rooms_count === 1 ? ' room type' : ' room types') : '') +
            (extra ? '<br>' + extra : '') + '</div>' +
          price +
          '<div class="hcard-actions">' +
            '<a class="btn btn-solid btn-sm" href="' + href + '">View rooms</a>' +
            '<a class="btn btn-wa btn-sm" data-wa="' + esc(h.id) + '" target="_blank" rel="noopener" href="' + esc(waLink(h.whatsapp || h.phone, BU.waMessage(h.name))) + '">' + icon('chat') + 'WhatsApp</a>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  };

  // Count a WhatsApp tap on any card inside `root`.
  BU.bindCardTracking = function (root) {
    root.addEventListener('click', (e) => {
      const a = e.target.closest('[data-wa]');
      if (a) BU.track('whatsapp', { hostel_id: a.getAttribute('data-wa') });
    });
  };

  BU.footer = function () {
    return (
      '<footer class="foot"><div class="wrap">' +
        '<div><a class="mark" href="index.html"><span class="mark-box">BU</span><em>hostels</em></a>' +
        '<p>An independent listing site that helps Busitema University students find a place to stay and reach the owner directly.</p></div>' +
        '<ul><li><a href="index.html#results">Browse hostels</a></li>' +
        '<li><a href="login.html#register">List your hostel</a></li>' +
        '<li><a href="login.html">Owner sign in</a></li></ul>' +
      '</div></footer>'
    );
  };
})(window);
