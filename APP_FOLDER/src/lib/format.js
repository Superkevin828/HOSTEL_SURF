export const GENDERS = { mixed: 'Mixed', male: 'Men only', female: 'Women only' };

export const ROOM_TYPES = {
  single: 'Single room',
  double: 'Double room',
  triple: 'Triple room',
  self_contained: 'Self-contained',
  shared: 'Shared dormitory',
};

export const CAMPUSES = ['Busitema', 'Nagongera', 'Arapai', 'Mbale', 'Pallisa', 'Namasagali'];

export const AMENITIES = [
  'WiFi',
  '24/7 water',
  'Hot shower',
  'Security guard',
  'CCTV',
  'Fenced compound',
  'Power backup',
  'Kitchen',
  'Laundry area',
  'Parking',
  'Study room',
  'Furnished',
];

export const genderLabel = (gender) => GENDERS[gender] || 'Mixed';
export const roomTypeLabel = (type) => ROOM_TYPES[type] || type;

export const fmtMoney = (value) => `UGX ${Number(value || 0).toLocaleString('en-US')}`;

export function fmtPhone(value) {
  const digits = String(value || '');
  if (/^256\d{9}$/.test(digits)) return `+256 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return digits ? `+${digits}` : '';
}

export function localPhone(value) {
  const digits = String(value || '');
  if (/^256\d{9}$/.test(digits)) return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return digits ? `+${digits}` : '';
}

export const waLink = (number, text) =>
  `https://wa.me/${String(number || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const waMessage = (hostelName, room) =>
  room
    ? `Hello, I found ${hostelName} on BUhostels. I am interested in the ${room.name} (UGX ${Number(room.price).toLocaleString('en-US')} per semester). Is it still available?`
    : `Hello, I found ${hostelName} on BUhostels. Do you still have rooms available?`;

export function timeAgo(iso) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const fullDate = (iso) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

export function debounce(fn, ms) {
  let timer;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), ms);
  };
}

export const availability = (room) => {
  if (room.available <= 0) return { className: 'none', label: 'Full' };
  if (room.available <= 2) return { className: 'low', label: `${room.available} left` };
  return { className: 'ok', label: `${room.available} available` };
};
