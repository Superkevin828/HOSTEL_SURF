/* BUhostels — small stroke icon set. */
(function (w) {
  'use strict';
  const P = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 10-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    phone: '<path d="M5 4h4l1.6 4.2-2.3 1.5a11 11 0 005.9 5.9l1.5-2.3L20 15v4a1.5 1.5 0 01-1.6 1.5A15.5 15.5 0 013.5 5.6 1.5 1.5 0 015 4z"/>',
    chat: '<path d="M4.5 5h15a1 1 0 011 1v9a1 1 0 01-1 1H11l-4.5 3.5V16H4.5a1 1 0 01-1-1V6a1 1 0 011-1z"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17z"/><path d="M13.5 8.5l3 3"/>',
    trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    camera: '<path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/>',
    home: '<path d="M4 11l8-6.5 8 6.5M6 9.8V20h12V9.8"/>',
    users: '<circle cx="9" cy="9" r="3.2"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M16 6.2a3 3 0 010 5.6M18.5 14.8c1.6.7 2.7 2.2 3 4.7"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    logout: '<path d="M10 4.5H5v15h5M14 8l4 4-4 4M18 12H9.5"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M5 15V6a1 1 0 011-1h9"/>',
    share: '<circle cx="6.5" cy="12" r="2.2"/><circle cx="17.5" cy="6.5" r="2.2"/><circle cx="17.5" cy="17.5" r="2.2"/><path d="M8.4 10.9l7.2-3.3M8.4 13.1l7.2 3.3"/>',
    star: '<path d="M12 4l2.4 5 5.4.7-4 3.8 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.8 5.4-.7z"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.7-4 3.5-6 7-6s6.3 2 7 6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>',
    key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l3 3"/>',
  };
  w.BU = w.BU || {};
  w.BU.icon = (name) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';
})(window);
