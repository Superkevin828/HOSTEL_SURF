import { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import PublicLayout from './components/Layout';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Browse from './pages/Browse';
import Hostel from './pages/Hostel';
import { Documentation, Privacy, Terms } from './pages/Legal';
import Owner from './pages/Owner';

const TITLES = {
  '/': 'BUhostels - Hostels near Busitema University',
  '/login': 'Sign in - BUhostels',
  '/terms': 'Terms of Use - BUhostels',
  '/privacy': 'Privacy Policy - BUhostels',
  '/documentation': 'How BUhostels works - BUhostels',
  '/owner': 'Owner dashboard - BUhostels',
  '/admin': 'Admin dashboard - BUhostels',
};

function NotFound() {
  return (
    <main className="wrap" id="app">
      <div className="empty-state" style={{ margin: '64px 0' }}>
        <h3>Page not found</h3>
        <p>The page you are looking for does not exist or has moved.</p>
        <Link className="btn btn-solid" to="/">
          Browse hostels
        </Link>
      </div>
    </main>
  );
}

function RouteEffects() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const path = location.pathname;
    if (path.startsWith('/hostel/')) {
      document.title = 'Hostel - BUhostels';
      return;
    }
    if (path.startsWith('/owner')) {
      document.title = 'Owner dashboard - BUhostels';
      return;
    }
    if (path.startsWith('/admin')) {
      document.title = 'Admin dashboard - BUhostels';
      return;
    }
    document.title = TITLES[path] || 'BUhostels';
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <RouteEffects />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Browse />} />
          <Route path="hostel/:id" element={<Hostel />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="documentation" element={<Documentation />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="login" element={<Auth />} />
        <Route path="owner/*" element={<Owner />} />
        <Route path="admin/*" element={<Admin />} />
      </Routes>
    </>
  );
}
