const { admin } = require('../supabase');

// Reads the Bearer token, verifies it with Supabase Auth, returns the matching profile row.
async function userFromRequest(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data || !data.user) return null;

  const res = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (res.error || !res.data) return null;
  return res.data;
}

async function requireAuth(req, res, next) {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Please sign in again.', code: 'UNAUTHENTICATED' });
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'This account has been suspended. Contact the admin.', code: 'SUSPENDED' });
  }
  req.user = user;
  next();
}

const requireRole = (role) => (req, res, next) =>
  req.user && req.user.role === role ? next() : res.status(403).json({ error: 'Not allowed.', code: 'FORBIDDEN' });

function requireApproved(req, res, next) {
  if (req.user.status === 'approved') return next();
  res.status(403).json({
    error: 'Your account is still waiting for admin approval. You can post as soon as you are approved.',
    code: 'PENDING',
  });
}

module.exports = { optionalUser: userFromRequest, requireAuth, requireRole, requireApproved };
