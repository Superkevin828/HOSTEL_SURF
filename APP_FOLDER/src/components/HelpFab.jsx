import { useEffect, useRef, useState } from 'react';
import Icon from '../lib/icons';
import { waLink, waMessage } from '../lib/format';

const SUPPORT_DIGITS = String(import.meta.env.VITE_SUPPORT_WHATSAPP || '256700000000').replace(/\D/g, '');
const SUPPORT_TEL = String(import.meta.env.VITE_SUPPORT_PHONE || `+${SUPPORT_DIGITS}`);

export default function HelpFab({ hostel = null }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onHelp = () => setOpen(true);
    window.addEventListener('buh:help', onHelp);
    return () => window.removeEventListener('buh:help', onHelp);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const number = hostel ? hostel.whatsapp || hostel.phone : SUPPORT_DIGITS;
  const whatsapp = hostel
    ? waLink(number, waMessage(hostel.name))
    : waLink(SUPPORT_DIGITS, 'Hi BUhostels, I need help finding a hostel near campus.');
  const tel = hostel ? `tel:+${String(hostel.phone || '').replace(/\D/g, '')}` : `tel:${SUPPORT_TEL}`;

  return (
    <div className={`help-fab-wrap${open ? ' open' : ''}`} ref={wrapRef}>
      {open ? (
        <div className="help-panel" role="dialog" aria-label="Contact help">
          <div className="help-panel-head">
            <span className="help-pulse" aria-hidden="true" />
            <h3>Need help?</h3>
            <button className="icon-btn" type="button" aria-label="Close help" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <p className="help-copy">
            {hostel
              ? `Message ${hostel.name} on WhatsApp or call the owner directly.`
              : "WhatsApp us and we'll help you find a room near campus."}
          </p>
          <a className="btn btn-accent btn-block" href={whatsapp} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" />
            {hostel ? 'WhatsApp the owner' : 'WhatsApp us'}
          </a>
          <a className="btn btn-ghost btn-block" href={tel}>
            <Icon name="phone" />
            Call {hostel ? 'the owner' : 'us'}
          </a>
          <p className="help-note">
            {hostel
              ? 'Always inspect the room and agree the price before paying.'
              : 'Free to browse. No booking fees, ever.'}
          </p>
        </div>
      ) : null}
      <button
        className="help-fab"
        type="button"
        aria-label={open ? 'Close help' : 'Need help? Chat with us'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name={open ? 'close' : 'chat'} />
      </button>
    </div>
  );
}
