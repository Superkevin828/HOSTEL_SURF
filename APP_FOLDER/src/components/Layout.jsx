import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/api';
import { useSavedCount } from '../lib/saved';
import Icon from '../lib/icons';
import HelpFab from './HelpFab';

const TICKER = [
  { tag: 'Student housing', text: 'Free to browse' },
  { text: 'Direct owner contact' },
  { text: 'Rated 4.9 by students' },
];

const LINKS = [
  { label: 'Explore', to: '/' },
  { label: 'How it works', to: '/documentation' },
  { label: 'Safety', to: '/documentation', section: 'safety' },
  { label: 'FAQ', to: '/documentation', section: 'faq' },
];

function Mark({ to = '/' }) {
  return (
    <Link className="wordmark" to={to} aria-label="BUhostels home">
      BUHOSTELS
    </Link>
  );
}

function Ticker() {
  const items = (
    <>
      {TICKER.map((item, index) => (
        <span className="ticker-item" key={`${item.text}-${index}`}>
          {item.tag ? <b>{item.tag}</b> : null}
          {item.text}
          <i aria-hidden="true">&#183;</i>
        </span>
      ))}
    </>
  );

  return (
    <div className="ticker" role="status" aria-label="Site highlights">
      <div className="ticker-track">
        {items}
        <span aria-hidden="true" className="ticker-dupe">
          {items}
        </span>
      </div>
    </div>
  );
}

function Topbar({ onSearch, onHelp, onMenu, savedCount }) {
  const { profile, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const goSection = (event, link) => {
    event.preventDefault();
    navigate(link.to, { state: link.section ? { scrollTo: link.section } : undefined });
  };

  return (
    <header className="site-head">
      <Ticker />
      <div className="navbar">
        <div className="wrap nav-inner">
          <Mark />
          <nav className="nav-links" aria-label="Main">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={`#${link.to}`}
                className={!link.section && location.pathname === link.to ? 'on' : undefined}
                onClick={(event) => goSection(event, link)}
              >
                {link.label}
              </a>
            ))}
            <button type="button" className="nav-link-btn" onClick={onHelp}>
              Contact
            </button>
          </nav>
          <div className="nav-actions">
            <button className="icon-btn" type="button" aria-label="Search hostels" onClick={onSearch}>
              <Icon name="search" />
            </button>
            <Link className="icon-btn saved-link" to="/saved" aria-label={`Saved hostels (${savedCount})`}>
              <Icon name="heart" />
              {savedCount ? <span className="count-badge">{savedCount > 99 ? '99+' : savedCount}</span> : null}
            </Link>
            <Link
              className="icon-btn account-link"
              to={isAuthenticated && profile ? homeFor(profile.role) : '/login'}
              aria-label={isAuthenticated ? 'Your dashboard' : 'Sign in'}
            >
              <Icon name="user" />
            </Link>
            <button className="icon-btn menu-btn" type="button" aria-label="Open menu" onClick={onMenu}>
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const openHelp = () => window.dispatchEvent(new Event('buh:help'));

  return (
    <footer className="foot" id="contact">
      <div className="wrap foot-grid">
        <div className="foot-brand">
          <Mark />
          <p>
            An independent listing site that helps Busitema University students find a place to stay and reach the owner
            directly.
          </p>
          <button className="foot-help" type="button" onClick={openHelp}>
            <Icon name="chat" />
            Need help? Talk to us
          </button>
        </div>
        <div className="foot-col">
          <h3>Explore</h3>
          <ul>
            <li>
              <Link to="/">Browse hostels</Link>
            </li>
            <li>
              <Link to="/documentation">How BUhostels works</Link>
            </li>
            <li>
              <Link to="/saved">Saved hostels</Link>
            </li>
          </ul>
        </div>
        <div className="foot-col">
          <h3>Owners</h3>
          <ul>
            <li>
              <Link to="/login?tab=register">List your hostel</Link>
            </li>
            <li>
              <Link to="/login">{isAuthenticated && profile ? 'Owner dashboard' : 'Owner sign in'}</Link>
            </li>
            <li>
              {isAuthenticated ? (
                <button
                  type="button"
                  className="foot-link-btn"
                  onClick={() => {
                    logout();
                    navigate('/', { replace: true });
                  }}
                >
                  Sign out
                </button>
              ) : (
                <Link to="/login">Create an account</Link>
              )}
            </li>
          </ul>
        </div>
        <div className="foot-col">
          <h3>Trust</h3>
          <ul>
            <li>
              <Link to="/terms">Terms of Use</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <button type="button" className="foot-link-btn" onClick={openHelp}>
                Contact
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="wrap foot-base">
        <span>&copy; {new Date().getFullYear()} BUhostels. Built for students.</span>
        <span>Prices in UGX per semester.</span>
      </div>
    </footer>
  );
}

function SearchOverlay({ open, onClose }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 40);
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event) => {
    event.preventDefault();
    const query = value.trim();
    onClose();
    navigate(query ? `/?q=${encodeURIComponent(query)}` : '/');
    setTimeout(() => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  return (
    <div className="search-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form className="search-panel" role="search" onSubmit={submit}>
        <div className="search-panel-head">
          <span>Find a hostel</span>
          <button className="icon-btn" type="button" aria-label="Close search" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="search-panel-field">
          <Icon name="search" />
          <label className="sr-only" htmlFor="site-search">
            Hostel name or area
          </label>
          <input
            id="site-search"
            ref={inputRef}
            type="search"
            placeholder="Hostel name or area, e.g. Sofia"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <button className="btn btn-accent btn-block" type="submit">
          Search hostels
        </button>
      </form>
    </div>
  );
}

function MobileMenu({ open, onClose, onSearch, onHelp }) {
  const { profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    onClose();
  }, [location.pathname, location.search]);

  const goSection = (event, link) => {
    event.preventDefault();
    onClose();
    navigate(link.to, { state: link.section ? { scrollTo: link.section } : undefined });
  };

  if (!open) return null;

  return (
    <div className="menu-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="mobile-menu" aria-label="Menu">
        <div className="mobile-menu-head">
          <Mark />
          <button className="icon-btn" type="button" aria-label="Close menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="mobile-menu-links">
          {LINKS.map((link) => (
            <a key={link.label} href={`#${link.to}`} onClick={(event) => goSection(event, link)}>
              {link.label}
              <Icon name="arrow" />
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              onClose();
              onHelp();
            }}
          >
            Contact
            <Icon name="chat" />
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSearch();
            }}
          >
            Search
            <Icon name="search" />
          </button>
        </nav>
        <div className="mobile-menu-foot">
          <Link to="/saved" onClick={onClose} className="btn btn-ghost btn-block">
            <Icon name="heart" />
            Saved hostels
          </Link>
          {isAuthenticated && profile ? (
            <>
              <Link className="btn btn-accent btn-block" to={homeFor(profile.role)} onClick={onClose}>
                Dashboard
              </Link>
              <button
                className="btn btn-ghost btn-block"
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                  navigate('/', { replace: true });
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link className="btn btn-accent btn-block" to="/login" onClick={onClose}>
              Sign in
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

function TabBar({ onSearch, onHelp }) {
  const location = useLocation();
  const savedCount = useSavedCount();

  return (
    <nav className="tabbar" aria-label="Quick navigation">
      <Link to="/" className={location.pathname === '/' ? 'on' : undefined}>
        <Icon name="home" />
        <span>Explore</span>
      </Link>
      <Link to="/saved" className={location.pathname === '/saved' ? 'on' : undefined}>
        <span className="tab-icon">
          <Icon name="heart" />
          {savedCount ? <span className="count-badge">{savedCount > 99 ? '99+' : savedCount}</span> : null}
        </span>
        <span>Saved</span>
      </Link>
      <button type="button" onClick={onSearch}>
        <Icon name="search" />
        <span>Search</span>
      </button>
      <button type="button" onClick={onHelp}>
        <Icon name="chat" />
        <span>Help</span>
      </button>
    </nav>
  );
}

export default function PublicLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const savedCount = useSavedCount();
  const location = useLocation();
  const onHostel = location.pathname.startsWith('/hostel/');

  const openHelp = () => window.dispatchEvent(new Event('buh:help'));

  return (
    <div className="site-shell">
      <Topbar
        onSearch={() => setSearchOpen(true)}
        onHelp={openHelp}
        onMenu={() => setMenuOpen(true)}
        savedCount={savedCount}
      />
      <Outlet />
      <Footer />
      <TabBar onSearch={() => setSearchOpen(true)} onHelp={openHelp} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSearch={() => setSearchOpen(true)}
        onHelp={openHelp}
      />
      {onHostel ? null : <HelpFab />}
    </div>
  );
}

export { Mark };
