const ENV_BASE = import.meta.env.VITE_API_BASE;
const DEFAULT_BASE = import.meta.env.DEV ? 'http://localhost:4000' : 'https://buhostels-api.onrender.com';

export const API_BASE = String(ENV_BASE || DEFAULT_BASE).replace(/\/+$/, '');
const KEY = 'buh.session';
const SESSION_EVENT = 'buh:session';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const session = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      return null;
    }
  },
  set(value) {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
      window.dispatchEvent(new Event(SESSION_EVENT));
    } catch {
      return null;
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new Event(SESSION_EVENT));
    } catch {
      return null;
    }
  },
};

export function subscribeSession(listener) {
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(SESSION_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

async function send(path, opts = {}) {
  const headers = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: opts.method || 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0, 'NETWORK');
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError((data && data.error) || `Something went wrong (${res.status}).`, res.status, data && data.code);
  }
  return data;
}

let refreshing = null;

export function refreshSession() {
  const current = session.get();
  if (!current || !current.refresh_token) return Promise.reject(new ApiError('Session expired', 401));
  if (!refreshing) {
    refreshing = send('/auth/refresh', { method: 'POST', body: { refresh_token: current.refresh_token } })
      .then((result) => {
        session.set({ ...current, ...result.session });
        return result;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  const options = { ...opts };
  const mode = options.auth === undefined ? true : options.auth;
  delete options.auth;

  let current = session.get();
  if (mode === false || (!current && mode === 'optional')) return send(path, options);
  if (!current) throw new ApiError('Please sign in.', 401);

  if (current.expires_at && current.expires_at * 1000 - Date.now() < 30000) {
    try {
      await refreshSession();
      current = session.get();
    } catch (error) {
      if (mode === 'optional') return send(path, options);
      session.clear();
      throw error;
    }
  }

  try {
    return await send(path, { ...options, token: current.access_token });
  } catch (error) {
    if (error.status !== 401) throw error;
    try {
      await refreshSession();
      current = session.get();
    } catch (refreshError) {
      if (mode === 'optional') return send(path, options);
      session.clear();
      throw refreshError;
    }
    return send(path, { ...options, token: current.access_token });
  }
}

export async function login(email, password) {
  const result = await send('/auth/login', { method: 'POST', body: { email, password } });
  session.set({ ...result.session, profile: result.profile });
  markPending(result.profile);
  return result.profile;
}

export async function register(fields) {
  const result = await send('/auth/register', { method: 'POST', body: fields });
  session.set({ ...result.session, profile: result.profile });
  markPending(result.profile);
  return result.profile;
}

export function logout() {
  session.clear();
}

export function homeFor(role) {
  return role === 'admin' ? '/admin' : '/owner';
}

export function markPending(profile) {
  try {
    if (profile && profile.role === 'owner' && profile.status === 'pending') {
      localStorage.setItem(`buh.pending.${profile.id}`, '1');
    }
  } catch {
    return null;
  }
}

export function takeApprovalNotice(profile) {
  try {
    const key = `buh.pending.${profile.id}`;
    if (profile.role === 'owner' && profile.status === 'approved' && localStorage.getItem(key)) {
      localStorage.removeItem(key);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function visitorId() {
  try {
    let id = localStorage.getItem('buh.vid');
    if (!id) {
      const values = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(values);
      id = Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('buh.vid', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function track(type, extra = {}) {
  try {
    const current = session.get();
    const headers = { 'Content-Type': 'application/json' };
    if (current && current.access_token) headers.Authorization = `Bearer ${current.access_token}`;
    fetch(`${API_BASE}/api/track`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({ type, vid: visitorId(), ...extra }),
    }).catch(() => {});
  } catch {
    return null;
  }
}

export async function shrinkImage(file, max, quality) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error(`${file.name} is not a JPG, PNG or WebP picture.`);
  }
  let bitmap;
  if (window.createImageBitmap) bitmap = await createImageBitmap(file);
  else {
    bitmap = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not read ${file.name}`));
      image.src = URL.createObjectURL(file);
    });
  }
  const width = bitmap.width || bitmap.naturalWidth;
  const height = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error(`Could not prepare ${file.name}`);
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

fetch(`${API_BASE}/api/health`, { cache: 'no-store' }).catch(() => {});
