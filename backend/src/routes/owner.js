const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { admin, BUCKET } = require('../supabase');
const { must, httpError } = require('../db');
const { requireAuth, requireRole, requireApproved } = require('../middleware/auth');
const { logEvent } = require('../events');
const cache = require('../cache');
const { isUuid, int, clamp, parseHostel, parseRoom, shapeHostel } = require('../util');

const router = express.Router();
router.use(requireAuth, requireRole('owner'));

const MAX_HOSTELS = 10;
const MAX_PHOTOS = 20;
const SELECT_FULL = '*, rooms(*), hostel_images(*)';

const actorMeta = (req, extra = {}) => ({ actor: req.user.full_name, ...extra });

async function ownHostel(req, id) {
  if (!isUuid(id)) throw httpError(404, 'Hostel not found.');
  const row = must(
    await admin.from('hostels').select(SELECT_FULL).eq('id', id).eq('owner_id', req.user.id).maybeSingle(),
    'own hostel'
  );
  if (!row) throw httpError(404, 'Hostel not found.');
  return row;
}

async function ownRoom(req, roomId) {
  if (!isUuid(roomId)) throw httpError(404, 'Room not found.');
  const room = must(await admin.from('rooms').select('*').eq('id', roomId).maybeSingle(), 'room');
  if (!room) throw httpError(404, 'Room not found.');
  const hostel = await ownHostel(req, room.hostel_id);
  return { room, hostel };
}

// ───────────── overview numbers ─────────────

router.get('/stats', async (req, res) => {
  const days = clamp(int(req.query.days, 30), 1, 90);
  const rows = must(await admin.rpc('owner_stats', { p_owner: req.user.id, p_days: days }), 'owner stats') || [];
  res.json({
    days,
    items: rows.map((r) => ({
      hostel_id: r.hostel_id,
      name: r.name,
      views: Number(r.views),
      whatsapp: Number(r.whatsapp),
      calls: Number(r.calls),
    })),
  });
});

// ───────────── hostels ─────────────

router.get('/hostels', async (req, res) => {
  const rows =
    must(
      await admin.from('hostels').select(SELECT_FULL).eq('owner_id', req.user.id).order('created_at', { ascending: false }),
      'owner hostels'
    ) || [];
  res.json({ items: rows.map(shapeHostel) });
});

router.get('/hostels/:id', async (req, res) => {
  res.json({ hostel: shapeHostel(await ownHostel(req, req.params.id)) });
});

router.post('/hostels', requireApproved, async (req, res) => {
  const values = parseHostel(req.body);
  const count = await admin.from('hostels').select('id', { count: 'exact', head: true }).eq('owner_id', req.user.id);
  if (count.error) must(count, 'count hostels');
  if ((count.count || 0) >= MAX_HOSTELS) throw httpError(400, `You can list up to ${MAX_HOSTELS} hostels.`);

  const row = must(
    await admin.from('hostels').insert({ ...values, owner_id: req.user.id }).select(SELECT_FULL).single(),
    'create hostel'
  );
  cache.bust();
  logEvent('hostel_created', { hostel_id: row.id, actor_id: req.user.id, meta: actorMeta(req, { hostel: row.name }) });
  res.status(201).json({ hostel: shapeHostel(row) });
});

router.put('/hostels/:id', requireApproved, async (req, res) => {
  const existing = await ownHostel(req, req.params.id);
  const values = parseHostel(req.body);
  const row = must(
    await admin.from('hostels').update(values).eq('id', existing.id).select(SELECT_FULL).single(),
    'update hostel'
  );
  cache.bust();
  logEvent('hostel_updated', { hostel_id: row.id, actor_id: req.user.id, meta: actorMeta(req, { hostel: row.name }) });
  res.json({ hostel: shapeHostel(row) });
});

router.delete('/hostels/:id', requireApproved, async (req, res) => {
  const existing = await ownHostel(req, req.params.id);
  const paths = (existing.hostel_images || []).map((i) => i.path);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
  must(await admin.from('hostels').delete().eq('id', existing.id), 'delete hostel');
  cache.bust();
  logEvent('hostel_deleted', { actor_id: req.user.id, meta: actorMeta(req, { hostel: existing.name }) });
  res.status(204).end();
});

// ───────────── rooms ─────────────

router.post('/hostels/:id/rooms', requireApproved, async (req, res) => {
  const hostel = await ownHostel(req, req.params.id);
  if ((hostel.rooms || []).length >= 60) throw httpError(400, 'That is the maximum number of rooms for one hostel.');
  const values = parseRoom(req.body);
  const room = must(await admin.from('rooms').insert({ ...values, hostel_id: hostel.id }).select().single(), 'create room');
  cache.bust();
  logEvent('room_saved', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, room: room.name, action: 'added', price: room.price }),
  });
  res.status(201).json({ room });
});

router.put('/rooms/:roomId', requireApproved, async (req, res) => {
  const { room, hostel } = await ownRoom(req, req.params.roomId);
  const values = parseRoom(req.body);
  const updated = must(await admin.from('rooms').update(values).eq('id', room.id).select().single(), 'update room');
  cache.bust();
  logEvent('room_saved', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, room: updated.name, action: 'updated', price: updated.price }),
  });
  res.json({ room: updated });
});

router.delete('/rooms/:roomId', requireApproved, async (req, res) => {
  const { room, hostel } = await ownRoom(req, req.params.roomId);
  must(await admin.from('rooms').delete().eq('id', room.id), 'delete room');
  cache.bust();
  logEvent('room_deleted', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, room: room.name }),
  });
  res.status(204).end();
});

// ───────────── photos ─────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(httpError(400, 'Only JPG, PNG or WebP photos are allowed.'));
  },
});

router.post('/hostels/:id/images', requireApproved, upload.array('images', 8), async (req, res) => {
  const hostel = await ownHostel(req, req.params.id);
  const files = req.files || [];
  if (!files.length) throw httpError(400, 'Choose at least one photo.');

  const existing = hostel.hostel_images || [];
  if (existing.length + files.length > MAX_PHOTOS) {
    throw httpError(400, `A hostel can have up to ${MAX_PHOTOS} photos.`);
  }

  const rows = [];
  for (const file of files) {
    const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${hostel.id}/${randomUUID()}.${ext}`;
    const up = await admin.storage
      .from(BUCKET)
      .upload(objectPath, file.buffer, { contentType: file.mimetype, cacheControl: '31536000', upsert: false });
    if (up.error) {
      console.error('[photos] upload failed:', up.error.message);
      if (rows.length) await admin.storage.from(BUCKET).remove(rows.map((r) => r.path));
      throw httpError(500, 'The photo upload failed. Please try again.');
    }
    const { data } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
    rows.push({ hostel_id: hostel.id, path: objectPath, url: data.publicUrl, is_cover: false });
  }

  if (!existing.some((i) => i.is_cover)) rows[0].is_cover = true;

  const created = must(await admin.from('hostel_images').insert(rows).select(), 'save photos');
  cache.bust();
  logEvent('photo_added', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, count: created.length }),
  });
  res.status(201).json({ items: created });
});

async function ownImage(req, imageId) {
  if (!isUuid(imageId)) throw httpError(404, 'Photo not found.');
  const image = must(await admin.from('hostel_images').select('*').eq('id', imageId).maybeSingle(), 'image');
  if (!image) throw httpError(404, 'Photo not found.');
  const hostel = await ownHostel(req, image.hostel_id);
  return { image, hostel };
}

router.post('/images/:imageId/cover', requireApproved, async (req, res) => {
  const { image, hostel } = await ownImage(req, req.params.imageId);
  must(await admin.from('hostel_images').update({ is_cover: false }).eq('hostel_id', hostel.id), 'clear cover');
  must(await admin.from('hostel_images').update({ is_cover: true }).eq('id', image.id), 'set cover');
  cache.bust();
  res.status(204).end();
});

router.delete('/images/:imageId', requireApproved, async (req, res) => {
  const { image, hostel } = await ownImage(req, req.params.imageId);
  await admin.storage.from(BUCKET).remove([image.path]);
  must(await admin.from('hostel_images').delete().eq('id', image.id), 'delete photo');

  if (image.is_cover) {
    const next = (hostel.hostel_images || [])
      .filter((i) => i.id !== image.id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    if (next) await admin.from('hostel_images').update({ is_cover: true }).eq('id', next.id);
  }
  cache.bust();
  res.status(204).end();
});

module.exports = router;
