import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth, useRequireRole } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useToast } from '../context/ToastContext';
import Icon from '../lib/icons';
import { api } from '../lib/api';
import { CAMPUSES, fmtMoney, fmtPhone, fullDate, initials, timeAgo } from '../lib/format';

const STATUS = {
  approved: ['ok', 'Approved'],
  pending: ['warn', 'Waiting'],
  suspended: ['bad', 'Suspended'],
};

const GROUPS = [
  ['all', 'Everything'],
  ['visitors', 'Visitors'],
  ['contacts', 'Contacts'],
  ['owners', 'Owners & admin'],
];

export default function Admin() {
  const profile = useRequireRole('admin');
  const { refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [me, setMe] = useState(profile);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    document.body.classList.add('dashboard');
    return () => document.body.classList.remove('dashboard');
  }, []);

  useEffect(() => {
    setMe(profile);
    if (!profile) return;
    refreshProfile()
      .then(setMe)
      .catch(() => {});
  }, [profile && profile.id, refreshProfile]);

  useEffect(() => {
    if (!profile) return;
    api('/admin/overview?days=1')
      .then((result) => setPendingCount(result.totals.owners_pending || 0))
      .catch(() => {});
  }, [profile && profile.id]);

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
          <span className="role">Admin</span>
        </div>
        <nav aria-label="Admin dashboard">
          <NavLink to="/admin" end>
            <Icon name="chart" />
            Overview
          </NavLink>
          <NavLink to="/admin/activity">
            <Icon name="pulse" />
            Live activity
          </NavLink>
          <NavLink to="/admin/hostels">
            <Icon name="home" />
            Hostels
          </NavLink>
          <NavLink to="/admin/owners">
            <Icon name="users" />
            Owners
            {pendingCount ? <span className="count">{pendingCount}</span> : null}
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
        <Routes>
          <Route
            index
            element={<Overview toast={toast} onPending={setPendingCount} />}
          />
          <Route path="activity" element={<Activity toast={toast} />} />
          <Route path="hostels" element={<Hostels toast={toast} />} />
          <Route path="owners" element={<Owners toast={toast} onPending={setPendingCount} />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Overview({ toast, onPending }) {
  const [days, setDays] = useState(() => Number(localStorage.getItem('buh.days')) || 14);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(
    async (quiet) => {
      if (!quiet) setData(null);
      setError('');
      try {
        const result = await api(`/admin/overview?days=${days}`);
        setData(result);
        onPending(result.totals.owners_pending || 0);
      } catch (err) {
        setError(err.message);
      }
    },
    [days, onPending]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const result = await api(`/admin/overview?days=${days}`);
        if (cancelled) return;
        setData(result);
        onPending(result.totals.owners_pending || 0);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    setData(null);
    run();
    const timer = setInterval(() => {
      if (!document.hidden) run();
    }, 45000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [days, onPending]);

  const chooseDays = (next) => {
    localStorage.setItem('buh.days', String(next));
    setDays(next);
  };

  const approve = async (owner) => {
    setBusyId(owner.id);
    try {
      await api(`/admin/owners/${owner.id}/status`, { method: 'PATCH', body: { status: 'approved' } });
      toast('Owner approved', 'ok');
      await load(true);
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusyId('');
    }
  };

  if (error) {
    return (
      <div className="panel">
        <h2>Something went wrong</h2>
        <p className="muted">{error}</p>
        <button className="btn btn-solid" type="button" style={{ marginTop: 14 }} onClick={() => load()}>
          Reload
        </button>
      </div>
    );
  }

  if (!data) return <div className="loading">Loading...</div>;

  const { period, totals, series, top_hostels: topHostels, top_searches: topSearches, pending } = data;

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Overview</h1>
          <p>What is happening on BUhostels right now.</p>
        </div>
        <div className="acts">
          <div className="seg" role="group" aria-label="Time range">
            {[7, 14, 30].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === days}
                onClick={() => chooseDays(value)}
              >
                {value} days
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="tiles six">
        <Tile k="Visits" v={num(period.visits)} s={`last ${days} days`} />
        <Tile k="Unique visitors" v={num(period.visitors)} s="different devices" />
        <Tile k="Hostel views" v={num(period.views)} s="pages opened" />
        <Tile k="WhatsApp taps" v={num(period.whatsapp)} s="students messaging owners" hot />
        <Tile k="Call taps" v={num(period.calls)} s="students calling" />
        <Tile k="Searches" v={num(period.searches)} s="typed on the site" />
      </div>

      <div className="panel">
        <div className="ph2">
          <h2>Visits and contacts per day</h2>
        </div>
        <Chart series={series} />
        <div className="legend">
          <span>
            <i className="l-bar" />
            Visits
          </span>
          <span>
            <i className="l-line" />
            WhatsApp + call taps
          </span>
        </div>
      </div>

      <div className="cols">
        <div className="panel">
          <h2>Most viewed hostels</h2>
          <TopHostels list={topHostels} />
        </div>
        <div className="panel">
          <h2>What students search for</h2>
          <TopSearches list={topSearches} />
        </div>
      </div>

      <div className="tiles" style={{ marginTop: 18 }}>
        <Tile k="Hostels" v={`${totals.published} / ${totals.hostels}`} s="live / total" />
        <Tile k="Room types" v={num(totals.rooms)} s="with prices" />
        <Tile k="Photos" v={num(totals.photos)} s="uploaded" />
        <Tile k="Owners" v={`${totals.owners_approved} / ${totals.owners}`} s="approved / total" />
      </div>

      {pending && pending.length ? (
        <div className="panel">
          <div className="ph2">
            <h2>Waiting for your approval</h2>
            <Link className="link" to="/admin/owners">
              All owners
            </Link>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <tbody>
                {pending.map((owner) => (
                  <tr key={owner.id}>
                    <td>
                      <div className="cell-main">{owner.full_name}</div>
                      <div className="cell-sub">
                        {fmtPhone(owner.phone)} &middot; {owner.email}
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">{owner.business_name || '-'}</div>
                      <div className="cell-sub">
                        {[owner.campus && `${owner.campus} campus`, owner.location].filter(Boolean).join(' \u00b7 ')}
                      </div>
                    </td>
                    <td className="cell-sub">Signed up {timeAgo(owner.created_at)}</td>
                    <td>
                      <div className="row-acts">
                        <button
                          className="btn btn-solid btn-sm"
                          type="button"
                          disabled={busyId === owner.id}
                          onClick={() => approve(owner)}
                        >
                          Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}

function num(value) {
  return Number(value || 0).toLocaleString('en-US');
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

function Chart({ series }) {
  if (!series || !series.length) return <p className="empty-s">No data yet.</p>;

  const W = 760;
  const H = 250;
  const L = 38;
  const R = 12;
  const T = 14;
  const B = 30;
  const iw = W - L - R;
  const ih = H - T - B;
  const peak = Math.max(4, ...series.map((day) => Math.max(day.visits, day.contacts)));
  const raw = peak / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(1, [1, 2, 5, 10].find((multiple) => raw <= multiple * mag) * mag);
  const top = step * 4;
  const bw = iw / series.length;
  const y = (value) => T + ih - (ih * value) / top;
  const every = Math.ceil(series.length / 8);
  const label = (day) =>
    new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    grid.push(
      <g key={`grid-${i}`}>
        <line className="gl" x1={L} x2={W - R} y1={y(step * i)} y2={y(step * i)} />
        <text className="ax" x={L - 8} y={y(step * i) + 4} textAnchor="end">
          {step * i}
        </text>
      </g>
    );
  }

  const bars = series.map((day, index) => {
    const x = L + index * bw + bw * 0.2;
    const height = ih * (day.visits / top);
    return (
      <g key={day.day}>
        <rect
          className="bar"
          x={x.toFixed(1)}
          y={(T + ih - height).toFixed(1)}
          width={(bw * 0.6).toFixed(1)}
          height={height.toFixed(1)}
        >
          <title>
            {label(day.day)}: {day.visits} visits, {day.visitors} visitors, {day.contacts} contact taps
          </title>
        </rect>
        {index % every === 0 || index === series.length - 1 ? (
          <text className="ax" x={(L + index * bw + bw / 2).toFixed(1)} y={H - 9} textAnchor="middle">
            {label(day.day)}
          </text>
        ) : null}
      </g>
    );
  });

  const points = series
    .map((day, index) => `${(L + index * bw + bw / 2).toFixed(1)},${y(day.contacts).toFixed(1)}`)
    .join(' ');

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visits and contact taps per day">
        {grid}
        {bars}
        <polyline className="ln" points={points} />
        {series.map((day, index) => (
          <circle
            key={`dot-${day.day}`}
            className="dt"
            cx={(L + index * bw + bw / 2).toFixed(1)}
            cy={y(day.contacts).toFixed(1)}
            r="3.2"
          >
            <title>
              {label(day.day)}: {day.contacts} contact taps
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function TopHostels({ list }) {
  const rows = (list || []).filter((hostel) => hostel.views || hostel.contacts);
  if (!rows.length) return <p className="empty-s">No hostel views yet in this period.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Hostel</th>
            <th className="num">Views</th>
            <th className="num">Contacts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((hostel) => (
            <tr key={hostel.id}>
              <td>
                <Link className="cell-main" to={`/hostel/${hostel.id}`} target="_blank" rel="noopener noreferrer">
                  {hostel.name}
                </Link>
                <div className="cell-sub">{hostel.area}</div>
              </td>
              <td className="num">{hostel.views}</td>
              <td className="num">{hostel.contacts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopSearches({ list }) {
  if (!list || !list.length) return <p className="empty-s">No searches yet in this period.</p>;
  return (
    <ul className="rank">
      {list.map((search) => (
        <li key={search.term}>
          <span>&ldquo;{search.term}&rdquo;</span>
          <span className="n">{search.n}&times;</span>
        </li>
      ))}
    </ul>
  );
}

function Activity({ toast }) {
  const [group, setGroup] = useState('all');
  const [items, setItems] = useState([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [olderBusy, setOlderBusy] = useState(false);
  const [, setTick] = useState(0);
  const newestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setItems([]);
    newestRef.current = 0;

    api(`/admin/activity?limit=60&group=${group}`)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items || []);
        newestRef.current = result.items && result.items.length ? result.items[0].id : 0;
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
  }, [group]);

  useEffect(() => {
    if (paused) return undefined;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const result = await api(`/admin/activity?limit=100&since=${newestRef.current}&group=${group}`);
        if (!result.items || !result.items.length) return;
        newestRef.current = result.items[0].id;
        setItems((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...result.items.filter((item) => !seen.has(item.id)), ...current].slice(0, 300);
        });
      } catch {
        return;
      }
    };
    const timer = setInterval(poll, 5000);
    const clock = setInterval(() => setTick((value) => value + 1), 30000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [group, paused]);

  const older = async () => {
    if (!items.length) return;
    setOlderBusy(true);
    try {
      const result = await api(`/admin/activity?limit=60&before=${items[items.length - 1].id}&group=${group}`);
      setItems((current) => [...current, ...(result.items || [])]);
      if (!result.items || result.items.length < 60) toast('That is the beginning of the feed', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setOlderBusy(false);
    }
  };

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Live activity</h1>
          <p>Visitors, contact taps and owner changes as they happen.</p>
        </div>
        <div className="acts">
          <span className={`live${paused ? ' paused' : ''}`}>
            <i />
            <span>{paused ? 'Paused' : 'Live'}</span>
          </span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <div className="ph2">
          <div className="seg" role="group" aria-label="Filter activity">
            {GROUPS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={value === group} onClick={() => setGroup(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ul className="feed">
          {loading ? (
            <li className="muted" style={{ display: 'block' }}>
              Loading...
            </li>
          ) : error ? (
            <li className="muted" style={{ display: 'block' }}>
              {error}
            </li>
          ) : items.length ? (
            items.map((event) => (
              <li className={kind(event.type)} key={event.id}>
                <span className="dot" />
                <span>{describe(event)}</span>
                <span className="when" title={fullDate(event.created_at)}>
                  {timeAgo(event.created_at)}
                </span>
              </li>
            ))
          ) : (
            <li className="muted" style={{ display: 'block' }}>
              Nothing yet. Open the public site in another tab and it will show up here.
            </li>
          )}
        </ul>
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button className="btn btn-ghost btn-sm" type="button" disabled={olderBusy || !items.length} onClick={older}>
            {olderBusy ? 'Loading...' : 'Load older'}
          </button>
        </div>
      </div>
    </>
  );
}

function kind(type) {
  if (type === 'whatsapp' || type === 'call') return 'k-contact';
  if (type === 'visit') return 'k-visit';
  if (type === 'view' || type === 'search') return '';
  return 'k-owner';
}

function who(event) {
  const vid = event.meta && event.meta.vid;
  return <b>Visitor {vid ? `#${String(vid).slice(0, 4)}` : ''}</b>;
}

function describe(event) {
  const meta = event.meta || {};
  const hostel = <b>{meta.hostel || 'a hostel'}</b>;
  const actor = <b>{meta.actor || 'An owner'}</b>;
  switch (event.type) {
    case 'visit':
      return <>{who(event)} opened the site</>;
    case 'view':
      return (
        <>
          {who(event)} viewed {hostel}
        </>
      );
    case 'search':
      return (
        <>
          {who(event)} searched &ldquo;{meta.q}&rdquo;
        </>
      );
    case 'whatsapp':
      return (
        <>
          {who(event)} tapped <b>WhatsApp</b> on {hostel}
        </>
      );
    case 'call':
      return (
        <>
          {who(event)} tapped <b>Call</b> on {hostel}
        </>
      );
    case 'owner_signup':
      return <>{actor} signed up as an owner and is waiting for approval</>;
    case 'owner_login':
      return <>{actor} signed in</>;
    case 'owner_created':
      return (
        <>
          You added owner <b>{meta.owner}</b>
        </>
      );
    case 'owner_approved':
      return (
        <>
          Owner <b>{meta.owner}</b> was approved
        </>
      );
    case 'owner_suspended':
      return (
        <>
          Owner <b>{meta.owner}</b> was suspended
        </>
      );
    case 'owner_pending':
      return (
        <>
          Owner <b>{meta.owner}</b> was set back to waiting
        </>
      );
    case 'owner_deleted':
      return (
        <>
          Owner <b>{meta.owner}</b> was deleted
        </>
      );
    case 'hostel_created':
      return (
        <>
          {actor} posted a new hostel, {hostel}
        </>
      );
    case 'hostel_updated':
      return (
        <>
          {actor} updated the details of {hostel}
        </>
      );
    case 'hostel_deleted':
      return <>{meta.by === 'admin' ? 'You deleted ' : `${meta.actor || 'An owner'} deleted `}{hostel}</>;
    case 'hostel_status':
      return (
        <>
          {hostel} was {meta.status === 'hidden' ? 'hidden' : 'published'} by admin
        </>
      );
    case 'room_saved':
      return (
        <>
          {actor} {meta.action || 'saved'} <b>{meta.room || 'a room'}</b>
          {meta.price ? ` (${fmtMoney(meta.price)})` : ''} in {hostel}
        </>
      );
    case 'room_deleted':
      return (
        <>
          {actor} removed <b>{meta.room || 'a room'}</b> from {hostel}
        </>
      );
    case 'photo_added':
      return (
        <>
          {actor} added {meta.count || 1} photo{meta.count === 1 ? '' : 's'} to {hostel}
        </>
      );
    default:
      return <>{event.type}</>;
  }
}

function Hostels({ toast }) {
  const dialog = useDialog();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('/admin/hostels')
      .then((result) => {
        if (!cancelled) setList(result.items || []);
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
  }, []);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((hostel) => {
      if (status && hostel.status !== status) return false;
      if (needle) {
        const hay = `${hostel.name} ${hostel.area} ${hostel.owner ? hostel.owner.full_name : ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, query, status]);

  const patch = async (hostel, body) => {
    setBusyId(hostel.id);
    try {
      await api(`/admin/hostels/${hostel.id}`, { method: 'PATCH', body });
      setList((current) => current.map((item) => (item.id === hostel.id ? { ...item, ...body } : item)));
      if (body.status) toast(body.status === 'hidden' ? 'Hostel hidden' : 'Hostel published', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (hostel) => {
    const ok = await dialog.confirm({
      title: `Delete ${hostel.name}?`,
      text: 'The hostel, its rooms and photos will be removed for good.',
      ok: 'Delete hostel',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/hostels/${hostel.id}`, { method: 'DELETE' });
      setList((current) => current.filter((item) => item.id !== hostel.id));
      toast('Hostel deleted', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="panel"><h2>Something went wrong</h2><p className="muted">{error}</p></div>;

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Hostels</h1>
          <p>{list.length} listed by owners.</p>
        </div>
        <div className="acts">
          <input
            type="search"
            placeholder="Search name, area or owner"
            style={{ width: 250 }}
            aria-label="Search hostels"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select style={{ width: 'auto' }} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            <option value="published">Live</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Hostel</th>
                <th>Owner</th>
                <th className="num">Rooms</th>
                <th className="num">From</th>
                <th className="num">Photos</th>
                <th className="num">Views / contacts</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((hostel) => (
                  <tr key={hostel.id}>
                    <td>
                      <Link className="cell-main" to={`/hostel/${hostel.id}`} target="_blank" rel="noopener noreferrer">
                        {hostel.name}
                      </Link>
                      <div className="cell-sub">{hostel.area}</div>
                    </td>
                    <td>
                      {hostel.owner ? (
                        <>
                          <div>{hostel.owner.full_name}</div>
                          <div className="cell-sub">{fmtPhone(hostel.owner.phone)}</div>
                        </>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td className="num">{hostel.rooms_count}</td>
                    <td className="num">{hostel.min_price != null ? fmtMoney(hostel.min_price) : '-'}</td>
                    <td className="num">{hostel.photos_count}</td>
                    <td className="num">
                      {hostel.views} / {hostel.contacts}
                    </td>
                    <td>
                      <span className={`badge ${hostel.status === 'published' ? 'ok' : 'warn'}`}>
                        {hostel.status === 'published' ? 'Live' : 'Hidden'}
                      </span>
                    </td>
                    <td>
                      <div className="row-acts">
                        <button
                          className={`btn-icon${hostel.featured ? ' on' : ''}`}
                          type="button"
                          aria-pressed={hostel.featured}
                          aria-label={hostel.featured ? 'Remove from featured' : 'Feature this hostel'}
                          title="Featured hostels are shown first"
                          disabled={busyId === hostel.id}
                          onClick={() => patch(hostel, { featured: !hostel.featured })}
                        >
                          <Icon name="star" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          disabled={busyId === hostel.id}
                          onClick={() =>
                            patch(hostel, { status: hostel.status === 'published' ? 'hidden' : 'published' })
                          }
                        >
                          {hostel.status === 'published' ? 'Hide' : 'Publish'}
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
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="muted" style={{ padding: '28px 10px' }}>
                    No hostels match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Owners({ toast, onPending }) {
  const dialog = useDialog();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const result = await api('/admin/owners');
    setList(result.items || []);
    onPending((result.items || []).filter((owner) => owner.status === 'pending').length);
  }, [onPending]);

  useEffect(() => {
    let cancelled = false;
    api('/admin/owners')
      .then((result) => {
        if (cancelled) return;
        setList(result.items || []);
        onPending((result.items || []).filter((owner) => owner.status === 'pending').length);
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
  }, [onPending]);

  const addOwner = async () => {
    const values = await dialog.form({
      title: 'Add an owner',
      note: 'Creates an approved account. Give them the email and password so they can sign in.',
      ok: 'Create owner',
      fields: [
        { name: 'full_name', label: 'Full name', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', placeholder: '0772 123 456', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        {
          name: 'password',
          label: 'Password',
          type: 'text',
          minLength: 8,
          hint: 'At least 8 characters.',
          required: true,
        },
        { name: 'business_name', label: 'Hostel or business name', required: true },
        {
          name: 'campus',
          label: 'Campus',
          type: 'select',
          required: true,
          options: CAMPUSES.map((campus) => ({ value: campus, label: `${campus} campus` })),
        },
        { name: 'location', label: 'Area or town', required: true },
      ],
    });
    if (!values) return;
    try {
      await api('/admin/owners', { method: 'POST', body: values });
      toast('Owner created', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const setStatus = async (owner, status) => {
    try {
      await api(`/admin/owners/${owner.id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'approved' ? 'Owner approved' : 'Owner suspended', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const resetPassword = async (owner) => {
    const values = await dialog.form({
      title: 'Reset password',
      note: `Set a new password for ${owner.full_name}, then tell them what it is.`,
      ok: 'Set password',
      fields: [
        { name: 'password', label: 'New password', type: 'text', minLength: 8, required: true },
      ],
    });
    if (!values) return;
    try {
      await api(`/admin/owners/${owner.id}/password`, { method: 'POST', body: values });
      toast('Password updated', 'ok');
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  const remove = async (owner) => {
    const ok = await dialog.confirm({
      title: `Delete ${owner.full_name}?`,
      text: `Their account, ${owner.hostels_count} hostel(s), rooms and photos will be removed for good.`,
      ok: 'Delete owner',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/admin/owners/${owner.id}`, { method: 'DELETE' });
      toast('Owner deleted', 'ok');
      await reload();
    } catch (err) {
      toast(err.message, 'err');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="panel"><h2>Something went wrong</h2><p className="muted">{error}</p></div>;

  return (
    <>
      <div className="dhead">
        <div>
          <h1>Owners</h1>
          <p>Approve new accounts, suspend, reset passwords.</p>
        </div>
        <div className="acts">
          <button className="btn btn-solid" type="button" onClick={addOwner}>
            <Icon name="plus" />
            Add owner
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 0 }}>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Business</th>
                <th>Phone</th>
                <th className="num">Hostels</th>
                <th>Joined</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((owner) => {
                  const state = STATUS[owner.status] || ['', owner.status];
                  return (
                    <tr key={owner.id}>
                      <td>
                        <div className="who-cell">
                          <span
                            className="avatar sm"
                            style={owner.avatar_url ? { backgroundImage: `url(${owner.avatar_url})` } : undefined}
                          >
                            {owner.avatar_url ? '' : initials(owner.business_name || owner.full_name)}
                          </span>
                          <div>
                            <div className="cell-main">{owner.full_name}</div>
                            <div className="cell-sub">{owner.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="cell-main">{owner.business_name || '-'}</div>
                        <div className="cell-sub">
                          {[owner.campus && `${owner.campus} campus`, owner.location].filter(Boolean).join(' \u00b7 ')}
                        </div>
                      </td>
                      <td>{fmtPhone(owner.phone)}</td>
                      <td className="num">{owner.hostels_count}</td>
                      <td className="cell-sub">{timeAgo(owner.created_at)}</td>
                      <td>
                        <span className={`badge ${state[0]}`}>{state[1]}</span>
                      </td>
                      <td>
                        <div className="row-acts">
                          {owner.status !== 'approved' ? (
                            <button className="btn btn-solid btn-sm" type="button" onClick={() => setStatus(owner, 'approved')}>
                              Approve
                            </button>
                          ) : null}
                          {owner.status === 'approved' ? (
                            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setStatus(owner, 'suspended')}>
                              Suspend
                            </button>
                          ) : null}
                          <button
                            className="btn-icon"
                            type="button"
                            aria-label={`Reset password for ${owner.full_name}`}
                            title="Reset password"
                            onClick={() => resetPassword(owner)}
                          >
                            <Icon name="key" />
                          </button>
                          <button
                            className="btn-icon"
                            type="button"
                            aria-label={`Delete ${owner.full_name}`}
                            onClick={() => remove(owner)}
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="muted" style={{ padding: '28px 10px' }}>
                    No owners yet. Owners sign up from the public site, or add one yourself.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
