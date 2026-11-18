(function () {
  'use strict';

  const dash = document.querySelector('.dash');
  const side = document.getElementById('side');
  const toggle = document.getElementById('sideToggle');
  const backdrop = document.querySelector('.side-backdrop');
  if (!dash || !side || !toggle || !backdrop) return;

  const mobileQuery = window.matchMedia('(max-width: 860px)');
  const storageKey = 'buh.side';
  const readDesktopState = () => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === null ? true : stored === 'open';
    } catch (error) {
      return true;
    }
  };
  let desktopOpen = readDesktopState();

  const setOpen = (open, mobile, restoreFocus) => {
    toggle.setAttribute('aria-expanded', String(open));
    side.setAttribute('aria-hidden', String(!open));
    side.inert = !open;
    dash.classList.toggle('drawer-open', mobile && open);
    dash.classList.toggle('side-collapsed', !mobile && !open);
    document.body.classList.toggle('side-drawer-open', mobile && open);

    if (mobile && open) {
      const firstLink = side.querySelector('nav a[href]') || side.querySelector('a[href]');
      if (firstLink) firstLink.focus();
    } else if (mobile && !open && restoreFocus) {
      toggle.focus();
    }
  };

  const applyViewportState = () => {
    if (mobileQuery.matches) {
      setOpen(false, true, false);
    } else {
      desktopOpen = readDesktopState();
      setOpen(desktopOpen, false, false);
    }
  };

  toggle.addEventListener('click', () => {
    if (mobileQuery.matches) {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      setOpen(open, true, false);
      return;
    }

    desktopOpen = !desktopOpen;
    setOpen(desktopOpen, false, false);
    try {
      window.localStorage.setItem(storageKey, desktopOpen ? 'open' : 'closed');
    } catch (error) {
      // Storage may be unavailable in private browsing.
    }
  });

  backdrop.addEventListener('click', () => setOpen(false, true, true));
  side.querySelector('nav').addEventListener('click', (event) => {
    if (event.target.closest('a') && mobileQuery.matches) setOpen(false, true, true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileQuery.matches && dash.classList.contains('drawer-open')) {
      setOpen(false, true, true);
    }
  });

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', applyViewportState);
  } else {
    mobileQuery.addListener(applyViewportState);
  }
  applyViewportState();
})();
