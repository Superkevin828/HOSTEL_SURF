import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/api';

function Mark({ to = '/' }) {
  return (
    <Link className="mark" to={to} aria-label="BUhostels home">
      <span className="mark-box">BU</span>
      <em>hostels</em>
    </Link>
  );
}

function Topbar() {
  const { profile, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const signOut = () => {
    logout();
    navigate('/', { replace: true });
  };

  const browse = () => {
    if (location.pathname === '/') {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="topbar">
      <div className="wrap">
        <Mark />
        <nav className="nav" aria-label="Main">
          <Link to="/" className="hide-sm" onClick={browse}>
            Browse
          </Link>
          {isAuthenticated && profile ? (
            <>
              <Link className="nav-cta" to={homeFor(profile.role)}>
                Dashboard
              </Link>
              <button type="button" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login?tab=register" className="hide-sm">
                List your hostel
              </Link>
              <Link className="nav-cta" to="/login">
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div>
          <Mark />
          <p>
            An independent listing site that helps Busitema University students find a place to stay and reach the owner
            directly.
          </p>
        </div>
        <ul>
          <li>
            <Link to="/">Browse hostels</Link>
          </li>
          <li>
            <Link to="/login?tab=register">List your hostel</Link>
          </li>
          <li>
            <Link to="/login">Owner sign in</Link>
          </li>
          <li>
            <Link to="/documentation">How BUhostels works</Link>
          </li>
          <li>
            <Link to="/terms">Terms of Use</Link>
          </li>
          <li>
            <Link to="/privacy">Privacy Policy</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <>
      <Topbar />
      <Outlet />
      <Footer />
    </>
  );
}

export { Mark };
