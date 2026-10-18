const express = require('express');
const { admin, authClient } = require('../supabase');
const { must, httpError } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createOwnerAccount, signIn, publicProfile } = require('../accounts');
const { logEvent } = require('../events');
const { str, normalizePhone, EMAIL_RE, parseBusiness } = require('../util');

const router = express.Router();

// Owners sign themselves up; the admin approves them before they can post.
router.post('/register', async (req, res) => {
  const b = req.body || {};
  if (b.accepted_policies !== true) throw httpError(400, 'Please agree to the Terms of Use and acknowledge the Privacy Policy.');
  const profile = await createOwnerAccount({
    email: b.email,
    password: b.password,
    full_name: b.full_name,
    phone: b.phone,
    business_name: b.business_name,
    campus: b.campus,
    location: b.location,
    address: b.address,
    status: 'pending',
    accepted_policies: true,
  });
  logEvent('owner_signup', { actor_id: profile.id, meta: { actor: profile.full_name } });

  const session = await signIn(profile.email, b.password);
  res.status(201).json({ session, profile: publicProfile(profile) });
});

router.post('/login', async (req, res) => {
  const email = str(req.body && req.body.email, 120).toLowerCase();
  const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
  if (!EMAIL_RE.test(email) || !password) throw httpError(400, 'Enter your email and password.');

  const session = await signIn(email, password);
  if (!session) throw httpError(401, 'Wrong email or password.');

  const { data: userData } = await admin.auth.getUser(session.access_token);
  const profile = must(
    await admin.from('profiles').select('*').eq('id', userData.user.id).maybeSingle(),
    'login profile'
  );
  if (!profile) throw httpError(403, 'This account is not set up for BUhostels.');
  if (profile.status === 'suspended') throw httpError(403, 'This account has been suspended. Contact the admin.');

  if (profile.role === 'owner') logEvent('owner_login', { actor_id: profile.id, meta: { actor: profile.full_name } });
  res.json({ session, profile: publicProfile(profile) });
});

router.post('/refresh', async (req, res) => {
  const token = req.body && req.body.refresh_token;
  if (!token || typeof token !== 'string') throw httpError(400, 'Missing refresh token.');
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: token });
  if (error || !data || !data.session) throw httpError(401, 'Your session has expired. Please sign in again.');
  const s = data.session;
  res.json({ session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ profile: publicProfile(req.user) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const name = str(req.body && req.body.full_name, 80);
  const phone = normalizePhone(req.body && req.body.phone);
  if (name.length < 2) throw httpError(400, 'Enter your name.');
  if (!phone) throw httpError(400, 'Enter a valid phone number, for example 0772 123 456.');
  const patch = { full_name: name, phone };
  if (req.user.role === 'owner') Object.assign(patch, parseBusiness(req.body));
  const updated = must(
    await admin.from('profiles').update(patch).eq('id', req.user.id).select().single(),
    'update profile'
  );
  res.json({ profile: publicProfile(updated) });
});

router.post('/password', requireAuth, async (req, res) => {
  const current = req.body && typeof req.body.current === 'string' ? req.body.current : '';
  const next = req.body && typeof req.body.next === 'string' ? req.body.next : '';
  if (next.length < 8) throw httpError(400, 'The new password must be at least 8 characters.');
  const ok = await signIn(req.user.email, current);
  if (!ok) throw httpError(400, 'Your current password is not right.');
  const { error } = await admin.auth.admin.updateUserById(req.user.id, { password: next });
  if (error) {
    console.error('[auth] password update failed:', error.message);
    throw httpError(500, 'Could not change the password. Please try again.');
  }
  res.status(204).end();
});

module.exports = router;
