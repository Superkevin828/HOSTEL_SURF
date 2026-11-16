import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../lib/icons';
import { track } from '../lib/api';
import { fmtMoney, genderLabel, initials, waLink, waMessage } from '../lib/format';
import { isSaved, subscribeSaved, toggleSaved } from '../lib/saved';

export default function HostelCard({ hostel }) {
  const href = `/hostel/${encodeURIComponent(hostel.id)}`;
  const full = hostel.rooms_count > 0 && hostel.available_total === 0;
  const where = `${hostel.area}${
    hostel.distance_km != null
      ? ` \u00b7 ${hostel.distance_km} km from ${hostel.campus ? `${hostel.campus} campus` : 'campus'}`
      : ''
  }`;
  const extra = (hostel.amenities || []).slice(0, 3).join(' \u00b7 ');
  const [saved, setSaved] = useState(() => isSaved(hostel.id));

  useEffect(() => {
    setSaved(isSaved(hostel.id));
    return subscribeSaved(() => setSaved(isSaved(hostel.id)));
  }, [hostel.id]);

  const onSave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleSaved(hostel);
  };

  return (
    <article className="hcard">
      <button
        className={`hcard-save${saved ? ' on' : ''}`}
        type="button"
        aria-label={saved ? `Remove ${hostel.name} from saved hostels` : `Save ${hostel.name}`}
        aria-pressed={saved}
        onClick={onSave}
      >
        <Icon name="heart" />
      </button>
      <Link className="hcard-media" to={href} tabIndex={-1} aria-hidden="true">
        {hostel.cover ? (
          <img src={hostel.cover} alt={hostel.name} loading="lazy" />
        ) : (
          <div className="ph">
            <span>{initials(hostel.name)}</span>
          </div>
        )}
        {hostel.featured ? <span className="tag-feat">Featured</span> : null}
        {full ? <span className="tag-full">Full</span> : null}
        {hostel.image_count > 1 ? (
          <span className="photo-count">
            <Icon name="camera" />
            {hostel.image_count}
          </span>
        ) : null}
      </Link>
      <div className="hcard-body">
        <div className="hcard-topline">
          <span className="hcard-gender">{genderLabel(hostel.gender)}</span>
          {hostel.rooms_count ? (
            <span>
              {hostel.rooms_count}
              {hostel.rooms_count === 1 ? ' room type' : ' room types'}
            </span>
          ) : null}
        </div>
        <h3>
          <Link to={href}>{hostel.name}</Link>
        </h3>
        <div className="meta">
          <Icon name="pin" />
          <span>{where}</span>
        </div>
        {extra ? <div className="facts">{extra}</div> : null}
        {hostel.min_price != null ? (
          <div className="price">
            <span className="from">From</span>
            <strong>{fmtMoney(hostel.min_price)}</strong>
            <span className="per">per semester</span>
          </div>
        ) : (
          <div className="price none">Prices not listed yet</div>
        )}
        <div className="hcard-actions">
          <Link className="btn btn-solid btn-sm" to={href}>
            View rooms
          </Link>
          <a
            className="btn btn-ghost btn-sm"
            href={waLink(hostel.whatsapp || hostel.phone, waMessage(hostel.name))}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${hostel.name}`}
            onClick={() => track('whatsapp', { hostel_id: hostel.id })}
          >
            <Icon name="chat" />
            WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}
