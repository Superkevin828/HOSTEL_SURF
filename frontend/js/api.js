/* BUhostels — shared client: API calls, session, formatting helpers. */
(function (w) {
  'use strict';
  const BU = (w.BU = w.BU || {});
  const BASE = ((w.BU_CONFIG && w.BU_CONFIG.API_BASE) || '').replace(/\/+$/, '');
  const KEY = 'buh.session';

  // ───────── session ─────────
  const session = {
    get() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    set(v) {
      try {
        localStorage.setItem(KEY, JSON.stringify(v));
      } catch (e) {
        /* private mode: sign-in just won't persist */
      }
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
    },
  };

  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function send(path, opts) {
    const o = opts || {};
    const headers = {};
    if (o.token) headers.Authorization = 'Bearer ' + o.token;
    let body;
    if (o.form) body = o.form;
    else if (o.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.body);
    }
    let res;
    try {
      res = await fetch(BASE + '/api' + path, { method: o.method || 'GET', headers, body });
    } catch (e) {
      throw new ApiError("Can't reach the server. Check your connection and try again.", 0, 'NETWORK');
    }
    if (res.status === 204) return null;
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* non-JSON body */
    }
    if (!res.ok) {
      throw new ApiError((data && data.error) || 'Something went wrong (' + res.status + ').', res.status, data && data.code);
    }
    return data;
  }

  let refreshing = null;
  function refresh() {
    const s = session.get();
    if (!s || !s.refresh_token) return Promise.reject(new ApiError('Session expired', 401));
    if (!refreshing) {
      refreshing = send('/auth/refresh', { method: 'POST', body: { refresh_token: s.refresh_token } })
        .then((r) => {
          session.set(Object.assign({}, s, r.session));
          return r;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  function goLogin() {
    const here = location.pathname.split('/').pop() + location.search + location.hash;
    location.href = 'login.html?next=' + encodeURIComponent(here);
  }

  // auth: true (default) = must be signed in · 'optional' = send token if there is one · false = anonymous
  async function api(path, opts) {
    const o = Object.assign({}, opts);
    const mode = o.auth === undefined ? true : o.auth;
    delete o.auth;

    let s = session.get();
    if (mode === false || (!s && mode === 'optional')) return send(path, o);
    if (!s) {
      goLogin();
      throw new ApiError('Please sign in.', 401);
    }

    if (s.expires_at && s.expires_at * 1000 - Date.now() < 30000) {
      try {
        await refresh();
        s = session.get();
      } catch (e) {
        if (mode === 'optional') return send(path, o);
        session.clear();
        goLogin();
        throw e;
      }
    }

    try {
      return await send(path, Object.assign({}, o, { token: s.access_token }));
    } catch (e) {
      if (e.status !== 401) throw e;
      try {
        await refresh();
        s = session.get();
      } catch (e2) {
        if (mode === 'optional') return send(path, o);
        session.clear();
        goLogin();
        throw e2;
      }
      return send(path, Object.assign({}, o, { token: s.access_token }));
    }
  }

  const home = (role) => (role === 'admin' ? 'admin.html' : 'owner.html');

  async function login(email, password) {
    const r = await send('/auth/login', { method: 'POST', body: { email, password } });
    session.set({ ...r.session, profile: r.profile });
    return r.profile;
  }
  async function register(fields) {
    const r = await send('/auth/register', { method: 'POST', body: fields });
    session.set({ ...r.session, profile: r.profile });
    return r.profile;
  }
  function logout() {
    session.clear();
    location.href = 'index.html';
  }
  // Pages that need a signed-in user of a given role call this first.
  async function requireRole(role) {
    const s = session.get();
    if (!s) {
      goLogin();
      return null;
    }
    try {
      const r = await api('/auth/me');
      const next = Object.assign({}, session.get(), { profile: r.profile });
      session.set(next);
      if (r.profile.role !== role) {
        location.replace(home(r.profile.role));
        return null;
      }
      return next;
    } catch (e) {
      if (e.status === 403 || e.status === 401) {
        session.clear();
        goLogin();
      }
      return null;
    }
  }

  // ───────── helpers ─────────
  const esc = (v) =>
    String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtMoney = (n) => 'UGX ' + Number(n).toLocaleString('en-US');

  function fmtPhone(d) {
    d = String(d || '');
    if (/^256\d{9}$/.test(d)) return '+256 ' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
    return d ? '+' + d : '';
  }
  function localPhone(d) {
    d = String(d || '');
    if (/^256\d{9}$/.test(d)) return '0' + d.slice(3, 6) + ' ' + d.slice(6, 9) + ' ' + d.slice(9);
    return d ? '+' + d : '';
  }
  const waLink = (num, text) => 'https://wa.me/' + String(num || '').replace(/\D/g, '') + (text ? '?text=' + encodeURIComponent(text) : '');

  function timeAgo(iso) {
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const fullDate = (iso) =>
    new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const initials = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');

  // Anonymous visitor id (random, stored in the browser) so the admin can count unique visitors.
  function visitorId() {
    try {
      let id = localStorage.getItem('buh.vid');
      if (!id) {
        const a = new Uint8Array(8);
        (w.crypto || w.msCrypto).getRandomValues(a);
        id = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('buh.vid', id);
      }
      return id;
    } catch (e) {
      return 'anon';
    }
  }

  function track(type, extra) {
    try {
      const s = session.get();
      const headers = { 'Content-Type': 'application/json' };
      if (s && s.access_token) headers.Authorization = 'Bearer ' + s.access_token;
      fetch(BASE + '/api/track', {
        method: 'POST',
        headers,
        keepalive: true,
        body: JSON.stringify(Object.assign({ type, vid: visitorId() }, extra || {})),
      }).catch(() => {});
    } catch (e) {}
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  // Shrinks a photo in the browser before upload (saves the owner's mobile data).
  async function shrinkImage(file, max, quality) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(file.name + ' is not a JPG, PNG or WebP picture.');
    let bmp;
    if (w.createImageBitmap) bmp = await createImageBitmap(file);
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

  Object.assign(BU, {
    shrinkImage,
    api, session, ApiError, login, register, logout, requireRole, home,
    esc, fmtMoney, fmtPhone, localPhone, waLink, timeAgo, fullDate, initials, track, debounce,
  });

  // Free hosting sleeps when idle. A quiet ping on load wakes the API while the visitor is still reading.
  if (BASE) fetch(BASE + '/api/health', { cache: 'no-store' }).catch(() => {});

  // Header: show the right links depending on whether someone is signed in.
  document.addEventListener('DOMContentLoaded', () => {
    const slot = document.getElementById('navAuth');
    if (!slot) return;
    const s = session.get();
    if (s && s.profile) {
      slot.innerHTML =
        '<a class="nav-cta" href="' + home(s.profile.role) + '">Dashboard</a>' +
        '<button type="button" id="navOut">Sign out</button>';
      const out = document.getElementById('navOut');
      if (out) out.addEventListener('click', logout);
    }
  });
})(window);
