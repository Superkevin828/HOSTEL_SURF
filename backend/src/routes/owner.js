const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const { admin, BUCKET } = require('../supabase');
const { must, httpError } = require('../db');
const { requireAuth, requireRole, requireApproved } = require('../middleware/auth');
const { logEvent } = require('../events');
const { publicProfile } = require('../accounts');
const { sendHostelCreatedEmail, sendEmail, escapeHtml } = require('../email');
const cache = require('../cache');
const { isUuid, str, int, clamp, parseHostel, parseRoom, shapeHostel, shapeRoom } = require('../util');

const router = express.Router();
router.use(requireAuth, requireRole('owner'));

const MAX_PHOTOS = 20;
const ROOM_PHOTOS = 3;
const SELECT_FULL = '*, rooms(*, room_images(*)), hostel_images(*)';

const actorMeta = (req, extra = {}) => ({ actor: req.user.full_name, ...extra });

const hostelLimit = (req) => {
  const n = Number(req.user.max_hostels);
  return Number.isInteger(n) && n >= 1 ? n : 1;
};

async function ownHostels(req) {
  return must(
    await admin.from('hostels').select('id').eq('owner_id', req.user.id),
    'own hostels'
  ) || [];
}

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
  const room = must(await admin.from('rooms').select('*, room_images(*)').eq('id', roomId).maybeSingle(), 'room');
  if (!room) throw httpError(404, 'Room not found.');
  const hostel = await ownHostel(req, room.hostel_id);
  return { room, hostel };
}

// A new or edited room must always carry exactly 3 staged photos owned by this owner.
function parseRoomPhotos(req, input) {
  const list = Array.isArray(input) ? input : [];
  if (list.length !== ROOM_PHOTOS) throw httpError(400, 'Upload 3 photos for this room.');
  const prefix = `rooms/${req.user.id}/`;
  const seen = new Set();
  const photos = [];
  for (const item of list) {
    const path = str(item && item.path, 400);
    const url = str(item && item.url, 600);
    if (!path.startsWith(prefix) || !url || seen.has(path)) throw httpError(400, 'Upload 3 photos for this room.');
    seen.add(path);
    photos.push({ path, url });
  }
  return photos;
}

async function fileExists(path) {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  const { data, error } = await admin.storage.from(BUCKET).list(dir, { limit: 1000, search: name });
  if (error) return false;
  return (data || []).some((f) => f.name === name);
}

async function photosExist(photos) {
  for (const p of photos) {
    if (!(await fileExists(p.path))) return false;
  }
  return true;
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
  const existing = await ownHostels(req);
  const limit = hostelLimit(req);
  if (existing.length >= limit) {
    throw httpError(
      403,
      `Your account can manage ${limit} hostel${limit === 1 ? '' : 's'}. Request access to add more.`,
      'HOSTEL_LIMIT'
    );
  }

  const values = parseHostel(req.body);
  const row = must(
    await admin.from('hostels').insert({ ...values, owner_id: req.user.id }).select(SELECT_FULL).single(),
    'create hostel'
  );
  cache.bust();
  logEvent('hostel_created', { hostel_id: row.id, actor_id: req.user.id, meta: actorMeta(req, { hostel: row.name }) });
  await sendHostelCreatedEmail(req.user, row);
  res.status(201).json({ hostel: shapeHostel(row) });
});

router.post('/request-more-hostels', requireApproved, async (req, res) => {
  const last = req.user.more_hostels_requested_at ? new Date(req.user.more_hostels_requested_at).getTime() : 0;
  if (last && Date.now() - last < 24 * 60 * 60 * 1000) {
    throw httpError(429, 'You already sent a request. We will reply by email.');
  }

  const message = str(req.body && req.body.message, 500);
  const hostels = await ownHostels(req);
  const limit = hostelLimit(req);
  const now = new Date().toISOString();

  must(await admin.from('profiles').update({ more_hostels_requested_at: now }).eq('id', req.user.id), 'request more hostels');
  req.user.more_hostels_requested_at = now;

  const to = String(process.env.OWNER_SIGNUP_NOTIFY_EMAIL || '').trim();
  if (to) {
    await sendEmail({
      to,
      subject: 'Owner asks for more hostels',
      html:
        '<h1>Owner asks for more hostels</h1>' +
        `<p><strong>${escapeHtml(req.user.full_name)}</strong> (${escapeHtml(req.user.email)}) would like to manage more hostels.</p>` +
        '<ul>' +
        `<li><strong>Business:</strong> ${escapeHtml(req.user.business_name || 'Not set')}</li>` +
        `<li><strong>Phone:</strong> ${escapeHtml(req.user.phone || 'Not set')}</li>` +
        `<li><strong>Hostels:</strong> ${hostels.length} of ${limit}</li>` +
        '</ul>' +
        (message ? `<p><strong>Message:</strong><br>${escapeHtml(message)}</p>` : ''),
      text:
        `Owner asks for more hostels\n\n${req.user.full_name} (${req.user.email}) would like to manage more hostels.\n\n` +
        `Business: ${req.user.business_name || 'Not set'}\nPhone: ${req.user.phone || 'Not set'}\nHostels: ${hostels.length} of ${limit}` +
        (message ? `\n\nMessage:\n${message}` : ''),
    });
  }

  logEvent('hostels_requested', {
    actor_id: req.user.id,
    meta: actorMeta(req, { hostels: hostels.length, limit, message }),
  });
  res.json({ ok: true });
});

router.put('/hostels/:id', requireApproved, async (req, res) => {
  const existing = await ownHostel(req, req.params.id);
  const name = existing.name;
  const values = parseHostel({ ...req.body, name });
  values.name = name;
  const row = must(
    await admin.from('hostels').update(values).eq('id', existing.id).select(SELECT_FULL).single(),
    'update hostel'
  );
  cache.bust();
  logEvent('hostel_updated', { hostel_id: row.id, actor_id: req.user.id, meta: actorMeta(req, { hostel: row.name }) });
  res.json({ hostel: shapeHostel(row) });
});

router.delete('/hostels/:id', requireApproved, async (req, res) => {
  await ownHostel(req, req.params.id);
  throw httpError(403, 'Your hostel cannot be deleted. Contact support.');
});

// ───────────── rooms ─────────────

router.post('/hostels/:id/rooms', requireApproved, async (req, res) => {
  const hostel = await ownHostel(req, req.params.id);
  if ((hostel.rooms || []).length >= 60) throw httpError(400, 'That is the maximum number of rooms for one hostel.');
  const photos = parseRoomPhotos(req, req.body && req.body.photos);
  if (!(await photosExist(photos))) throw httpError(400, 'Upload 3 photos for this room.');

  const values = parseRoom(req.body);
  const room = must(await admin.from('rooms').insert({ ...values, hostel_id: hostel.id }).select().single(), 'create room');

  const rows = photos.map((p, i) => ({ room_id: room.id, path: p.path, url: p.url, position: i }));
  const imgs = await admin.from('room_images').insert(rows).select();
  if (imgs.error) {
    console.error('[rooms] room images insert failed:', imgs.error.message);
    await admin.from('rooms').delete().eq('id', room.id);
    throw httpError(500, 'The room could not be saved. Please try again.');
  }

  cache.bust();
  logEvent('room_saved', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, room: room.name, action: 'added', price: room.price }),
  });
  res.status(201).json({ room: shapeRoom({ ...room, room_images: imgs.data }) });
});

router.put('/rooms/:roomId', requireApproved, async (req, res) => {
  const { room, hostel } = await ownRoom(req, req.params.roomId);
  const values = parseRoom(req.body);
  const updated = must(await admin.from('rooms').update(values).eq('id', room.id).select().single(), 'update room');

  let images = room.room_images || [];
  if (req.body && req.body.photos !== undefined) {
    const photos = parseRoomPhotos(req, req.body.photos);
    if (!(await photosExist(photos))) throw httpError(400, 'Upload 3 photos for this room.');

    const rows = photos.map((p, i) => ({ room_id: room.id, path: p.path, url: p.url, position: i }));
    const inserted = await admin.from('room_images').insert(rows).select();
    if (inserted.error) {
      console.error('[rooms] room images replace failed:', inserted.error.message);
      throw httpError(500, 'The room could not be saved. Please try again.');
    }
    if (images.length) {
      const oldIds = images.map((i) => i.id);
      const oldPaths = images.map((i) => i.path);
      must(await admin.from('room_images').delete().in('id', oldIds), 'delete old room images');
      await admin.storage.from(BUCKET).remove(oldPaths);
    }
    images = inserted.data;
  }

  cache.bust();
  logEvent('room_saved', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, { hostel: hostel.name, room: updated.name, action: 'updated', price: updated.price }),
  });
  res.json({ room: shapeRoom({ ...updated, room_images: images }) });
});

router.patch('/rooms/:roomId/booked', requireApproved, async (req, res) => {
  const { room, hostel } = await ownRoom(req, req.params.roomId);
  const booked = req.body && req.body.booked;
  if (typeof booked !== 'boolean') throw httpError(400, 'Choose whether this room is booked.');

  let available = 0;
  if (!booked) {
    available = Number(req.body.available);
    if (!Number.isInteger(available) || available < 1 || available > 999) {
      throw httpError(400, 'Enter how many rooms are available (1 to 999).');
    }
  }

  const updated = must(await admin.from('rooms').update({ available }).eq('id', room.id).select().single(), 'update room');
  cache.bust();
  logEvent('room_saved', {
    hostel_id: hostel.id,
    actor_id: req.user.id,
    meta: actorMeta(req, {
      hostel: hostel.name,
      room: updated.name,
      action: booked ? 'booked' : 'reopened',
      price: updated.price,
    }),
  });
  res.json({ room: shapeRoom({ ...updated, room_images: room.room_images }) });
});

router.delete('/rooms/:roomId', requireApproved, async (req, res) => {
  const { room, hostel } = await ownRoom(req, req.params.roomId);
  const paths = (room.room_images || []).map((i) => i.path);
  if (paths.length) await admin.storage.from(BUCKET).remove(paths);
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

// Staged room photos: upload one photo at a time and get back its path + url.
// No database row is written until the room is saved.
const roomUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(httpError(400, 'Only JPG, PNG or WebP photos are allowed.'));
  },
});

router.post('/room-photos', requireApproved, roomUpload.single('photo'), async (req, res) => {
  const file = req.file;
  if (!file) throw httpError(400, 'Choose a photo.');
  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `rooms/${req.user.id}/${randomUUID()}.${ext}`;
  const up = await admin.storage
    .from(BUCKET)
    .upload(objectPath, file.buffer, { contentType: file.mimetype, cacheControl: '31536000', upsert: false });
  if (up.error) {
    console.error('[room-photos] upload failed:', up.error.message);
    throw httpError(500, 'The photo upload failed. Please try again.');
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  res.status(201).json({ path: objectPath, url: data.publicUrl });
});

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

// ───────────── business logo / profile picture ─────────────

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(httpError(400, 'Only JPG, PNG or WebP pictures are allowed.'));
  },
});

router.post('/avatar', avatarUpload.single('avatar'), async (req, res) => {
  const file = req.file;
  if (!file) throw httpError(400, 'Choose a picture.');
  const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const objectPath = `avatars/${req.user.id}/${randomUUID()}.${ext}`;
  const up = await admin.storage
    .from(BUCKET)
    .upload(objectPath, file.buffer, { contentType: file.mimetype, cacheControl: '31536000', upsert: false });
  if (up.error) {
    console.error('[avatar] upload failed:', up.error.message);
    throw httpError(500, 'The upload failed. Please try again.');
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const updated = must(
    await admin.from('profiles').update({ avatar_url: data.publicUrl, avatar_path: objectPath }).eq('id', req.user.id).select().single(),
    'save avatar'
  );
  if (req.user.avatar_path) await admin.storage.from(BUCKET).remove([req.user.avatar_path]);
  cache.bust();
  res.json({ profile: publicProfile(updated) });
});

router.delete('/avatar', async (req, res) => {
  if (req.user.avatar_path) await admin.storage.from(BUCKET).remove([req.user.avatar_path]);
  const updated = must(
    await admin.from('profiles').update({ avatar_url: null, avatar_path: null }).eq('id', req.user.id).select().single(),
    'remove avatar'
  );
  cache.bust();
  res.json({ profile: publicProfile(updated) });
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
