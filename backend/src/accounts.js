const { admin, authClient } = require('./supabase');
const { httpError } = require('./db');
const { EMAIL_RE, str, normalizePhone, parseBusiness } = require('./util');

// Creates an auth user + owner profile. Used by public sign-up (pending) and admin "add owner" (approved).
async function createOwnerAccount({ email, password, full_name, phone, status = 'pending', ...rest }) {
  const mail = str(email, 120).toLowerCase();
  const name = str(full_name, 80);
  const tel = normalizePhone(phone);

  if (name.length < 2) throw httpError(400, 'Enter the full name.');
  if (!EMAIL_RE.test(mail)) throw httpError(400, 'Enter a valid email address.');
  if (!tel) throw httpError(400, 'Enter a valid phone number, for example 0772 123 456.');
  if (typeof password !== 'string' || password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters.');
  }
  const business = parseBusiness(rest);

  const created = await admin.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) {
      throw httpError(409, 'That email already has an account. Try signing in instead.');
    }
    console.error('[accounts] createUser failed:', created.error.message);
    throw httpError(500, 'Could not create the account. Please try again.');
  }

  const inserted = await admin
    .from('profiles')
    .insert({ id: created.data.user.id, email: mail, full_name: name, phone: tel, role: 'owner', status, ...business })
    .select()
    .single();
  if (inserted.error) {
    console.error('[accounts] profile insert failed:', inserted.error.message);
    await admin.auth.admin.deleteUser(created.data.user.id);
    throw httpError(500, 'Could not create the account. Please try again.');
  }
  return inserted.data;
}

async function signIn(email, password) {
  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error || !data || !data.session) return null;
  const s = data.session;
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at };
}

const publicProfile = (p) => ({
  id: p.id,
  email: p.email,
  full_name: p.full_name,
  phone: p.phone,
  role: p.role,
  status: p.status,
  business_name: p.business_name || null,
  campus: p.campus || null,
  location: p.location || null,
  address: p.address || null,
  avatar_url: p.avatar_url || null,
});

module.exports = { createOwnerAccount, signIn, publicProfile };
