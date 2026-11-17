const { Resend } = require('resend');

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not configured; email was not sent.');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'BUhostels <onboarding@resend.dev>',
      to: [to],
      subject: subject.replace(/[\r\n]+/g, ' '),
      html,
    });
    if (error) console.error('[email] delivery failed:', error.message);
  } catch (error) {
    console.error('[email] delivery failed:', error.message || error);
  }
}


async function sendOwnerWelcomeEmail(profile) {
  const name = escapeHtml(profile.full_name);
  const businessName = escapeHtml(profile.business_name);
  const approvalMessage = profile.status === 'pending'
    ? 'Your account is waiting for admin approval. We will let you know when you can publish your hostel listings.'
    : 'Your owner account is ready. You can now manage your hostel listings.';

  await sendEmail({
    to: profile.email,
    subject: 'Welcome to BUhostels',
    html: `<h1>Welcome to BUhostels, ${name}!</h1><p>Your owner account for <strong>${businessName}</strong> has been created.</p><p>${approvalMessage}</p>`,
  });
}

async function sendHostelCreatedEmail(profile, hostel) {
  const roomRows = (hostel.rooms || []).map((room) =>
    `<li>${escapeHtml(room.name)} (${escapeHtml(room.type)}): UGX ${Number(room.price || 0).toLocaleString('en-UG')} per semester, ${Number(room.available || 0)} available</li>`
  ).join('');
  const rooms = roomRows ? `<h2>Rooms</h2><ul>${roomRows}</ul>` : '<p>No rooms have been added to this listing yet.</p>';

  await sendEmail({
    to: profile.email,
    subject: `Your hostel listing was uploaded: ${hostel.name}`,
    html: `<h1>Hostel listing uploaded successfully</h1><p>Hello ${escapeHtml(profile.full_name)}, your listing has been saved.</p><ul><li><strong>Name:</strong> ${escapeHtml(hostel.name)}</li><li><strong>Area:</strong> ${escapeHtml(hostel.area)}</li><li><strong>Campus:</strong> ${escapeHtml(hostel.campus)}</li><li><strong>Status:</strong> ${escapeHtml(hostel.status)}</li></ul>${rooms}`,
  });
}

module.exports = { escapeHtml, sendEmail, sendOwnerWelcomeEmail, sendHostelCreatedEmail };