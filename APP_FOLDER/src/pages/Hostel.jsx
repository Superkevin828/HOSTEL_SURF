import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import HostelCard from '../components/HostelCard';
import { useToast } from '../context/ToastContext';
import Icon from '../lib/icons';
import { api, track } from '../lib/api';
import {
  availability,
  fmtMoney,
  fmtPhone,
  genderLabel,
  initials,
  roomTypeLabel,
  waLink,
  waMessage,
} from '../lib/format';

export default function Hostel() {
  const { id } = useParams();
  const toast = useToast();
  const [hostel, setHostel] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentImage, setCurrentImage] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const mainRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setHostel(null);
    setRelated([]);

    if (!id) {
      setError('That link is missing a hostel.');
      setLoading(false);
      return undefined;
    }

    api(`/hostels/${encodeURIComponent(id)}`, { auth: 'optional' })
      .then((result) => {
        if (cancelled) return;
        setHostel(result.hostel);
        setRelated(result.related || []);
        setCurrentImage(0);
        document.title = `${result.hostel.name} \u2013 BUhostels`;
        if (!sessionStorage.getItem('buh.visited')) {
          sessionStorage.setItem('buh.visited', '1');
          track('visit');
        }
        track('view', { hostel_id: result.hostel.id });
      })
      .catch((err) => {
        if (!cancelled) setError(err.status === 404 ? 'It may have been removed or hidden by the owner.' : err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    document.body.classList.add('has-cta');
    return () => document.body.classList.remove('has-cta');
  }, []);

  useEffect(() => {
    if (lightbox == null || !hostel) return undefined;
    const handler = (event) => {
      if (event.key === 'Escape') setLightbox(null);
      if (event.key === 'ArrowLeft') {
        setLightbox((value) => (value - 1 + hostel.images.length) % hostel.images.length);
      }
      if (event.key === 'ArrowRight') {
        setLightbox((value) => (value + 1) % hostel.images.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox, hostel]);

  if (loading) {
    return (
      <main className="wrap" id="app">
        <div className="skel skel-page" />
      </main>
    );
  }

  if (error || !hostel) {
    return (
      <main className="wrap" id="app">
        <div className="empty-state" style={{ margin: '56px 0' }}>
          <h3>Hostel not found</h3>
          <p>{error}</p>
          <Link className="btn btn-solid" to="/">
            Browse all hostels
          </Link>
        </div>
      </main>
    );
  }

  const prices = hostel.rooms.map((room) => room.price);
  const from = prices.length ? Math.min(...prices) : null;
  const tel = `+${hostel.phone}`;
  const waNumber = hostel.whatsapp || hostel.phone;
  const hidden = hostel.status !== 'published';
  const images = hostel.images || [];
  const selected = images[currentImage] || images[0];

  const share = async () => {
    const base = String(import.meta.env.VITE_PUBLIC_URL || '').replace(/\/+$/, '');
    const url = base ? `${base}/#/hostel/${encodeURIComponent(hostel.id)}` : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${hostel.name} \u2013 BUhostels`, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied', 'ok');
    } catch {
      toast(url);
    }
  };

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(`+${hostel.phone}`);
      toast('Number copied', 'ok');
      track('call', { hostel_id: hostel.id });
    } catch {
      toast(`Copy failed. The number is ${fmtPhone(hostel.phone)}`, 'err');
    }
  };

  const openLightbox = (index) => setLightbox(index);

  return (
    <>
      <main className="wrap" id="app">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Hostels</Link> / <Link to={`/?area=${encodeURIComponent(hostel.area)}`}>{hostel.area}</Link>
        </nav>

        <header className="h-head">
          <div>
            <p className="eyebrow">
              {hostel.area}
              {hostel.distance_km != null
                ? ` \u00b7 ${hostel.distance_km} km from ${hostel.campus ? `${hostel.campus} campus` : 'campus'}`
                : ''}
            </p>
            <h1>{hostel.name}</h1>
            <div className="tags">
              <span className="tag">{genderLabel(hostel.gender)}</span>
              {hostel.featured ? <span className="tag accent">Featured</span> : null}
              {hidden ? <span className="tag bad">Hidden from visitors</span> : null}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={share}>
            <Icon name="share" />
            Share
          </button>
        </header>

        <div className="h-grid">
          <div>
            {images.length ? (
              <>
                <div
                  className="gallery-main"
                  id="gMain"
                  role="button"
                  tabIndex={0}
                  aria-label="Open photo viewer"
                  ref={mainRef}
                  onClick={() => openLightbox(currentImage)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openLightbox(currentImage);
                    }
                  }}
                >
                  <img src={selected.url} alt={`${hostel.name} photo ${currentImage + 1}`} />
                </div>
                {images.length > 1 ? (
                  <div className="thumbs">
                    {images.map((image, index) => (
                      <button
                        key={image.id || index}
                        type="button"
                        aria-label={`Show photo ${index + 1}`}
                        aria-current={index === currentImage ? 'true' : undefined}
                        onClick={() => setCurrentImage(index)}
                      >
                        <img src={image.url} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="gallery-main" style={{ cursor: 'default' }}>
                <div className="ph">
                  <span>{initials(hostel.name)}</span>
                </div>
              </div>
            )}

            <section className="sec">
              <h2>Rooms and prices</h2>
              {hostel.rooms.length ? (
                <div className="rooms">
                  {hostel.rooms.map((room) => {
                    const state = availability(room);
                    return (
                      <div className="room" key={room.id}>
                        <div>
                          <h3>{room.name}</h3>
                          <div className="sub">
                            {roomTypeLabel(room.type)}
                            {room.description ? ` \u00b7 ${room.description}` : ''}
                          </div>
                        </div>
                        <div className="rp">
                          {fmtMoney(room.price)}
                          <small>per semester</small>
                        </div>
                        <div className="act">
                          <span className={`avail ${state.className}`}>{state.label}</span>
                          <br />
                          <a
                            className="link"
                            style={{ fontSize: 14 }}
                            href={waLink(waNumber, waMessage(hostel.name, room))}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => track('whatsapp', { hostel_id: hostel.id })}
                          >
                            Ask about this room
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">The owner has not listed room prices yet. Message them to ask.</p>
              )}
            </section>

            {hostel.description ? (
              <section className="sec">
                <h2>About this hostel</h2>
                <p className="body" style={{ whiteSpace: 'pre-line' }}>
                  {hostel.description}
                </p>
              </section>
            ) : null}

            {hostel.amenities.length ? (
              <section className="sec">
                <h2>What is included</h2>
                <ul className="amen">
                  {hostel.amenities.map((amenity) => (
                    <li key={amenity}>
                      <Icon name="check" />
                      {amenity}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {hostel.address || hostel.latitude != null ? (
              <section className="sec">
                <h2>Where to find it</h2>
                {hostel.address ? <p className="body">{hostel.address}</p> : null}
                {hostel.latitude != null && hostel.longitude != null ? (
                  <a
                    className="btn btn-ghost btn-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps?q=${encodeURIComponent(`${hostel.latitude},${hostel.longitude}`)}`}
                  >
                    Open in Google Maps
                  </a>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside>
            <div className="contact-card">
              <h2>Contact the owner</h2>
              {hostel.business_name || hostel.business_logo ? (
                <div className="biz">
                  <span
                    className="avatar"
                    style={hostel.business_logo ? { backgroundImage: `url(${hostel.business_logo})` } : undefined}
                  >
                    {hostel.business_logo ? '' : initials(hostel.business_name || hostel.name)}
                  </span>
                  <strong>{hostel.business_name || ''}</strong>
                </div>
              ) : null}
              {from != null ? (
                <div className="from-price">
                  <span className="muted">Rooms from</span>
                  <strong>{fmtMoney(from)}</strong>
                  <span className="muted">per semester</span>
                </div>
              ) : null}
              {hostel.contact_name ? (
                <div>
                  <div className="small">Contact person</div>
                  <div style={{ fontWeight: 650 }}>{hostel.contact_name}</div>
                </div>
              ) : null}
              <div>
                <div className="small">Phone</div>
                <div className="num">{fmtPhone(hostel.phone)}</div>
              </div>
              <a
                className="btn btn-clay btn-block"
                target="_blank"
                rel="noopener noreferrer"
                href={waLink(waNumber, waMessage(hostel.name))}
                onClick={() => track('whatsapp', { hostel_id: hostel.id })}
              >
                <Icon name="chat" />
                Message on WhatsApp
              </a>
              <a
                className="btn btn-ghost btn-block"
                href={`tel:${tel}`}
                onClick={() => track('call', { hostel_id: hostel.id })}
              >
                <Icon name="phone" />
                Call
              </a>
              <button className="btn btn-ghost btn-block" type="button" onClick={copyNumber}>
                <Icon name="copy" />
                Copy number
              </button>
              <p className="small">
                Tell them you found the hostel on BUhostels. Always see the room and agree the price before you pay.
              </p>
            </div>
          </aside>
        </div>

        {related.length ? (
          <section className="related">
            <h2>More in {hostel.area}</h2>
            <div className="grid">
              {related.map((item) => (
                <HostelCard key={item.id} hostel={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <div className="cta-bar">
        <a
          className="btn btn-clay"
          target="_blank"
          rel="noopener noreferrer"
          href={waLink(waNumber, waMessage(hostel.name))}
          onClick={() => track('whatsapp', { hostel_id: hostel.id })}
        >
          <Icon name="chat" />
          WhatsApp
        </a>
        <a className="btn btn-ghost" href={`tel:${tel}`} onClick={() => track('call', { hostel_id: hostel.id })}>
          <Icon name="phone" />
          Call
        </a>
      </div>

      {lightbox != null && images.length ? (
        <div className="lightbox-backdrop" onClick={(event) => event.target === event.currentTarget && setLightbox(null)}>
          <div className="lb-wrap">
            <img src={images[lightbox].url} alt={`${hostel.name} photo ${lightbox + 1}`} />
            <button className="lb-btn lb-close" type="button" aria-label="Close" onClick={() => setLightbox(null)}>
              <Icon name="close" />
            </button>
            {images.length > 1 ? (
              <>
                <button
                  className="lb-btn lb-prev"
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => setLightbox((value) => (value - 1 + images.length) % images.length)}
                >
                  <Icon name="left" />
                </button>
                <button
                  className="lb-btn lb-next"
                  type="button"
                  aria-label="Next photo"
                  onClick={() => setLightbox((value) => (value + 1) % images.length)}
                >
                  <Icon name="right" />
                </button>
              </>
            ) : null}
            <span className="lb-count">
              {lightbox + 1} / {images.length}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}
