const { Resend } = require('resend');
const EMAIL_ADDRESS_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmailConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'OWNER_SIGNUP_NOTIFY_EMAIL'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) throw new Error(`Missing production email configuration: ${missing.join(', ')}`);

  if (!EMAIL_ADDRESS_RE.test(process.env.OWNER_SIGNUP_NOTIFY_EMAIL.trim())) {
    throw new Error('OWNER_SIGNUP_NOTIFY_EMAIL must be a valid email address.');
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'BUhostels <onboarding@resend.dev>');

  if (!apiKey || !from) {
    console.error('[email] Email is not configured; message was not sent.');
    return false;
  }
  if (typeof to !== 'string' || !EMAIL_ADDRESS_RE.test(to.trim())) {
    console.error('[email] Message has an invalid recipient; it was not sent.');
    return false;
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to.trim()],
      subject: String(subject || '').replace(/[\r\n]+/g, ' ').trim(),
      html,
      text,
    });
    if (error) {
      console.error('[email] Resend rejected a message:', error.message);
      return false;
    }
    console.info('[email] Resend accepted a message:', data && data.id ? data.id : 'accepted');
    return true;
  } catch (error) {
    console.error('[email] delivery failed:', error.message || error);
    return false;
  }
}


async function sendOwnerWelcomeEmail(profile) {
  const name = escapeHtml(profile.full_name);
  const businessName = escapeHtml(profile.business_name);
  const approvalMessage = profile.status === 'pending'
    ? 'Your account is waiting for admin approval. We will let you know when you can publish your hostel listings.'
    : 'Your owner account is ready. You can now manage your hostel listings.';

  return sendEmail({
    to: profile.email,
    subject: 'Welcome to BUhostels',
    html: `<h1>Welcome to BUhostels, ${name}!</h1><p>Your owner account for <strong>${businessName}</strong> has been created.</p><p>${approvalMessage}</p>`,
    text: `Welcome to BUhostels, ${profile.full_name}!\n\nYour owner account for ${profile.business_name} has been created.\n\n${approvalMessage}`,
  });
}

async function sendOwnerApprovedEmail(profile) {
  const name = escapeHtml(profile.full_name);
  const businessName = escapeHtml(profile.business_name);
  return sendEmail({
    to: profile.email,
    subject: 'Your BUhostels owner account is approved',
    html: `<h1>Your account is approved, ${name}!</h1><p>Your owner account for <strong>${businessName}</strong> has been approved. You can now sign in and publish your hostel listings.</p>`,
    text: `Your account is approved, ${profile.full_name}!\n\nYour owner account for ${profile.business_name} has been approved. You can now sign in and publish your hostel listings.`,
  });
}

async function sendHostelCreatedEmail(profile, hostel) {
  const roomRows = (hostel.rooms || []).map((room) =>
    `<li>${escapeHtml(room.name)} (${escapeHtml(room.type)}): UGX ${Number(room.price || 0).toLocaleString('en-UG')} per semester, ${Number(room.available || 0)} available</li>`
  ).join('');
  const roomText = (hostel.rooms || []).map((room) =>
    `- ${room.name} (${room.type}): UGX ${Number(room.price || 0).toLocaleString('en-UG')} per semester, ${Number(room.available || 0)} available`
  ).join('\n');
  const rooms = roomRows ? `<h2>Rooms</h2><ul>${roomRows}</ul>` : '<p>No rooms have been added to this listing yet.</p>';
  const textRooms = roomText ? `Rooms:\n${roomText}` : 'No rooms have been added to this listing yet.';
  const status = hostel.status === 'published' ? 'Published' : 'Hidden';

  return sendEmail({
    to: profile.email,
    subject: `Your hostel listing was uploaded: ${hostel.name}`,
    html: `<h1>Hostel listing uploaded successfully</h1><p>Hello ${escapeHtml(profile.full_name)}, your listing has been saved.</p><ul><li><strong>Name:</strong> ${escapeHtml(hostel.name)}</li><li><strong>Area:</strong> ${escapeHtml(hostel.area)}</li><li><strong>Campus:</strong> ${escapeHtml(hostel.campus)}</li><li><strong>Status:</strong> ${escapeHtml(hostel.status)}</li></ul>${rooms}`,
    text: `Hostel listing uploaded successfully\n\nHello ${profile.full_name}, your listing has been saved.\n\nName: ${hostel.name}\nArea: ${hostel.area}\nCampus: ${hostel.campus}\nStatus: ${status}\n\n${textRooms}`,
  });
}

module.exports = { escapeHtml, sendEmail, sendOwnerWelcomeEmail, sendOwnerApprovedEmail, sendHostelCreatedEmail, validateEmailConfig };