// Email via a free Google Apps Script relay (sends from your Gmail over HTTPS; works on Render free).
// Env: MAIL_RELAY_URL (Apps Script web app URL), MAIL_RELAY_SECRET (same secret as in the script).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME = 'BUhostels';

function validateEmailConfig() {
  const to = String(process.env.OWNER_SIGNUP_NOTIFY_EMAIL || '').trim();
  if (to && !EMAIL_RE.test(to)) throw new Error('OWNER_SIGNUP_NOTIFY_EMAIL must be a valid email address.');
}

const escapeHtml = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function sendEmail({ to, subject, html, text }) {
  const url = String(process.env.MAIL_RELAY_URL || '').trim();
  const secret = String(process.env.MAIL_RELAY_SECRET || '').trim();
  if (!url || !secret) return console.error('[email] MAIL_RELAY_URL / MAIL_RELAY_SECRET not set; message not sent.'), false;
  if (typeof to !== 'string' || !EMAIL_RE.test(to.trim())) return console.error('[email] Invalid recipient; not sent.'), false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, to: to.trim(), subject: String(subject || '').replace(/[\r\n]+/g, ' ').trim(), html, text }),
      signal: AbortSignal.timeout(15000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) return console.error('[email] Relay rejected a message:', out.error || res.status), false;
    console.info('[email] Sent');
    return true;
  } catch (e) {
    console.error('[email] delivery failed:', e.message || e);
    return false;
  }
}

const money = (n) => `UGX ${Number(n || 0).toLocaleString('en-UG')}`;

function sendOwnerWelcomeEmail(p) {
  const msg = p.status === 'pending'
    ? 'Your account is waiting for admin approval. We will let you know when you can publish your hostel listings.'
    : 'Your owner account is ready. You can now manage your hostel listings.';
  return sendEmail({
    to: p.email,
    subject: 'Welcome to BUhostels',
    html: `<h1>Welcome to BUhostels, ${escapeHtml(p.full_name)}!</h1><p>Your owner account for <strong>${escapeHtml(p.business_name)}</strong> has been created.</p><p>${msg}</p>`,
    text: `Welcome to BUhostels, ${p.full_name}!\n\nYour owner account for ${p.business_name} has been created.\n\n${msg}`,
  });
}

function sendOwnerApprovedEmail(p) {
  return sendEmail({
    to: p.email,
    subject: 'Your BUhostels owner account is approved',
    html: `<h1>Your account is approved, ${escapeHtml(p.full_name)}!</h1><p>Your owner account for <strong>${escapeHtml(p.business_name)}</strong> has been approved. You can now sign in and publish your hostel listings.</p>`,
    text: `Your account is approved, ${p.full_name}!\n\nYour owner account for ${p.business_name} has been approved. You can now sign in and publish your hostel listings.`,
  });
}

function sendHostelCreatedEmail(p, h) {
  const rooms = h.rooms || [];
  const line = (r) => `${r.name} (${r.type}): ${money(r.price)} per semester, ${Number(r.available || 0)} available`;
  const html = rooms.length ? `<h2>Rooms</h2><ul>${rooms.map((r) => `<li>${escapeHtml(line(r))}</li>`).join('')}</ul>` : '<p>No rooms have been added to this listing yet.</p>';
  const txt = rooms.length ? `Rooms:\n${rooms.map((r) => `- ${line(r)}`).join('\n')}` : 'No rooms have been added to this listing yet.';
  return sendEmail({
    to: p.email,
    subject: `Your hostel listing was uploaded: ${h.name}`,
    html: `<h1>Hostel listing uploaded successfully</h1><p>Hello ${escapeHtml(p.full_name)}, your listing has been saved.</p><ul><li><strong>Name:</strong> ${escapeHtml(h.name)}</li><li><strong>Area:</strong> ${escapeHtml(h.area)}</li><li><strong>Campus:</strong> ${escapeHtml(h.campus)}</li><li><strong>Status:</strong> ${escapeHtml(h.status)}</li></ul>${html}`,
    text: `Hostel listing uploaded successfully\n\nHello ${p.full_name}, your listing has been saved.\n\nName: ${h.name}\nArea: ${h.area}\nCampus: ${h.campus}\nStatus: ${h.status === 'published' ? 'Published' : 'Hidden'}\n\n${txt}`,
  });
}

function sendHostelLimitEmail(p, limit) {
  const n = Math.max(1, Number(limit) || 1);
  const word = n === 1 ? 'hostel' : 'hostels';
  return sendEmail({
    to: p.email,
    subject: `You can now manage ${n} ${word} on BUhostels`,
    html: `<h1>You can now manage ${n} ${word}, ${escapeHtml(p.full_name)}!</h1><p>Your BUhostels account for <strong>${escapeHtml(p.business_name)}</strong> can now manage up to <strong>${n}</strong> ${word}.</p><p>Sign in, open your dashboard and tap <strong>Add hostel</strong> to create another one.</p>`,
    text: `You can now manage ${n} ${word}, ${p.full_name}!\n\nYour BUhostels account for ${p.business_name} can now manage up to ${n} ${word}.\n\nSign in, open your dashboard and tap Add hostel to create another one.`,
  });
}

module.exports = { escapeHtml, sendEmail, sendOwnerWelcomeEmail, sendOwnerApprovedEmail, sendHostelCreatedEmail, sendHostelLimitEmail, validateEmailConfig };