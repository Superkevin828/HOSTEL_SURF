(function () {
  'use strict';

  const topbar = document.getElementById('topbar');
  if (topbar) {
    const setStuck = () => topbar.classList.toggle('is-stuck', window.scrollY > 6);
    setStuck();
    window.addEventListener('scroll', setStuck, { passive: true });
  }

  const navMenuToggle = document.getElementById('navMenuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (navMenuToggle && mobileNav) {
    const mobileNavQuery = window.matchMedia('(max-width: 900px)');
    const setNavMenu = (open) => {
      mobileNav.hidden = !open;
      navMenuToggle.setAttribute('aria-expanded', String(open));
      navMenuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    };

    navMenuToggle.addEventListener('click', () => setNavMenu(mobileNav.hidden));
    mobileNav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setNavMenu(false);
    });
    document.addEventListener('click', (event) => {
      if (mobileNav.hidden || mobileNav.contains(event.target) || navMenuToggle.contains(event.target)) return;
      setNavMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !mobileNav.hidden) {
        setNavMenu(false);
        navMenuToggle.focus();
      }
    });
    const closeOnDesktop = (event) => {
      if (!event.matches) setNavMenu(false);
    };
    if (typeof mobileNavQuery.addEventListener === 'function') {
      mobileNavQuery.addEventListener('change', closeOnDesktop);
    } else {
      mobileNavQuery.addListener(closeOnDesktop);
    }
  }

  const navSearch = document.getElementById('navSearch');
  const heroInput = document.getElementById('hq');
  if (navSearch && heroInput) {
    navSearch.addEventListener('click', () => {
      heroInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => heroInput.focus({ preventScroll: true }), 260);
    });
  }

  const filters = document.getElementById('filters');
  const closeFilters = document.getElementById('closeFilters');
  const scrim = document.getElementById('filterScrim');
  if (filters && closeFilters && scrim) {
    const syncScrim = () => {
      scrim.hidden = !filters.classList.contains('open');
    };
    new MutationObserver(syncScrim).observe(filters, {
      attributes: true,
      attributeFilter: ['class'],
    });
    syncScrim();
    scrim.addEventListener('click', () => closeFilters.click());
  }

  const helpBtn = document.getElementById('helpBtn');
  const helpPop = document.getElementById('helpPop');
  const setHelp = (open) => {
    if (!helpBtn || !helpPop) return;
    helpPop.hidden = !open;
    helpBtn.setAttribute('aria-expanded', String(open));
    helpBtn.setAttribute('aria-label', open ? 'Close help' : 'Open help');
  };
  if (helpBtn && helpPop) {
    helpBtn.addEventListener('click', () => setHelp(helpPop.hidden));
    document.addEventListener('click', (e) => {
      if (helpPop.hidden) return;
      if (helpPop.contains(e.target) || helpBtn.contains(e.target)) return;
      setHelp(false);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (helpPop && !helpPop.hidden) setHelp(false);
    if (filters && filters.classList.contains('open') && closeFilters) closeFilters.click();
  });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduceMotion) return;

  document.body.classList.add('reveal-ready');

  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        reveal.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -36px 0px' }
  );

  const watch = (el) => {
    if (!el.classList.contains('is-in')) reveal.observe(el);
  };

  document.querySelectorAll('[data-reveal]').forEach(watch);

  const grid = document.getElementById('grid');
  if (grid) {
    grid.querySelectorAll('.hcard:not(.is-in)').forEach(watch);
    new MutationObserver(() => {
      grid.querySelectorAll('.hcard:not(.is-in)').forEach(watch);
    }).observe(grid, { childList: true });
  }
})();
