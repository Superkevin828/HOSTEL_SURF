import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useRequireRole } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useToast } from '../context/ToastContext';
import Icon from '../lib/icons';
import { api, shrinkImage, takeApprovalNotice } from '../lib/api';
import {
  AMENITIES,
  CAMPUSES,
  GENDERS,
  ROOM_TYPES,
  fmtMoney,
  initials,
  localPhone,
  roomTypeLabel,
} from '../lib/format';

const MAX_PHOTOS = 20;

const fallbackMeta = {
  amenities: AMENITIES,
  campuses: CAMPUSES,
  roomTypes: Object.entries(ROOM_TYPES).map(([value, label]) => ({ value, label })),
  genders: Object.entries(GENDERS).map(([value, label]) => ({ value, label })),
  areas: [],
};

const hostelBody = (hostel) => ({
  name: hostel.name,
  description: hostel.description || '',
  area: hostel.area,
  address: hostel.address || '',
  distance_km: hostel.distance_km == null ? '' : hostel.distance_km,
  campus: hostel.campus || '',
  latitude: hostel.latitude == null ? '' : hostel.latitude,
  longitude: hostel.longitude == null ? '' : hostel.longitude,
  phone: hostel.phone,
  whatsapp: hostel.whatsapp && hostel.whatsapp !== hostel.phone ? hostel.whatsapp : '',
  gender: hostel.gender,
  amenities: hostel.amenities || [],
  status: hostel.status,
});

export default function Owner() {
  const profile = useRequireRole('owner');
  const { refreshProfile, setProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [me, setMe] = useState(profile);
  const [meta, setMeta] = useState(fallbackMeta);
  const [hostels, setHostels] = useState([]);
  const [hostelsLoading, setHostelsLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add('dashboard');
    return () => document.body.classList.remove('dashboard');
  }, []);

  useEffect(() => {
    setMe(profile);
    if (!profile) return;
    refreshProfile()
      .then((next) => {
        setMe(next);
        if (takeApprovalNotice(next)) toast('You are approved! You can now add and edit your hostels.', 'ok');
      })
      .catch(() => {});
  }, [profile && profile.id, refreshProfile, toast]);

  useEffect(() => {
    api('/meta', { auth: false })
      .then((result) => setMeta({ ...fallbackMeta, ...result }))
      .catch(() => {});
  }, []);

  const refreshHostels = useCallback(async () => {
    try {
      const result = await api('/owner/hostels');
      setHostels(result.items || []);
      return result.items || [];
    } catch (error) {
      toast(error.message, 'err');
      return [];
    } finally {
      setHostelsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (profile) refreshHostels();
  }, [profile, refreshHostels]);

  useEffect(() => {
    if (!me) return undefined;
    const check = async () => {
      if (document.hidden) return;
      if (me.status === 'approved' && !localStorage.getItem(`buh.pending.${me.id}`)) return;
      try {
        const next = await refreshProfile();
        setMe(next);
        if (takeApprovalNotice(next)) toast('You are approved! You can now add and edit your hostels.', 'ok');
      } catch {
        return;
      }
    };
    const timer = setInterval(check, 20000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [me, refreshProfile, toast]);

  const updateMe = useCallback(
    (next) => {
      setMe(next);
      setProfile(next);
    },
    [setProfile]
  );

  const signOut = () => {
    logout();
    navigate('/');
  };

  if (!profile || !me) return <div className="loading">Loading...</div>;

  return (
    <div className="dash">
      <aside className="side">
        <div>
          <Link className="mark" to="/">
            <span className="mark-box">BU</span>
            <em>hostels</em>
          </Link>
          <span className="role">Owner</span>
        </div>
        <nav aria-label="Owner dashboard">
          <NavLink to="/owner" end>
            <Icon name="chart" />
            Overview
          </NavLink>
          <NavLink to="/owner/hostels">
            <Icon name="home" />
            My hostels
          </NavLink>
          <NavLink to="/owner/account">
            <Icon name="user" />
            Account
          </NavLink>
          <Link to="/">
            <Icon name="external" />
            View public site
          </Link>
        </nav>
        <div className="who">
          <div>
            <b>{me.full_name}</b>
            <span>{me.email}</span>
          </div>
          <button type="button" onClick={signOut}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="dmain">
        {me.status !== 'approved' ? (
          <div className="banner">
            <b>Waiting for approval.</b> The admin will approve your account soon. You can look around now, and posting
            unlocks as soon as you are approved.
          </div>
        ) : null}
        <Routes>
          <Route
            index
            element={
              <Overview me={me} hostels={hostels} loading={hostelsLoading} refreshHostels={refreshHostels} toast={toast} />
            }
          />
          <Route
            path="hostels"
            element={
              <HostelList
                me={me}
                hostels={hostels}
                loading={hostelsLoading}
                refreshHostels={refreshHostels}
                toast={toast}
              />
            }
          />
          <Route
            path="hostel/:id/:tab?"
            element={<Editor meta={meta} me={me} refreshHostels={refreshHostels} toast={toast} />}
          />
          <Route
            path="account"
            element={<Account meta={meta} me={me} updateMe={updateMe} toast={toast} />}
          />
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Overview({ me, hostels, loading, refreshHostels, toast }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/owner/stats?days=30')
      .then((result) => {
        if (!cancelled) setStats(result.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    refreshHostels();
    return () => {
      cancelled = true;
    };
  }, [refreshHostels]);

  if (loading && !stats) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <div className="panel">
        <h2>Something went wrong</h2>
        <p className="muted">{error}</p>
      </div>
    );
  }

  const items = stats || [];
  const totals = items.reduce(
    (sum, row) => ({
      views: sum.views + row.views,
      whatsapp: sum.whatsapp + row.whatsapp,
      calls: sum.calls + row.calls,
    }),
    { views: 0, whatsapp: 0, calls: 0 }
  );
  const roomCount = hostels.reduce((count, hostel) => count + hostel.rooms.length, 0);
  const todo = [];
  hostels.forEach((hostel) => {
    if (!hostel.rooms.length) todo.push([hostel, 'has no rooms or prices yet', 'rooms']);
    if (hostel.images.length < 3) {
      todo.push([
        hostel,
        `has ${hostel.images.length} photo${hostel.images.length === 1 ? '' : 's'} - add at least 3`,
        'photos',
      ]);
    }
    if (hostel.status === 'hidden') todo.push([hostel, 'is hidden, so visitors cannot see it', 'details']);
  });

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Overview</h1>
          <p>How visitors are finding your hostels over the last 30 days.</p>
        </div>
        <div className="acts">
          <Link className={`btn btn-solid${me.status === 'approved' ? '' : ' disabled'}`} to="/owner/hostel/new">
            <Icon name="plus" />
            Add a hostel
          </Link>
        </div>
      </div>

      <div className="tiles">
        <Tile k="Page views" v={totals.views} s="hostel pages opened" />
        <Tile k="WhatsApp taps" v={totals.whatsapp} s="students who messaged you" hot />
        <Tile k="Call taps" v={totals.calls} s="students who tapped call" />
        <Tile
          k="Hostels"
          v={hostels.length}
          s={`${hostels.filter((hostel) => hostel.status === 'published').length} visible`}
        />
        <Tile k="Room types" v={roomCount} s="with prices listed" />
      </div>

      {hostels.length ? (
        <div className="panel">
          <h2>Per hostel</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Hostel</th>
                  <th className="num">Views</th>
                  <th className="num">WhatsApp</th>
                  <th className="num">Calls</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.hostel_id}>
                    <td className="cell-main">{row.name}</td>
                    <td className="num">{row.views}</td>
                    <td className="num">{row.whatsapp}</td>
                    <td className="num">{row.calls}</td>
                    <td className="num">
                      <Link className="link" to={`/owner/hostel/${row.hostel_id}/details`}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <h2>Post your first hostel</h2>
          <p className="muted" style={{ maxWidth: '56ch', marginBottom: 16 }}>
            Add the hostel details, list each room type with its price per semester, then upload clear photos. It goes
            live straight away.
          </p>
          <Link className={`btn btn-clay${me.status === 'approved' ? '' : ' disabled'}`} to="/owner/hostel/new">
            <Icon name="plus" />
            Add a hostel
          </Link>
        </div>
      )}

      {todo.length ? (
        <div className="panel">
          <h2>To get noticed</h2>
          <ul className="todo">
            {todo.map(([hostel, message, tab], index) => (
              <li key={`${hostel.id}-${index}`}>
                <Icon name="arrow" />
                <span>
                  <b>{hostel.name}</b> {message}.
                </span>{' '}
                <Link className="link" to={`/owner/hostel/${hostel.id}/${tab}`}>
                  Fix
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function Tile({ k, v, s, hot }) {
  return (
    <div className={`tile${hot ? ' hot' : ''}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      <div className="s">{s}</div>
    </div>
  );
}

function HostelList({ me, hostels, loading, refreshHostels, toast }) {
  const dialog = useDialog();
  const [busyId, setBusyId] = useState('');

  const canPost = me.status === 'approved';

  const toggle = async (hostel) => {
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    setBusyId(hostel.id);
    try {
      await api(`/owner/hostels/${hostel.id}`, {
        method: 'PUT',
        body: { ...hostelBody(hostel), status: hostel.status === 'published' ? 'hidden' : 'published' },
      });
      toast(hostel.status === 'published' ? 'Hostel hidden' : 'Hostel is live', 'ok');
      await refreshHostels();
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (hostel) => {
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    const ok = await dialog.confirm({
      title: `Delete ${hostel.name}?`,
      text: 'This removes the hostel, its rooms and all its photos. It cannot be undone.',
      ok: 'Delete hostel',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/owner/hostels/${hostel.id}`, { method: 'DELETE' });
      toast('Hostel deleted', 'ok');
      await refreshHostels();
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  if (loading && !hostels.length) return <div className="loading">Loading...</div>;

  return (
    <>
      <div className="dhead">
        <div>
          <h1>My hostels</h1>
          <p>Everything you have listed on BUhostels.</p>
        </div>
        <div className="acts">
          <Link className={`btn btn-solid${canPost ? '' : ' disabled'}`} to="/owner/hostel/new">
            <Icon name="plus" />
            Add a hostel
          </Link>
        </div>
      </div>

      {hostels.length ? (
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th />
                  <th>Hostel</th>
                  <th>Status</th>
                  <th className="num">Rooms</th>
                  <th className="num">Photos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hostels.map((hostel) => {
                  const cover = hostel.images[0];
                  return (
                    <tr key={hostel.id}>
                      <td>
                        <div className="thumb">
                          {cover ? (
                            <img src={cover.url} alt="" />
                          ) : (
                            <div className="ph">
                              <span>{initials(hostel.name)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cell-main">{hostel.name}</div>
                        <div className="cell-sub">{hostel.area}</div>
                      </td>
                      <td>
                        <span className={`badge${hostel.status === 'published' ? ' ok' : ''}`}>
                          {hostel.status === 'published' ? 'Live' : 'Hidden'}
                        </span>
                      </td>
                      <td className="num">{hostel.rooms.length}</td>
                      <td className="num">{hostel.images.length}</td>
                      <td>
                        <div className="row-acts">
                          <Link className="btn btn-ghost btn-sm" to={`/owner/hostel/${hostel.id}/details`}>
                            <Icon name="edit" />
                            Edit
                          </Link>
                          <Link
                            className="btn btn-ghost btn-sm"
                            target="_blank"
                            rel="noopener noreferrer"
                            to={`/hostel/${hostel.id}`}
                          >
                            <Icon name="eye" />
                            View
                          </Link>
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            disabled={busyId === hostel.id}
                            onClick={() => toggle(hostel)}
                          >
                            {hostel.status === 'published' ? 'Hide' : 'Show'}
                          </button>
                          <button
                            className="btn-icon"
                            type="button"
                            aria-label={`Delete ${hostel.name}`}
                            onClick={() => remove(hostel)}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel">
          <p className="muted">You have not added a hostel yet.</p>
        </div>
      )}
    </>
  );
}

function Editor({ meta, me, refreshHostels, toast }) {
  const { id, tab: rawTab } = useParams();
  const navigate = useNavigate();
  const [hostel, setHostel] = useState(null);
  const [loading, setLoading] = useState(id !== 'new');
  const [error, setError] = useState('');
  const isNew = id === 'new';
  const tab = isNew || !['details', 'rooms', 'photos'].includes(rawTab) ? 'details' : rawTab;

  const loadHostel = useCallback(async () => {
    if (isNew) return null;
    const result = await api(`/owner/hostels/${encodeURIComponent(id)}`);
    setHostel(result.hostel);
    return result.hostel;
  }, [id, isNew]);

  useEffect(() => {
    let cancelled = false;
    if (isNew) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    api(`/owner/hostels/${encodeURIComponent(id)}`)
      .then((result) => {
        if (!cancelled) setHostel(result.hostel);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  const changed = async () => {
    await loadHostel();
    await refreshHostels();
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) {
    return (
      <div className="panel">
        <h2>Something went wrong</h2>
        <p className="muted">{error}</p>
        <Link className="btn btn-solid" to="/owner/hostels" style={{ marginTop: 14 }}>
          Back to hostels
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="dhead">
        <div>
          <p className="eyebrow">{hostel ? 'Editing' : 'New hostel'}</p>
          <h1>{hostel ? hostel.name : 'Add a hostel'}</h1>
        </div>
        <div className="acts">
          {hostel ? (
            <Link className="btn btn-ghost" target="_blank" rel="noopener noreferrer" to={`/hostel/${hostel.id}`}>
              <Icon name="eye" />
              See public page
            </Link>
          ) : null}
          <Link className="btn btn-ghost" to="/owner/hostels">
            Back to list
          </Link>
        </div>
      </div>

      <div className="etabs">
        <Link className={tab === 'details' ? 'on' : ''} to={hostel ? `/owner/hostel/${hostel.id}/details` : '/owner/hostel/new'}>
          Details
        </Link>
        {hostel ? (
          <Link className={tab === 'rooms' ? 'on' : ''} to={`/owner/hostel/${hostel.id}/rooms`}>
            Rooms &amp; prices ({hostel.rooms.length})
          </Link>
        ) : (
          <span className="off">Rooms &amp; prices</span>
        )}
        {hostel ? (
          <Link className={tab === 'photos' ? 'on' : ''} to={`/owner/hostel/${hostel.id}/photos`}>
            Photos ({hostel.images.length})
          </Link>
        ) : (
          <span className="off">Photos</span>
        )}
      </div>

      {tab === 'details' ? (
        <DetailsTab
          key={hostel ? hostel.id : 'new'}
          hostel={hostel}
          meta={meta}
          me={me}
          toast={toast}
          onSaved={async (saved) => {
            await refreshHostels();
            if (saved) setHostel(saved);
          }}
          onCreated={(created) => {
            refreshHostels();
            navigate(`/owner/hostel/${created.id}/rooms`);
          }}
        />
      ) : null}
      {tab === 'rooms' && hostel ? (
        <RoomsTab hostel={hostel} meta={meta} me={me} toast={toast} onChanged={changed} />
      ) : null}
      {tab === 'photos' && hostel ? (
        <PhotosTab hostel={hostel} me={me} toast={toast} onChanged={changed} />
      ) : null}
    </>
  );
}

function DetailsTab({ hostel, meta, me, toast, onSaved, onCreated }) {
  const [form, setForm] = useState(() => ({
    name: hostel ? hostel.name : '',
    area: hostel ? hostel.area : me.location || '',
    campus: hostel ? hostel.campus || '' : me.campus || '',
    distance_km: hostel && hostel.distance_km != null ? String(hostel.distance_km) : '',
    gender: hostel ? hostel.gender : 'mixed',
    phone: hostel ? localPhone(hostel.phone) : localPhone(me.phone),
    whatsapp: hostel && hostel.whatsapp && hostel.whatsapp !== hostel.phone ? localPhone(hostel.whatsapp) : '',
    address: hostel ? hostel.address || '' : '',
    latitude: hostel && hostel.latitude != null ? String(hostel.latitude) : '',
    longitude: hostel && hostel.longitude != null ? String(hostel.longitude) : '',
    description: hostel ? hostel.description || '' : '',
    amenities: hostel ? hostel.amenities || [] : [],
    published: hostel ? hostel.status === 'published' : true,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canPost = me.status === 'approved';

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggleAmenity = (amenity) =>
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));

  const useLocation = () => {
    if (!navigator.geolocation) {
      toast('This device cannot share your location.', 'err');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set('latitude', position.coords.latitude.toFixed(6));
        set('longitude', position.coords.longitude.toFixed(6));
        toast('Location captured. Save to keep it.', 'ok');
      },
      () => toast('Could not get your location. Allow location access and try again.', 'err'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        area: form.area,
        distance_km: form.distance_km,
        campus: form.campus,
        latitude: form.latitude.trim(),
        longitude: form.longitude.trim(),
        gender: form.gender,
        phone: form.phone,
        whatsapp: form.whatsapp,
        address: form.address,
        description: form.description,
        amenities: form.amenities,
        status: form.published ? 'published' : 'hidden',
      };
      if (hostel) {
        const result = await api(`/owner/hostels/${hostel.id}`, { method: 'PUT', body: payload });
        toast('Saved', 'ok');
        await onSaved(result.hostel);
      } else {
        const result = await api('/owner/hostels', { method: 'POST', body: payload });
        toast('Hostel created. Now add your rooms.', 'ok');
        onCreated(result.hostel);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Hostel name">
          <input
            type="text"
            maxLength={80}
            required
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </Field>
        <Field label="Area or town" hint="Where the hostel is, e.g. the trading centre or village.">
          <input
            type="text"
            list="ownerAreaList"
            maxLength={60}
            required
            value={form.area}
            onChange={(event) => set('area', event.target.value)}
          />
          <datalist id="ownerAreaList">
            {(meta.areas || []).map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
        </Field>
        <Field label="Campus" hint="The campus this hostel is closest to.">
          <select required value={form.campus} onChange={(event) => set('campus', event.target.value)}>
            <option value="">Choose a campus</option>
            {(meta.campuses || []).map((campus) => (
              <option key={campus} value={campus}>
                {campus} campus
              </option>
            ))}
          </select>
        </Field>
        <Field label="Distance from campus (km)" hint="Roughly, to the main gate. Students filter by this.">
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            inputMode="decimal"
            value={form.distance_km}
            onChange={(event) => set('distance_km', event.target.value)}
          />
        </Field>
        <Field label="Who it is for">
          <select value={form.gender} onChange={(event) => set('gender', event.target.value)}>
            {(meta.genders || []).map((gender) => (
              <option key={gender.value} value={gender.value}>
                {gender.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phone number" hint="Shown on your page, with a Call button.">
          <input
            type="tel"
            placeholder="0772 123 456"
            required
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
          />
        </Field>
        <Field label="WhatsApp number" hint="Students message this number. Leave empty if it is the same.">
          <input
            type="tel"
            placeholder="Leave empty if it is the same"
            value={form.whatsapp}
            onChange={(event) => set('whatsapp', event.target.value)}
          />
        </Field>
        <div className="field span2">
          <label htmlFor="ownerAddress">Directions or address</label>
          <input
            id="ownerAddress"
            type="text"
            maxLength={160}
            placeholder="e.g. 200 m past the market, opposite the clinic"
            value={form.address}
            onChange={(event) => set('address', event.target.value)}
          />
        </div>
        <div className="field span2">
          <span className="f-label">Map location (optional)</span>
          <div className="geo">
            <input
              type="text"
              inputMode="decimal"
              placeholder="Latitude"
              aria-label="Latitude"
              value={form.latitude}
              onChange={(event) => set('latitude', event.target.value)}
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder="Longitude"
              aria-label="Longitude"
              value={form.longitude}
              onChange={(event) => set('longitude', event.target.value)}
            />
            <button className="btn btn-ghost btn-sm" type="button" onClick={useLocation}>
              Use my current location
            </button>
          </div>
          <span className="hint">Stand at the hostel and tap the button. Students get an Open in Google Maps link.</span>
        </div>
        <div className="field span2">
          <label htmlFor="ownerDescription">About the hostel</label>
          <textarea
            id="ownerDescription"
            maxLength={2000}
            placeholder="Rules, security, water and power, what makes it a good place to stay..."
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </div>
        <div className="field span2">
          <span className="f-label">Amenities</span>
          <div className="checks">
            {(meta.amenities || []).map((amenity) => (
              <label className="check" key={amenity}>
                <input
                  type="checkbox"
                  checked={form.amenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                />
                <span>{amenity}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="field span2">
          <label className="check">
            <input type="checkbox" checked={form.published} onChange={(event) => set('published', event.target.checked)} />
            <span>Visible to students</span>
          </label>
          <span className="hint">Untick to hide the hostel without deleting it.</span>
        </div>
      </div>
      <div className="form-err" role="alert" style={{ marginTop: 14 }}>
        {error}
      </div>
      <div className="form-foot">
        <button className="btn btn-solid" type="submit" disabled={busy}>
          {busy ? 'Saving...' : hostel ? 'Save changes' : 'Create hostel'}
        </button>
        {hostel ? null : <span className="muted">You will add rooms and photos next.</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function RoomsTab({ hostel, meta, me, toast, onChanged }) {
  const dialog = useDialog();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'single', name: '', price: '', available: '1', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canPost = me.status === 'approved';
  const roomTypes = meta.roomTypes || [];

  const reset = () => {
    setEditing(null);
    setForm({ type: 'single', name: '', price: '', available: '1', description: '' });
    setError('');
  };

  const edit = (room) => {
    setEditing(room);
    setForm({
      type: room.type,
      name: room.name || '',
      price: String(room.price),
      available: String(room.available),
      description: room.description || '',
    });
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        type: form.type,
        name: form.name,
        price: form.price,
        available: form.available,
        description: form.description,
      };
      if (editing) {
        await api(`/owner/rooms/${editing.id}`, { method: 'PUT', body: payload });
        toast('Room updated', 'ok');
      } else {
        await api(`/owner/hostels/${hostel.id}/rooms`, { method: 'POST', body: payload });
        toast('Room added', 'ok');
      }
      reset();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (room) => {
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    const ok = await dialog.confirm({
      title: 'Delete this room?',
      text: `${room.name} will be removed from your page.`,
      ok: 'Delete room',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/owner/rooms/${room.id}`, { method: 'DELETE' });
      toast('Room deleted', 'ok');
      if (editing && editing.id === room.id) reset();
      await onChanged();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  return (
    <>
      <div className="panel">
        <h2>Rooms and prices</h2>
        {hostel.rooms.length ? (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th className="num">Per semester</th>
                  <th className="num">Available</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hostel.rooms.map((room) => (
                  <tr key={room.id}>
                    <td className="cell-main">
                      {room.name}
                      {room.description ? <div className="cell-sub">{room.description}</div> : null}
                    </td>
                    <td>{roomTypeLabel(room.type)}</td>
                    <td className="num">{fmtMoney(room.price)}</td>
                    <td className="num">{room.available}</td>
                    <td>
                      <div className="row-acts">
                        <button className="btn-icon" type="button" aria-label={`Edit ${room.name}`} onClick={() => edit(room)}>
                          <Icon name="edit" />
                        </button>
                        <button
                          className="btn-icon"
                          type="button"
                          aria-label={`Delete ${room.name}`}
                          onClick={() => remove(room)}
                        >
                          <Icon name="trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No rooms yet. Add each room type you rent out, with its price per semester.</p>
        )}
      </div>

      <form className="panel" onSubmit={submit} noValidate>
        <h2>{editing ? 'Edit room' : 'Add a room'}</h2>
        <div className="form-grid">
          <Field label="Room type">
            <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
              {roomTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Label (optional)">
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Single room, upstairs"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <Field label="Price per semester (UGX)">
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              required
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            />
          </Field>
          <Field label="Rooms available now" hint="Put 0 when this type is full.">
            <input
              type="number"
              min="0"
              max="999"
              inputMode="numeric"
              value={form.available}
              onChange={(event) => setForm((current) => ({ ...current, available: event.target.value }))}
            />
          </Field>
          <div className="field span2">
            <label htmlFor="roomDescription">Note (optional)</label>
            <input
              id="roomDescription"
              type="text"
              maxLength={200}
              placeholder="e.g. own bathroom, balcony, bed and mattress included"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
        </div>
        <div className="form-err" role="alert" style={{ marginTop: 14 }}>
          {error}
        </div>
        <div className="form-foot">
          <button className="btn btn-solid" type="submit" disabled={busy}>
            {busy ? 'Saving...' : editing ? 'Save room' : 'Add room'}
          </button>
          {editing ? (
            <button className="btn btn-ghost" type="button" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </>
  );
}

function PhotosTab({ hostel, me, toast, onChanged }) {
  const dialog = useDialog();
  const [status, setStatus] = useState('');
  const [dragging, setDragging] = useState(false);
  const canPost = me.status === 'approved';

  const upload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    if (hostel.images.length + files.length > MAX_PHOTOS) {
      toast(`A hostel can have up to ${MAX_PHOTOS} photos.`, 'err');
      return;
    }
    try {
      for (let index = 0; index < files.length; index += 3) {
        const slice = files.slice(index, index + 3);
        setStatus(`Uploading ${Math.min(index + 3, files.length)} of ${files.length}...`);
        const small = [];
        for (const file of slice) small.push(await shrinkImage(file, 1600, 0.82));
        const data = new FormData();
        small.forEach((file) => data.append('images', file, file.name));
        await api(`/owner/hostels/${hostel.id}/images`, { method: 'POST', form: data });
      }
      toast(files.length === 1 ? 'Photo added' : `${files.length} photos added`, 'ok');
    } catch (error) {
      toast(error.message, 'err');
    } finally {
      setStatus('');
      await onChanged();
    }
  };

  const makeCover = async (image) => {
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    try {
      await api(`/owner/images/${image.id}/cover`, { method: 'POST' });
      await onChanged();
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  const remove = async (image) => {
    if (!canPost) {
      toast('You can post once the admin approves your account.', 'err');
      return;
    }
    const ok = await dialog.confirm({ title: 'Delete this photo?', ok: 'Delete photo', danger: true });
    if (!ok) return;
    try {
      await api(`/owner/images/${image.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (error) {
      toast(error.message, 'err');
    }
  };

  const dropProps = {
    onDragEnter: (event) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragOver: (event) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event) => {
      event.preventDefault();
      setDragging(false);
    },
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      upload(event.dataTransfer.files);
    },
  };

  return (
    <div className="panel">
      <div className="ph2">
        <h2>Photos</h2>
        <span className="muted">
          {hostel.images.length} of {MAX_PHOTOS}
        </span>
      </div>
      <label className={`dropzone${dragging ? ' drag' : ''}`} htmlFor="photoFiles" {...dropProps}>
        <Icon name="camera" />
        <strong>Add photos</strong>
        <span className="muted">
          Tap to choose, or drop them here. JPG, PNG or WebP. They are shrunk automatically to save your data.
        </span>
      </label>
      <input
        id="photoFiles"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          upload(event.target.files);
          event.target.value = '';
        }}
      />
      <div className="muted" style={{ marginTop: 10, minHeight: '1.4em' }}>
        {status}
      </div>
      {hostel.images.length ? (
        <div className="photos">
          {hostel.images.map((image) => (
            <div className="photo" key={image.id}>
              <div className="img">
                <img src={image.url} alt="" />
              </div>
              {image.is_cover ? <span className="cover-tag">Cover</span> : null}
              <div className="bar">
                {image.is_cover ? (
                  <span className="muted">Shown first</span>
                ) : (
                  <button className="link" type="button" onClick={() => makeCover(image)}>
                    Make cover
                  </button>
                )}
                <button className="btn-icon" type="button" aria-label="Delete photo" onClick={() => remove(image)}>
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>
          No photos yet. Hostels with clear photos of the room, bathroom and compound get far more messages.
        </p>
      )}
    </div>
  );
}

function Account({ meta, me, updateMe, toast }) {
  const [details, setDetails] = useState({ full_name: me.full_name, phone: localPhone(me.phone) });
  const [business, setBusiness] = useState({
    business_name: me.business_name || '',
    campus: me.campus || '',
    location: me.location || '',
    address: me.address || '',
  });
  const [password, setPassword] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState({ details: '', business: '', password: '' });

  useEffect(() => {
    setDetails({ full_name: me.full_name, phone: localPhone(me.phone) });
    setBusiness({
      business_name: me.business_name || '',
      campus: me.campus || '',
      location: me.location || '',
      address: me.address || '',
    });
  }, [me]);

  const saveDetails = async (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, details: '' }));
    setBusy('details');
    try {
      const result = await api('/auth/me', {
        method: 'PATCH',
        body: { full_name: details.full_name, phone: details.phone },
      });
      updateMe(result.profile);
      toast('Details saved', 'ok');
    } catch (err) {
      setError((current) => ({ ...current, details: err.message }));
    } finally {
      setBusy('');
    }
  };

  const saveBusiness = async (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, business: '' }));
    setBusy('business');
    try {
      const result = await api('/auth/me', {
        method: 'PATCH',
        body: {
          full_name: me.full_name,
          phone: me.phone,
          business_name: business.business_name,
          campus: business.campus,
          location: business.location,
          address: business.address,
        },
      });
      updateMe(result.profile);
      toast('Business details saved', 'ok');
    } catch (err) {
      setError((current) => ({ ...current, business: err.message }));
    } finally {
      setBusy('');
    }
  };

  const changeLogo = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const small = await shrinkImage(file, 600, 0.85);
      const data = new FormData();
      data.append('avatar', small, small.name);
      const result = await api('/owner/avatar', { method: 'POST', form: data });
      updateMe(result.profile);
      toast('Logo updated', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const removeLogo = async () => {
    try {
      const result = await api('/owner/avatar', { method: 'DELETE' });
      updateMe(result.profile);
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError((current) => ({ ...current, password: '' }));
    setBusy('password');
    try {
      await api('/auth/password', { method: 'POST', body: { current: password.current, next: password.next } });
      setPassword({ current: '', next: '' });
      toast('Password changed', 'ok');
    } catch (err) {
      setError((current) => ({ ...current, password: err.message }));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Account</h1>
          <p>Your details and password.</p>
        </div>
      </div>

      <form className="panel" onSubmit={saveDetails} noValidate>
        <h2>Your details</h2>
        <div className="form-grid">
          <Field label="Full name">
            <input
              type="text"
              maxLength={80}
              required
              value={details.full_name}
              onChange={(event) => setDetails((current) => ({ ...current, full_name: event.target.value }))}
            />
          </Field>
          <Field label="Phone number">
            <input
              type="tel"
              required
              value={details.phone}
              onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))}
            />
          </Field>
          <Field label="Email" hint="To change your email, ask the admin.">
            <input type="email" value={me.email} disabled />
          </Field>
          <Field label="Account status">
            <input type="text" value={me.status === 'approved' ? 'Approved' : 'Waiting for approval'} disabled />
          </Field>
        </div>
        <div className="form-err" role="alert" style={{ marginTop: 14 }}>
          {error.details}
        </div>
        <div className="form-foot">
          <button className="btn btn-solid" type="submit" disabled={busy === 'details'}>
            {busy === 'details' ? 'Saving...' : 'Save details'}
          </button>
        </div>
      </form>

      <form className="panel" onSubmit={saveBusiness} noValidate>
        <h2>Your business</h2>
        <div className="logo-pick" style={{ marginBottom: 16 }}>
          <span
            className="avatar lg"
            style={me.avatar_url ? { backgroundImage: `url(${me.avatar_url})` } : undefined}
          >
            {me.avatar_url ? '' : initials(me.business_name || me.full_name)}
          </span>
          <div>
            <label className="btn btn-ghost btn-sm" htmlFor="businessLogo">
              {me.avatar_url ? 'Change logo' : 'Add logo or photo'}
            </label>
            <input
              id="businessLogo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={changeLogo}
            />
            {me.avatar_url ? (
              <button className="btn btn-ghost btn-sm" type="button" onClick={removeLogo}>
                Remove
              </button>
            ) : null}
            <div className="hint">Shown on your hostel pages.</div>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Hostel or business name">
            <input
              type="text"
              maxLength={80}
              required
              value={business.business_name}
              onChange={(event) => setBusiness((current) => ({ ...current, business_name: event.target.value }))}
            />
          </Field>
          <Field label="Campus">
            <select
              value={business.campus}
              onChange={(event) => setBusiness((current) => ({ ...current, campus: event.target.value }))}
            >
              <option value="">Choose a campus</option>
              {(meta.campuses || []).map((campus) => (
                <option key={campus} value={campus}>
                  {campus} campus
                </option>
              ))}
            </select>
          </Field>
          <Field label="Area or town">
            <input
              type="text"
              maxLength={60}
              required
              value={business.location}
              onChange={(event) => setBusiness((current) => ({ ...current, location: event.target.value }))}
            />
          </Field>
          <Field label="Directions (optional)">
            <input
              type="text"
              maxLength={160}
              value={business.address}
              onChange={(event) => setBusiness((current) => ({ ...current, address: event.target.value }))}
            />
          </Field>
        </div>
        <div className="form-err" role="alert" style={{ marginTop: 14 }}>
          {error.business}
        </div>
        <div className="form-foot">
          <button className="btn btn-solid" type="submit" disabled={busy === 'business'}>
            {busy === 'business' ? 'Saving...' : 'Save business'}
          </button>
        </div>
      </form>

      <form className="panel" onSubmit={savePassword} noValidate>
        <h2>Change password</h2>
        <div className="form-grid">
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password.current}
              onChange={(event) => setPassword((current) => ({ ...current, current: event.target.value }))}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password.next}
              onChange={(event) => setPassword((current) => ({ ...current, next: event.target.value }))}
            />
          </Field>
        </div>
        <div className="form-err" role="alert" style={{ marginTop: 14 }}>
          {error.password}
        </div>
        <div className="form-foot">
          <button className="btn btn-solid" type="submit" disabled={busy === 'password'}>
            {busy === 'password' ? 'Saving...' : 'Change password'}
          </button>
        </div>
      </form>
    </>
  );
}
