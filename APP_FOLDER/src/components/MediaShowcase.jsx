import Icon from '../lib/icons';

export default function MediaShowcase({ images = [] }) {
  const gallery = images.filter(Boolean);
  if (!gallery.length) return null;

  return (
    <section className="showcase" aria-label="Hostel photos">
      {gallery[1] ? (
        <div className="showcase-side left" aria-hidden="true">
          <img src={gallery[1]} alt="" loading="lazy" />
        </div>
      ) : null}
      <div className="showcase-main">
        <img src={gallery[0]} alt="A hostel listing on BUhostels" loading="lazy" />
        <div className="showcase-badge">
          <Icon name="camera" />
          Real listings, real photos
        </div>
      </div>
      {gallery[2] ? (
        <div className="showcase-side right" aria-hidden="true">
          <img src={gallery[2]} alt="" loading="lazy" />
        </div>
      ) : null}
    </section>
  );
}
