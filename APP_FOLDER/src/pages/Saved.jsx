import { Link } from 'react-router-dom';
import HostelCard from '../components/HostelCard';
import Icon from '../lib/icons';
import { clearSaved, getSaved, useSavedIds } from '../lib/saved';

export default function Saved() {
  useSavedIds();
  const items = getSaved();

  return (
    <main className="wrap saved-page" id="app">
      <header className="page-head">
        <p className="eyebrow">Your shortlist</p>
        <h1 className="display glow">Saved rooms.</h1>
        <p className="page-sub">
          {items.length
            ? 'Everything you starred, in one place. Compare prices and message owners when you are ready.'
            : 'Tap the heart on any hostel to keep it here while you compare.'}
        </p>
      </header>
      {items.length ? (
        <>
          <div className="saved-toolbar">
            <span>{items.length === 1 ? '1 hostel saved' : `${items.length} hostels saved`}</span>
            <button className="btn btn-ghost btn-sm" type="button" onClick={clearSaved}>
              Clear all
            </button>
          </div>
          <div className="grid">
            {items.map((hostel) => (
              <HostelCard key={hostel.id} hostel={hostel} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="heart" />
          </span>
          <h3>No saved hostels yet</h3>
          <p>Browse listings and tap the heart on the rooms you like. They will show up here on this device.</p>
          <Link className="btn btn-accent" to="/">
            Explore hostels
          </Link>
        </div>
      )}
    </main>
  );
}
