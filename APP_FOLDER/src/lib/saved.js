import { useEffect, useState } from 'react';

const KEY = 'buh.saved';
const EVENT = 'buh:saved';

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function snapshot(hostel) {
  return {
    id: hostel.id,
    name: hostel.name,
    cover: hostel.cover || null,
    area: hostel.area || '',
    campus: hostel.campus || '',
    distance_km: hostel.distance_km ?? null,
    gender: hostel.gender || 'mixed',
    rooms_count: hostel.rooms_count ?? 0,
    min_price: hostel.min_price ?? null,
    amenities: hostel.amenities || [],
    featured: Boolean(hostel.featured),
    image_count: hostel.image_count ?? 0,
    available_total: hostel.available_total ?? null,
    whatsapp: hostel.whatsapp || '',
    phone: hostel.phone || '',
    status: hostel.status || 'published',
  };
}

export function getSaved() {
  return read();
}

export function isSaved(id) {
  return read().some((item) => String(item.id) === String(id));
}

export function toggleSaved(hostel) {
  const list = read();
  const exists = list.some((item) => String(item.id) === String(hostel.id));
  const next = exists
    ? list.filter((item) => String(item.id) !== String(hostel.id))
    : [snapshot(hostel), ...list];
  write(next);
  return !exists;
}

export function clearSaved() {
  write([]);
}

export function subscribeSaved(listener) {
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export function useSavedCount() {
  const [count, setCount] = useState(() => read().length);
  useEffect(() => subscribeSaved(() => setCount(read().length)), []);
  return count;
}

export function useSavedIds() {
  const [ids, setIds] = useState(() => read().map((item) => item.id));
  useEffect(
    () =>
      subscribeSaved(() => {
        setIds(read().map((item) => item.id));
      }),
    []
  );
  return ids;
}
