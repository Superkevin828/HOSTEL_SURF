/* BUhostels — sign in / owner sign-up. */
(function () {
  'use strict';
  const { icon } = BU;
  const $ = (s) => document.querySelector(s);

  $('#perks').innerHTML = ['Free to list, with photos and room prices', 'A WhatsApp and call button on every page', 'See how many students view and contact you']
    .map((t) => '<li>' + icon('check') + '<span>' + t + '</span></li>')
    .join('');

  // Already signed in? Go straight to the dashboard.
  const existing = BU.session.get();
  if (existing && existing.profile && existing.access_token) {
    location.replace(BU.home(existing.profile.role));
  }

  function tab(which) {
    const up = which === 'up';
    $('#formIn').hidden = up;
    $('#formUp').hidden = !up;
    $('#tabIn').setAttribute('aria-selected', String(!up));
    $('#tabUp').setAttribute('aria-selected', String(up));
    document.title = (up ? 'List your hostel' : 'Sign in') + ' — BUhostels';
  }
  $('#tabIn').addEventListener('click', () => tab('in'));
  $('#tabUp').addEventListener('click', () => tab('up'));
  if (location.hash === '#register') tab('up');

  // Only follow ?next= if it points at one of our own pages.
  function destination(profile) {
    const next = new URLSearchParams(location.search).get('next') || '';
    if (/^(owner|admin)\.html([#?].*)?$/.test(next)) {
      const wantsAdmin = next.startsWith('admin');
      if (wantsAdmin === (profile.role === 'admin')) return next;
    }
    return BU.home(profile.role);
  }

  $('#formIn').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#errIn');
    err.textContent = '';
    const email = $('#inEmail').value.trim();
    const pass = $('#inPass').value;
    if (!email || !pass) {
      err.textContent = 'Enter your email and password.';
      return;
    }
    await BU.busy($('#btnIn'), 'Signing in…', async () => {
      try {
        const profile = await BU.login(email, pass);
        location.href = destination(profile);
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  });

  $('#formUp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#errUp');
    err.textContent = '';
    const fields = {
      full_name: $('#upName').value.trim(),
      phone: $('#upPhone').value.trim(),
      email: $('#upEmail').value.trim(),
      password: $('#upPass').value,
    };
    if (!fields.full_name || !fields.phone || !fields.email || fields.password.length < 8) {
      err.textContent = 'Fill in every field. The password needs at least 8 characters.';
      return;
    }
    await BU.busy($('#btnUp'), 'Creating account…', async () => {
      try {
        await BU.register(fields);
        location.href = 'owner.html';
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  });
})();
