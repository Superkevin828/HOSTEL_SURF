import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../lib/icons';
import { api, homeFor, session as sessionStore, shrinkImage } from '../lib/api';
import { CAMPUSES, initials } from '../lib/format';

const perks = [
  'Free to list, with photos and room prices',
  'A WhatsApp and call button on every page',
  'See how many students view and contact you',
];

export default function Auth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isAuthenticated, login, register, setProfile } = useAuth();
  const [tab, setTab] = useState(searchParams.get('tab') === 'register' ? 'up' : 'in');
  const [campuses, setCampuses] = useState(CAMPUSES);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState({ in: '', step2: '', step3: '' });
  const [signIn, setSignIn] = useState({ email: '', password: '' });
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    accepted_policies: false,
    business_name: '',
    campus: '',
    location: '',
    address: '',
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  useEffect(() => {
    if (!isAuthenticated || !profile || !sessionStore.get()?.access_token) return;
    const next = searchParams.get('next') || '';
    if (/^\/(owner|admin)/.test(next)) {
      const wantsAdmin = next.startsWith('/admin');
      navigate(wantsAdmin === (profile.role === 'admin') ? next : homeFor(profile.role), { replace: true });
      return;
    }
    navigate(homeFor(profile.role), { replace: true });
  }, [isAuthenticated, profile, navigate, searchParams]);

  useEffect(() => {
    api('/meta', { auth: false })
      .then((meta) => meta.campuses && meta.campuses.length && setCampuses(meta.campuses))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTab(searchParams.get('tab') === 'register' ? 'up' : 'in');
  }, [searchParams]);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setStep(1);
    setError({ in: '', step2: '', step3: '' });
    setSearchParams(nextTab === 'up' ? { tab: 'register' } : {}, { replace: true });
    document.title = `${nextTab === 'up' ? 'List your hostel' : 'Sign in'} \u2013 BUhostels`;
  };

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submitSignIn = async (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, in: '' }));
    if (!signIn.email.trim() || !signIn.password) {
      setError((current) => ({ ...current, in: 'Enter your email and password.' }));
      return;
    }
    setBusy(true);
    try {
      const nextProfile = await login(signIn.email.trim(), signIn.password);
      const next = searchParams.get('next') || '';
      if (/^\/(owner|admin)/.test(next)) {
        const wantsAdmin = next.startsWith('/admin');
        navigate(wantsAdmin === (nextProfile.role === 'admin') ? next : homeFor(nextProfile.role));
      } else navigate(homeFor(nextProfile.role));
    } catch (err) {
      setError((current) => ({ ...current, in: err.message }));
    } finally {
      setBusy(false);
    }
  };

  const submitStep2 = (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, step2: '' }));
    if (!form.full_name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError((current) => ({ ...current, step2: 'Fill in your name, phone number and email.' }));
      return;
    }
    if (form.password.length < 8) {
      setError((current) => ({ ...current, step2: 'The password needs at least 8 characters.' }));
      return;
    }
    setStep(3);
  };

  const submitStep3 = async (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, step3: '' }));
    if (!form.business_name.trim() || !form.campus || !form.location.trim()) {
      setError((current) => ({
        ...current,
        step3: 'Add your hostel name, the campus it is near, and the area or town.',
      }));
      return;
    }
    if (!form.accepted_policies) {
      setError((current) => ({
        ...current,
        step3: 'Please agree to the Terms of Use and acknowledge the Privacy Policy before continuing.',
      }));
      return;
    }
    setBusy(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        accepted_policies: true,
        business_name: form.business_name.trim(),
        campus: form.campus,
        location: form.location.trim(),
        address: form.address.trim(),
      });
      if (logoFile) {
        try {
          const small = await shrinkImage(logoFile, 600, 0.85);
          const data = new FormData();
          data.append('avatar', small, small.name);
          const result = await api('/owner/avatar', { method: 'POST', form: data });
          setProfile(result.profile);
        } catch {
          setError((current) => ({ ...current, step3: '' }));
        }
      }
      navigate('/owner');
    } catch (err) {
      if (/email|phone|password|name/i.test(err.message)) {
        setStep(2);
        setError((current) => ({ ...current, step2: err.message }));
      } else {
        setError((current) => ({ ...current, step3: err.message }));
      }
    } finally {
      setBusy(false);
    }
  };

  const pickLogo = (event) => {
    const file = event.target.files && event.target.files[0];
    setLogoFile(file || null);
    setLogoPreview(file ? URL.createObjectURL(file) : '');
  };

  return (
    <div className="auth">
      <section className="auth-side">
        <Link className="mark" to="/">
          <span className="mark-box">BU</span>
          <em>hostels</em>
        </Link>
        <div>
          <h1>Your hostel, in front of every Busitema student.</h1>
          <p>
            Post your rooms, prices and photos once. Students find you by price, area and distance, then reach you
            straight on WhatsApp.
          </p>
          <ul>
            {perks.map((perk) => (
              <li key={perk}>
                <Icon name="check" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>
        <p style={{ fontSize: 14 }}>
          Looking for a room instead?{' '}
          <Link to="/" style={{ textDecoration: 'underline' }}>
            Browse hostels
          </Link>
        </p>
      </section>

      <main className="auth-main">
        <div className="auth-box">
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'in'}
              onClick={() => switchTab('in')}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'up'}
              onClick={() => switchTab('up')}
            >
              List your hostel
            </button>
          </div>

          {tab === 'in' ? (
            <form onSubmit={submitSignIn} noValidate>
              <h2>Welcome back</h2>
              <div className="field">
                <label htmlFor="inEmail">Email</label>
                <input
                  id="inEmail"
                  type="email"
                  autoComplete="username"
                  required
                  value={signIn.email}
                  onChange={(event) => setSignIn((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="inPass">Password</label>
                <input
                  id="inPass"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={signIn.password}
                  onChange={(event) => setSignIn((current) => ({ ...current, password: event.target.value }))}
                />
              </div>
              <div className="form-err" role="alert">
                {error.in}
              </div>
              <button className="btn btn-solid btn-block" type="submit" disabled={busy}>
                {busy ? 'Signing in\u2026' : 'Sign in'}
              </button>
              <p className="muted" style={{ fontSize: 14 }}>
                Forgot your password? Ask the BUhostels admin to reset it for you.
              </p>
            </form>
          ) : (
            <section>
              {step === 1 ? (
                <div className="step">
                  <h2>Do you own or manage a hostel?</h2>
                  <p className="muted">Owner accounts are for people who rent out rooms near Busitema University.</p>
                  <div className="choices">
                    <button className="choice" type="button" onClick={() => setStep(2)}>
                      <strong>Yes, I have a hostel</strong>
                      <span>Create an owner account and list your rooms</span>
                    </button>
                    <Link className="choice" to="/">
                      <strong>No, I am looking for a room</strong>
                      <span>Go back and browse hostels. No account needed</span>
                    </Link>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <form className="step" onSubmit={submitStep2} noValidate>
                  <p className="eyebrow">Step 1 of 2 &middot; About you</p>
                  <h2>Create your account</h2>
                  <div className="field">
                    <label htmlFor="upName">Your full name</label>
                    <input
                      id="upName"
                      type="text"
                      autoComplete="name"
                      required
                      value={form.full_name}
                      onChange={(event) => updateForm('full_name', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="upPhone">Phone number</label>
                    <input
                      id="upPhone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="0772 123 456"
                      required
                      value={form.phone}
                      onChange={(event) => updateForm('phone', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="upEmail">Email</label>
                    <input
                      id="upEmail"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={(event) => updateForm('email', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="upPass">Password</label>
                    <input
                      id="upPass"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={form.password}
                      onChange={(event) => updateForm('password', event.target.value)}
                    />
                    <span className="hint">At least 8 characters.</span>
                  </div>
                  <div className="form-err" role="alert">
                    {error.step2}
                  </div>
                  <div className="step-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button className="btn btn-solid" type="submit">
                      Continue
                    </button>
                  </div>
                </form>
              ) : null}

              {step === 3 ? (
                <form className="step" onSubmit={submitStep3} noValidate>
                  <p className="eyebrow">Step 2 of 2 &middot; Your hostel business</p>
                  <h2>Tell students about it</h2>
                  <div className="notice">
                    The admin checks new accounts before you can post. You can sign in straight away while you wait.
                  </div>
                  <div className="logo-pick">
                    <div
                      className="logo-prev"
                      aria-hidden="true"
                      style={logoPreview ? { backgroundImage: `url(${logoPreview})` } : undefined}
                    >
                      {logoPreview ? '' : initials(form.business_name || form.full_name || 'BU')}
                    </div>
                    <div>
                      <label className="btn btn-ghost btn-sm" htmlFor="upLogo">
                        Add a logo or photo
                      </label>
                      <input
                        id="upLogo"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={pickLogo}
                      />
                      <div className="hint">{logoFile ? logoFile.name : 'Optional. Your business logo or a photo of the hostel.'}</div>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="upBiz">Hostel or business name</label>
                    <input
                      id="upBiz"
                      type="text"
                      maxLength={80}
                      required
                      value={form.business_name}
                      onChange={(event) => updateForm('business_name', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="upCampus">Campus it is closest to</label>
                    <select
                      id="upCampus"
                      required
                      value={form.campus}
                      onChange={(event) => updateForm('campus', event.target.value)}
                    >
                      <option value="">Choose a campus</option>
                      {campuses.map((campus) => (
                        <option key={campus} value={campus}>
                          {campus} campus
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="upLoc">Area or town</label>
                    <input
                      id="upLoc"
                      type="text"
                      maxLength={60}
                      placeholder="e.g. Busitema trading centre"
                      required
                      value={form.location}
                      onChange={(event) => updateForm('location', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="upAddr">Directions (optional)</label>
                    <input
                      id="upAddr"
                      type="text"
                      maxLength={160}
                      placeholder="e.g. 200 m past the market"
                      value={form.address}
                      onChange={(event) => updateForm('address', event.target.value)}
                    />
                  </div>
                  <label className="policy-check">
                    <input
                      type="checkbox"
                      checked={form.accepted_policies}
                      onChange={(event) => updateForm('accepted_policies', event.target.checked)}
                    />
                    <span>
                      I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link> and
                      acknowledge the{' '}
                      <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                  <div className="form-err" role="alert">
                    {error.step3}
                  </div>
                  <div className="step-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => setStep(2)}>
                      Back
                    </button>
                    <button className="btn btn-clay" type="submit" disabled={busy}>
                      {busy ? 'Creating account\u2026' : 'Create account'}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
