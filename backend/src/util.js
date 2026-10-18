const { httpError } = require('./db');

const AMENITIES = [
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

// Busitema University campuses. Edit this list if a campus is added or renamed.
const CAMPUSES = ['Busitema', 'Nagongera', 'Arapai', 'Mbale', 'Pallisa', 'Namasagali'];

const ROOM_TYPES = [
  { value: 'single', label: 'Single room' },
  { value: 'double', label: 'Double room' },
  { value: 'triple', label: 'Triple room' },
  { value: 'self_contained', label: 'Self-contained' },
  { value: 'shared', label: 'Shared dormitory' },
];

const GENDERS = [
  { value: 'mixed', label: 'Mixed' },
  { value: 'male', label: 'Men only' },
  { value: 'female', label: 'Women only' },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
const str = (v, max = 200) => (v == null ? '' : String(v)).trim().slice(0, max);
const int = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Stores phone numbers as international digits only (256772123456), which is what wa.me needs.
function normalizePhone(input) {
  if (input == null) return null;
  let d = String(input).replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = '256' + d.slice(1);
  else if (d.length === 9 && d.startsWith('7')) d = '256' + d;
  if (d.startsWith('256')) return d.length === 12 ? d : null;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

function fail(errors) {
  if (errors.length) throw httpError(400, errors[0]);
}

function parseHostel(b = {}) {
  const errors = [];
  const name = str(b.name, 80);
  if (name.length < 3) errors.push('Give the hostel a name (at least 3 letters).');

  const area = str(b.area, 60);
  if (area.length < 2) errors.push('Enter the area or town where the hostel is.');

  const phone = normalizePhone(b.phone);
  if (!phone) errors.push('Enter a valid phone number, for example 0772 123 456.');

  let whatsapp = phone;
  if (str(b.whatsapp)) {
    whatsapp = normalizePhone(b.whatsapp);
    if (!whatsapp) errors.push('The WhatsApp number does not look right.');
  }

  const campus = CAMPUSES.includes(b.campus) ? b.campus : '';
  if (!campus) errors.push('Choose the campus this hostel is near.');

  let latitude = null;
  let longitude = null;
  if (num(b.latitude) != null || num(b.longitude) != null) {
    latitude = num(b.latitude);
    longitude = num(b.longitude);
    if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      errors.push('The map location does not look right. Use the location button again, or clear it.');
    } else {
      latitude = Math.round(latitude * 1e6) / 1e6;
      longitude = Math.round(longitude * 1e6) / 1e6;
    }
  }

  let distance = num(b.distance_km);
  if (distance != null) {
    if (distance < 0 || distance > 100) errors.push('Distance should be between 0 and 100 km.');
    distance = Math.round(distance * 10) / 10;
  }

  const gender = GENDERS.some((g) => g.value === b.gender) ? b.gender : 'mixed';
  const amenities = Array.isArray(b.amenities) ? AMENITIES.filter((a) => b.amenities.includes(a)) : [];
  const status = b.status === 'hidden' ? 'hidden' : 'published';

  fail(errors);
  return {
    name,
    description: str(b.description, 2000) || null,
    area,
    address: str(b.address, 160) || null,
    campus,
    latitude,
    longitude,
    distance_km: distance,
    phone,
    whatsapp,
    gender,
    amenities,
    status,
  };
}

// The business details every owner gives when signing up (and can edit later).
function parseBusiness(b = {}) {
  const errors = [];
  const business_name = str(b.business_name, 80);
  if (business_name.length < 2) errors.push('Enter your hostel or business name.');
  const campus = CAMPUSES.includes(b.campus) ? b.campus : '';
  if (!campus) errors.push('Choose the campus your hostel is closest to.');
  const location = str(b.location, 60);
  if (location.length < 2) errors.push('Enter the area or town where your hostel is.');
  fail(errors);
  return { business_name, campus, location, address: str(b.address, 160) || null };
}

function parseRoom(b = {}) {
  const errors = [];
  const typeDef = ROOM_TYPES.find((t) => t.value === b.type);
  if (!typeDef) errors.push('Choose a room type.');

  const price = num(b.price);
  if (price == null || price < 0 || price > 50000000) errors.push('Enter the price per semester in UGX.');

  const available = b.available === '' || b.available == null ? 0 : int(b.available, -1);
  if (available < 0 || available > 999) errors.push('Rooms available should be a number from 0 to 999.');

  fail(errors);
  return {
    name: str(b.name, 80) || typeDef.label,
    type: typeDef.value,
    price: Math.round(price),
    available,
    description: str(b.description, 200) || null,
  };
}

// Hostel row + nested rows → tidy object with sorted rooms and images (cover first).
function shapeHostel(row) {
  const images = [...(row.hostel_images || [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || new Date(a.created_at) - new Date(b.created_at)
  );
  const rooms = [...(row.rooms || [])].sort((a, b) => a.price - b.price);
  const { hostel_images, ...rest } = row;
  return { ...rest, distance_km: row.distance_km == null ? null : Number(row.distance_km), rooms, images };
}

module.exports = {
  AMENITIES,
  CAMPUSES,
  ROOM_TYPES,
  GENDERS,
  EMAIL_RE,
  isUuid,
  str,
  int,
  num,
  clamp,
  normalizePhone,
  parseHostel,
  parseBusiness,
  parseRoom,
  shapeHostel,
};
