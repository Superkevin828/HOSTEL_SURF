/* BUhostels — sign in / owner sign-up (3 steps: own a hostel? → you → your business). */
(function () {
  'use strict';
  const { icon, esc } = BU;
  const $ = (s) => document.querySelector(s);

  $('#perks').innerHTML = ['Free to list, with photos and room prices', 'A WhatsApp and call button on every page', 'See how many students view and contact you']
    .map((t) => '<li>' + icon('check') + '<span>' + t + '</span></li>')
    .join('');

  // Already signed in? Go straight to the dashboard.
  const existing = BU.session.get();
  if (existing && existing.profile && existing.access_token) {
    location.replace(BU.home(existing.profile.role));
  }

  // campuses come from the server so there is one list to maintain
  const FALLBACK_CAMPUSES = ['Busitema', 'Nagongera', 'Arapai', 'Mbale', 'Pallisa', 'Namasagali'];
  function fillCampuses(list) {
    $('#upCampus').innerHTML =
      '<option value="">Choose a campus</option>' + list.map((c) => '<option value="' + esc(c) + '">' + esc(c) + ' campus</option>').join('');
  }
  fillCampuses(FALLBACK_CAMPUSES);
  BU.api('/meta', { auth: false }).then((m) => m.campuses && m.campuses.length && fillCampuses(m.campuses)).catch(() => {});

  // ───────── tabs ─────────
  function tab(which) {
    const up = which === 'up';
    $('#formIn').hidden = up;
    $('#formUp').hidden = !up;
    $('#tabIn').setAttribute('aria-selected', String(!up));
    $('#tabUp').setAttribute('aria-selected', String(up));
    document.title = (up ? 'List your hostel' : 'Sign in') + ' — BUhostels';
    if (up) step(1);
  }
  $('#tabIn').addEventListener('click', () => tab('in'));
  $('#tabUp').addEventListener('click', () => tab('up'));

  function step(n) {
    $('#step1').hidden = n !== 1;
    $('#step2').hidden = n !== 2;
    $('#step3').hidden = n !== 3;
  }
  if (location.hash === '#register') tab('up');

  $('#ownYes').addEventListener('click', () => step(2));
  $('#back2').addEventListener('click', () => step(1));
  $('#back3').addEventListener('click', () => step(2));

  // ───────── sign in ─────────
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

  // ───────── sign up ─────────
  $('#step2').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#err2');
    err.textContent = '';
    if (!$('#upName').value.trim() || !$('#upPhone').value.trim() || !$('#upEmail').value.trim()) {
      err.textContent = 'Fill in your name, phone number and email.';
      return;
    }
    if ($('#upPass').value.length < 8) {
      err.textContent = 'The password needs at least 8 characters.';
      return;
    }
    step(3);
  });

  let logoFile = null;
  $('#upLogo').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    logoFile = f || null;
    const prev = $('#logoPrev');
    if (!f) {
      prev.textContent = 'BU';
      prev.style.backgroundImage = '';
      $('#logoName').textContent = 'Optional. Your business logo or a photo of the hostel.';
      return;
    }
    prev.textContent = '';
    prev.style.backgroundImage = 'url(' + URL.createObjectURL(f) + ')';
    $('#logoName').textContent = f.name;
  });

  $('#step3').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err3');
    err.textContent = '';
    const fields = {
      full_name: $('#upName').value.trim(),
      phone: $('#upPhone').value.trim(),
      email: $('#upEmail').value.trim(),
      password: $('#upPass').value,
      accepted_policies: $('#upPolicies').checked,
      business_name: $('#upBiz').value.trim(),
      campus: $('#upCampus').value,
      location: $('#upLoc').value.trim(),
      address: $('#upAddr').value.trim(),
    };
    if (!fields.business_name || !fields.campus || !fields.location) {
      err.textContent = 'Add your hostel name, the campus it is near, and the area or town.';
      return;
    }
    if (!fields.accepted_policies) {
      err.textContent = 'Please agree to the Terms of Use and acknowledge the Privacy Policy before continuing.';
      return;
    }
    await BU.busy($('#btnUp'), 'Creating account…', async () => {
      try {
        await BU.register(fields);
      } catch (ex) {
        // account problems (email taken, bad phone…) belong to step 2
        if (/email|phone|password|name/i.test(ex.message)) step(2), ($('#err2').textContent = ex.message);
        else err.textContent = ex.message;
        return;
      }
      if (logoFile) {
        try {
          const small = await BU.shrinkImage(logoFile, 600, 0.85);
          const fd = new FormData();
          fd.append('avatar', small, small.name);
          const r = await BU.api('/owner/avatar', { method: 'POST', form: fd });
          BU.session.set(Object.assign({}, BU.session.get(), { profile: r.profile }));
        } catch (ex) {
          /* the logo is optional; they can add it later from Account */
        }
      }
      location.href = 'owner.html';
    });
  });
})();
