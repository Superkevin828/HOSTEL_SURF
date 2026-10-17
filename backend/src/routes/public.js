const express = require('express');
const { admin } = require('../supabase');
const { must, httpError } = require('../db');
const { optionalUser } = require('../middleware/auth');
const { logEvent } = require('../events');
const cache = require('../cache');
const { AMENITIES, ROOM_TYPES, GENDERS, str, int, num, clamp, isUuid, shapeHostel } = require('../util');

const router = express.Router();

// ───────────── data loading (cached for a few seconds) ─────────────

async function loadPublished() {
  const hit = cache.get('published');
  if (hit) return hit;

  const [hostelsRes, statsRes] = await Promise.all([
    admin
      .from('hostels')
      .select(
        'id,name,area,address,distance_km,phone,whatsapp,gender,amenities,featured,created_at,' +
          'owner:profiles(status),rooms(id,type,price,available),hostel_images(url,is_cover,created_at)'
      )
      .eq('status', 'published')
      .range(0, 999),
    admin.from('hostel_stats').select('hostel_id,views').range(0, 4999),
  ]);
  const hostels = must(hostelsRes, 'public hostels') || [];
  const stats = must(statsRes, 'hostel stats') || [];
  const viewsById = new Map(stats.map((s) => [s.hostel_id, Number(s.views) || 0]));

  const rows = hostels
    .filter((h) => h.owner && h.owner.status === 'approved')
    .map((h) => {
      const s = shapeHostel(h);
      return {
        id: s.id,
        name: s.name,
        area: s.area,
        address: s.address,
        distance_km: s.distance_km,
        phone: s.phone,
        whatsapp: s.whatsapp || s.phone,
        gender: s.gender,
        amenities: s.amenities || [],
        featured: s.featured,
        created_at: s.created_at,
        rooms: s.rooms.map((r) => ({ type: r.type, price: Number(r.price), available: r.available })),
        cover: s.images[0] ? s.images[0].url : null,
        image_count: s.images.length,
        views: viewsById.get(s.id) || 0,
      };
    });

  const areaMap = new Map();
  rows.forEach((h) => {
    const key = h.area.toLowerCase();
    const entry = areaMap.get(key) || { name: h.area, count: 0 };
    entry.count += 1;
    areaMap.set(key, entry);
  });
  const prices = rows.flatMap((h) => h.rooms.map((r) => r.price));
  const facets = {
    total: rows.length,
    rooms: prices.length,
    areas: [...areaMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    price: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  };

  return cache.set('published', { rows, facets });
}

function toCard(h, shownRooms) {
  const prices = shownRooms.map((r) => r.price);
  return {
    id: h.id,
    name: h.name,
    area: h.area,
    address: h.address,
    distance_km: h.distance_km,
    gender: h.gender,
    amenities: h.amenities,
    featured: h.featured,
    cover: h.cover,
    image_count: h.image_count,
    phone: h.phone,
    whatsapp: h.whatsapp,
    created_at: h.created_at,
    min_price: prices.length ? Math.min(...prices) : null,
    max_price: prices.length ? Math.max(...prices) : null,
    rooms_count: h.rooms.length,
    available_total: h.rooms.reduce((sum, r) => sum + (r.available || 0), 0),
  };
}

const minOf = (rooms) => (rooms.length ? Math.min(...rooms.map((r) => r.price)) : null);

// ───────────── routes ─────────────

router.get('/meta', async (req, res) => {
  let areas = [];
  try {
    areas = (await loadPublished()).facets.areas.map((a) => a.name);
  } catch (e) {
    /* meta still works without areas */
  }
  res.json({ amenities: AMENITIES, roomTypes: ROOM_TYPES, genders: GENDERS, areas });
});

router.get('/hostels', async (req, res) => {
  const { rows, facets } = await loadPublished();

  const q = str(req.query.q, 80).toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const area = str(req.query.area, 60).toLowerCase();
  const gender = GENDERS.some((g) => g.value === req.query.gender) ? req.query.gender : '';
  const type = ROOM_TYPES.some((t) => t.value === req.query.type) ? req.query.type : '';
  const minPrice = num(req.query.minPrice);
  const maxPrice = num(req.query.maxPrice);
  const maxDistance = num(req.query.maxDistance);
  const wanted = str(req.query.amenities, 400)
    .split(',')
    .map((s) => s.trim())
    .filter((a) => AMENITIES.includes(a));
  const sort = str(req.query.sort, 20);
  const page = clamp(int(req.query.page, 1), 1, 500);
  const limit = clamp(int(req.query.limit, 12), 1, 48);

  const roomFilterOn = Boolean(type) || minPrice != null || maxPrice != null;
  const roomOk = (r) =>
    (!type || r.type === type) && (minPrice == null || r.price >= minPrice) && (maxPrice == null || r.price <= maxPrice);

  let list = rows
    .map((h) => ({ h, shown: roomFilterOn ? h.rooms.filter(roomOk) : h.rooms }))
    .filter(({ h, shown }) => {
      if (tokens.length) {
        const hay = `${h.name} ${h.area} ${h.address || ''}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      if (area && h.area.toLowerCase() !== area) return false;
      if (gender && h.gender !== gender) return false;
      if (maxDistance != null && (h.distance_km == null || h.distance_km > maxDistance)) return false;
      if (wanted.length && !wanted.every((a) => h.amenities.includes(a))) return false;
      if (roomFilterOn && shown.length === 0) return false;
      return true;
    });

  const newest = (a, b) => new Date(b.h.created_at) - new Date(a.h.created_at);
  const asc = (x, y) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : x - y);
  const desc = (x, y) => (x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : y - x);

  switch (sort) {
    case 'price_asc':
      list.sort((a, b) => asc(minOf(a.shown), minOf(b.shown)) || newest(a, b));
      break;
    case 'price_desc':
      list.sort((a, b) => desc(minOf(a.shown), minOf(b.shown)) || newest(a, b));
      break;
    case 'distance':
      list.sort((a, b) => asc(a.h.distance_km, b.h.distance_km) || newest(a, b));
      break;
    case 'newest':
      list.sort(newest);
      break;
    case 'popular':
      list.sort((a, b) => b.h.views - a.h.views || newest(a, b));
      break;
    default:
      list.sort((a, b) => Number(b.h.featured) - Number(a.h.featured) || newest(a, b));
  }

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const items = list.slice((page - 1) * limit, page * limit).map(({ h, shown }) => toCard(h, shown));
  res.json({ items, total, page, pages, facets });
});

router.get('/hostels/:id', async (req, res) => {
  if (!isUuid(req.params.id)) throw httpError(404, 'We could not find that hostel.');

  const row = must(
    await admin
      .from('hostels')
      .select('*, owner:profiles(full_name,status), rooms(*), hostel_images(*)')
      .eq('id', req.params.id)
      .maybeSingle(),
    'hostel detail'
  );
  if (!row) throw httpError(404, 'We could not find that hostel.');

  const live = row.status === 'published' && row.owner && row.owner.status === 'approved';
  if (!live) {
    const user = await optionalUser(req);
    const allowed = user && (user.role === 'admin' || user.id === row.owner_id);
    if (!allowed) throw httpError(404, 'We could not find that hostel.');
  }

  const h = shapeHostel(row);
  const { rows } = await loadPublished();
  const related = rows
    .filter((r) => r.id !== h.id && r.area.toLowerCase() === h.area.toLowerCase())
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 3)
    .map((r) => toCard(r, r.rooms));

  res.json({
    hostel: {
      id: h.id,
      name: h.name,
      description: h.description,
      area: h.area,
      address: h.address,
      distance_km: h.distance_km,
      phone: h.phone,
      whatsapp: h.whatsapp || h.phone,
      gender: h.gender,
      amenities: h.amenities || [],
      status: h.status,
      featured: h.featured,
      contact_name: row.owner ? row.owner.full_name : null,
      rooms: h.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        price: Number(r.price),
        available: r.available,
        description: r.description,
      })),
      images: h.images.map((i) => ({ id: i.id, url: i.url, is_cover: i.is_cover })),
    },
    related,
  });
});

// Anonymous usage tracking: what visitors do on the site (feeds the admin dashboard).
const TRACK_TYPES = ['visit', 'view', 'whatsapp', 'call', 'search'];

router.post('/track', async (req, res) => {
  const b = req.body || {};
  if (!TRACK_TYPES.includes(b.type)) return res.status(204).end();

  const vid = str(b.vid, 40).replace(/[^a-zA-Z0-9_-]/g, '');
  const meta = { vid };

  if (b.type === 'search') {
    meta.q = str(b.q, 80).toLowerCase();
    if (!meta.q) return res.status(204).end();
    logEvent('search', { meta });
    return res.status(204).end();
  }

  if (b.type === 'visit') {
    logEvent('visit', { meta });
    return res.status(204).end();
  }

  if (!isUuid(b.hostel_id)) return res.status(204).end();
  const hostel = must(
    await admin.from('hostels').select('id,name,owner_id').eq('id', b.hostel_id).maybeSingle(),
    'track hostel'
  );
  if (!hostel) return res.status(204).end();

  // Don't count the owner or the admin looking at their own pages.
  const user = await optionalUser(req);
  if (user && (user.role === 'admin' || user.id === hostel.owner_id)) return res.status(204).end();

  meta.hostel = hostel.name;
  logEvent(b.type, { hostel_id: hostel.id, meta });
  res.status(204).end();
});

module.exports = router;
