// Creates (or promotes) the admin account.
//   npm run create-admin -- you@example.com "a-strong-password" "Your Name"
require('dotenv').config({ quiet: true });

const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in backend/.env: ${missing.join(', ')}`);
  process.exit(1);
}

const { admin } = require('../src/supabase');

const [, , email, password, ...nameParts] = process.argv;
const fullName = nameParts.join(' ').trim() || 'Site Admin';

if (!email || !password) {
  console.error('Usage: npm run create-admin -- <email> <password> ["Full Name"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

async function findUserByEmail(mail) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === mail);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

(async () => {
  const mail = email.trim().toLowerCase();
  let user;

  const created = await admin.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created.error) {
    if (!/already|registered|exists/i.test(created.error.message)) throw created.error;
    user = await findUserByEmail(mail);
    if (!user) throw new Error('That email exists but could not be found.');
    const upd = await admin.auth.admin.updateUserById(user.id, { password });
    if (upd.error) throw upd.error;
    console.log('Account already existed — password updated and promoted to admin.');
  } else {
    user = created.data.user;
    console.log('Account created.');
  }

  const { error } = await admin
    .from('profiles')
    .upsert({ id: user.id, email: mail, full_name: fullName, role: 'admin', status: 'approved' });
  if (error) throw error;

  console.log(`\nAdmin ready: ${mail}\nSign in at /login.html — you will land on the admin dashboard.\n`);
})().catch((e) => {
  console.error('Failed:', e.message || e);
  process.exit(1);
});
