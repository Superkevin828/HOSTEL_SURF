const express = require('express');
const { admin, BUCKET } = require('../supabase');
const { must, httpError } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { createOwnerAccount } = require('../accounts');
const { logEvent } = require('../events');
const cache = require('../cache');
const { isUuid, int, clamp, str, shapeHostel } = require('../util');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// ───────────── overview ─────────────

router.get('/overview', async (req, res) => {
  const days = clamp(int(req.query.days, 14), 1, 60);
  const stats = must(await admin.rpc('site_stats', { p_days: days }), 'site stats');
  const pending =
    must(
      await admin
        .from('profiles')
        .select('id,full_name,phone,email,business_name,campus,location,created_at')
        .eq('role', 'owner')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10),
      'pending owners'
    ) || [];
  res.json({ days, ...stats, pending });
});

// ───────────── live activity ─────────────

const GROUPS = { visitors: ['visit', 'view', 'search'], contacts: ['whatsapp', 'call'] };

router.get('/activity', async (req, res) => {
  const limit = clamp(int(req.query.limit, 60), 1, 200);
  const since = int(req.query.since, 0);
  const before = int(req.query.before, 0);
  const group = str(req.query.group, 12);

  let q = admin
    .from('events')
    .select('id,type,hostel_id,meta,created_at')
    .order('id', { ascending: false })
    .limit(limit);
  if (since) q = q.gt('id', since);
  if (before) q = q.lt('id', before);
  if (GROUPS[group]) q = q.in('type', GROUPS[group]);
  else if (group === 'owners') q = q.not('type', 'in', '(visit,view,search,whatsapp,call)');

  res.json({ items: must(await q, 'activity') || [] });
});

// ───────────── owners ─────────────

router.get('/owners', async (req, res) => {
  const rows =
    must(
      await admin
        .from('profiles')
        .select('id,email,full_name,phone,status,business_name,campus,location,avatar_url,created_at,hostels(id)')
        .eq('role', 'owner')
        .order('created_at', { ascending: false })
        .range(0, 999),
      'owners'
    ) || [];
  res.json({
    items: rows.map(({ hostels, ...o }) => ({ ...o, hostels_count: (hostels || []).length })),
  });
});

router.post('/owners', async (req, res) => {
  const b = req.body || {};
  const profile = await createOwnerAccount({
    email: b.email,
    password: b.password,
    full_name: b.full_name,
    phone: b.phone,
    business_name: b.business_name,
    campus: b.campus,
    location: b.location,
    address: b.address,
    status: 'approved',
  });
  logEvent('owner_created', { actor_id: req.user.id, meta: { owner: profile.full_name } });
  res.status(201).json({ owner: profile });
});

async function findOwner(id) {
  if (!isUuid(id)) throw httpError(404, 'Owner not found.');
  const owner = must(
    await admin.from('profiles').select('*').eq('id', id).eq('role', 'owner').maybeSingle(),
    'find owner'
  );
  if (!owner) throw httpError(404, 'Owner not found.');
  return owner;
}

router.patch('/owners/:id/status', async (req, res) => {
  const owner = await findOwner(req.params.id);
  const status = req.body && req.body.status;
  if (!['approved', 'suspended', 'pending'].includes(status)) throw httpError(400, 'Choose a valid status.');
  must(await admin.from('profiles').update({ status }).eq('id', owner.id), 'owner status');
  cache.bust();
  const type = status === 'approved' ? 'owner_approved' : status === 'suspended' ? 'owner_suspended' : 'owner_pending';
  logEvent(type, { actor_id: req.user.id, meta: { owner: owner.full_name } });
  res.status(204).end();
});

router.post('/owners/:id/password', async (req, res) => {
  const owner = await findOwner(req.params.id);
  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
  const { error } = await admin.auth.admin.updateUserById(owner.id, { password });
  if (error) {
    console.error('[admin] password reset failed:', error.message);
    throw httpError(500, 'Could not reset the password.');
  }
  res.status(204).end();
});

async function removeHostelFiles(hostelIds) {
  if (!hostelIds.length) return;
  const imgs = must(await admin.from('hostel_images').select('path').in('hostel_id', hostelIds), 'files') || [];
  const paths = imgs.map((i) => i.path);
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

router.delete('/owners/:id', async (req, res) => {
  const owner = await findOwner(req.params.id);
  const hostels = must(await admin.from('hostels').select('id').eq('owner_id', owner.id), 'owner hostels') || [];
  await removeHostelFiles(hostels.map((h) => h.id));
  if (owner.avatar_path) await admin.storage.from(BUCKET).remove([owner.avatar_path]);
  const { error } = await admin.auth.admin.deleteUser(owner.id);
  if (error) {
    console.error('[admin] delete owner failed:', error.message);
    throw httpError(500, 'Could not delete that owner.');
  }
  cache.bust();
  logEvent('owner_deleted', { actor_id: req.user.id, meta: { owner: owner.full_name } });
  res.status(204).end();
});

// ───────────── hostels ─────────────

router.get('/hostels', async (req, res) => {
  const [hostelsRes, statsRes] = await Promise.all([
    admin
      .from('hostels')
      .select('*, owner:profiles(full_name,phone,status), rooms(id,price), hostel_images(id)')
      .order('created_at', { ascending: false })
      .range(0, 999),
    admin.from('hostel_stats').select('hostel_id,views,contacts').range(0, 4999),
  ]);
  const hostels = must(hostelsRes, 'admin hostels') || [];
  const stats = new Map((must(statsRes, 'admin hostel stats') || []).map((s) => [s.hostel_id, s]));

  res.json({
    items: hostels.map((h) => {
      const prices = (h.rooms || []).map((r) => Number(r.price));
      const s = stats.get(h.id);
      return {
        id: h.id,
        name: h.name,
        area: h.area,
        status: h.status,
        featured: h.featured,
        created_at: h.created_at,
        owner: h.owner ? { full_name: h.owner.full_name, phone: h.owner.phone, status: h.owner.status } : null,
        rooms_count: prices.length,
        photos_count: (h.hostel_images || []).length,
        min_price: prices.length ? Math.min(...prices) : null,
        views: s ? Number(s.views) : 0,
        contacts: s ? Number(s.contacts) : 0,
      };
    }),
  });
});

async function findHostel(id) {
  if (!isUuid(id)) throw httpError(404, 'Hostel not found.');
  const row = must(await admin.from('hostels').select('*').eq('id', id).maybeSingle(), 'find hostel');
  if (!row) throw httpError(404, 'Hostel not found.');
  return row;
}

router.patch('/hostels/:id', async (req, res) => {
  const hostel = await findHostel(req.params.id);
  const patch = {};
  if (req.body && ['published', 'hidden'].includes(req.body.status)) patch.status = req.body.status;
  if (req.body && typeof req.body.featured === 'boolean') patch.featured = req.body.featured;
  if (!Object.keys(patch).length) throw httpError(400, 'Nothing to change.');

  must(await admin.from('hostels').update(patch).eq('id', hostel.id), 'admin update hostel');
  cache.bust();
  if (patch.status && patch.status !== hostel.status) {
    logEvent('hostel_status', { hostel_id: hostel.id, actor_id: req.user.id, meta: { hostel: hostel.name, status: patch.status } });
  }
  res.status(204).end();
});

router.delete('/hostels/:id', async (req, res) => {
  const hostel = await findHostel(req.params.id);
  await removeHostelFiles([hostel.id]);
  must(await admin.from('hostels').delete().eq('id', hostel.id), 'admin delete hostel');
  cache.bust();
  logEvent('hostel_deleted', { actor_id: req.user.id, meta: { hostel: hostel.name, by: 'admin' } });
  res.status(204).end();
});

module.exports = router;
