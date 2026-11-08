import { Link } from 'react-router-dom';
import Icon from '../lib/icons';
import { track } from '../lib/api';
import { fmtMoney, genderLabel, initials, waLink, waMessage } from '../lib/format';

export default function HostelCard({ hostel }) {
  const href = `/hostel/${encodeURIComponent(hostel.id)}`;
  const full = hostel.rooms_count > 0 && hostel.available_total === 0;
  const where = `${hostel.area}${
    hostel.distance_km != null
      ? ` \u00b7 ${hostel.distance_km} km from ${hostel.campus ? `${hostel.campus} campus` : 'campus'}`
      : ''
  }`;
  const extra = (hostel.amenities || []).slice(0, 3).join(' \u00b7 ');

  return (
    <article className="hcard">
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
        <h3>
          <Link to={href}>{hostel.name}</Link>
        </h3>
        <div className="meta">
          <Icon name="pin" />
          <span>{where}</span>
        </div>
        <div className="facts">
          <b>{genderLabel(hostel.gender)}</b>
          {hostel.rooms_count ? ` \u00b7 ${hostel.rooms_count}${hostel.rooms_count === 1 ? ' room type' : ' room types'}` : ''}
          {extra ? <br /> : null}
          {extra}
        </div>
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
            className="btn btn-wa btn-sm"
            href={waLink(hostel.whatsapp || hostel.phone, waMessage(hostel.name))}
            target="_blank"
            rel="noopener noreferrer"
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
