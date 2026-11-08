import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FilterPanel from '../components/FilterPanel';
import HostelCard from '../components/HostelCard';
import Icon from '../lib/icons';
import { api, track } from '../lib/api';
import { debounce, fmtMoney, genderLabel } from '../lib/format';

const EMPTY = {
  q: '',
  campus: '',
  area: '',
  min: '',
  max: '',
  type: '',
  gender: '',
  dist: '',
  amen: [],
  sort: 'recommended',
};

const readParams = (params) => ({
  q: params.get('q') || '',
  campus: params.get('campus') || '',
  area: params.get('area') || '',
  min: params.get('min') || '',
  max: params.get('max') || '',
  type: params.get('type') || '',
  gender: params.get('gender') || '',
  dist: params.get('dist') || '',
  amen: (params.get('amen') || '').split(',').filter(Boolean),
  sort: params.get('sort') || 'recommended',
});

function buildParams(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.campus) params.set('campus', state.campus);
  if (state.area) params.set('area', state.area);
  if (state.min) params.set('min', state.min);
  if (state.max) params.set('max', state.max);
  if (state.type) params.set('type', state.type);
  if (state.gender) params.set('gender', state.gender);
  if (state.dist) params.set('dist', state.dist);
  if (state.amen.length) params.set('amen', state.amen.join(','));
  if (state.sort !== 'recommended') params.set('sort', state.sort);
  return params;
}

function buildQuery(state, page) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.campus) params.set('campus', state.campus);
  if (state.area) params.set('area', state.area);
  if (state.min) params.set('minPrice', state.min);
  if (state.max) params.set('maxPrice', state.max);
  if (state.type) params.set('type', state.type);
  if (state.gender) params.set('gender', state.gender);
  if (state.dist) params.set('maxDistance', state.dist);
  if (state.amen.length) params.set('amenities', state.amen.join(','));
  params.set('sort', state.sort);
  params.set('page', page);
  params.set('limit', 12);
  return params.toString();
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState(() => readParams(searchParams));
  const [meta, setMeta] = useState({ amenities: [], roomTypes: [], genders: [], campuses: [], areas: [] });
  const [facets, setFacets] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [heroQ, setHeroQ] = useState(state.q);
  const [heroArea, setHeroArea] = useState(state.area);
  const ticketRef = useRef(0);

  useEffect(() => {
    api('/meta', { auth: false })
      .then((result) => setMeta((current) => ({ ...current, ...result })))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem('buh.visited')) {
      sessionStorage.setItem('buh.visited', '1');
      track('visit');
    }
  }, []);

  const paramString = searchParams.toString();

  useEffect(() => {
    setSearchParams(buildParams(state), { replace: true });
  }, [state, setSearchParams]);

  useEffect(() => {
    if (paramString !== buildParams(state).toString()) {
      const next = readParams(searchParams);
      setState(next);
      setHeroQ(next.q);
      setHeroArea(next.area);
    }
  }, [paramString]);

  useEffect(() => {
    setHeroQ(state.q);
    setHeroArea(state.area);
  }, [state.q, state.area]);

  const load = async (reset, nextPage = 1, currentState = state) => {
    const ticket = ++ticketRef.current;
    if (reset) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await api(`/hostels?${buildQuery(currentState, nextPage)}`, { auth: false });
      if (ticket !== ticketRef.current) return;
      if (reset) {
        setItems(result.items);
        setFacets(result.facets);
      } else {
        setItems((current) => [...current, ...result.items]);
      }
      setTotal(result.total);
      setPage(result.page);
      setPages(result.pages);
    } catch (err) {
      if (ticket !== ticketRef.current) return;
      setError(err.message);
      if (reset) setItems([]);
    } finally {
      if (ticket === ticketRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => load(true, 1, state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  const update = (key, value) => setState((current) => ({ ...current, [key]: value }));

  const reset = () => setState((current) => ({ ...EMPTY, sort: current.sort }));

  const activeFilters = useMemo(() => {
    const result = [];
    if (state.q) result.push({ key: 'q', label: `\u201c${state.q}\u201d` });
    if (state.campus) result.push({ key: 'campus', label: `${state.campus} campus` });
    if (state.area) result.push({ key: 'area', label: state.area });
    if (state.min || state.max) {
      result.push({
        key: 'price',
        label: `${state.min ? fmtMoney(state.min) : 'Any'} \u2013 ${state.max ? fmtMoney(state.max) : 'Any'}`,
      });
    }
    if (state.type) {
      const type = (meta.roomTypes || []).find((item) => item.value === state.type);
      result.push({ key: 'type', label: type ? type.label : state.type });
    }
    if (state.gender) result.push({ key: 'gender', label: genderLabel(state.gender) });
    if (state.dist) result.push({ key: 'dist', label: `Within ${state.dist} km` });
    state.amen.forEach((amenity) => result.push({ key: `amen:${amenity}`, label: amenity }));
    return result;
  }, [state, meta.roomTypes]);

  const clearFilter = (key) => {
    if (key === 'price') setState((current) => ({ ...current, min: '', max: '' }));
    else if (key.startsWith('amen:')) {
      const amenity = key.slice(5);
      setState((current) => ({ ...current, amen: current.amen.filter((item) => item !== amenity) }));
    } else setState((current) => ({ ...current, [key]: '' }));
  };

  const submitHero = (event) => {
    event.preventDefault();
    setState((current) => ({ ...current, q: heroQ.trim(), area: heroArea }));
    if (heroQ.trim()) track('search', { q: heroQ.trim() });
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const areas = (facets && facets.areas) || [];

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">{'Busitema University \u00b7 student housing'}</p>
            <h1>Hostels near campus, with the prices up front.</h1>
            <p className="lede">
              Compare rooms by price and distance, look through real photos, then message the owner on WhatsApp. No more
              asking around for numbers.
            </p>
            <form className="hero-search" role="search" onSubmit={submitHero}>
              <div className="hs-field">
                <Icon name="search" />
                <label className="sr" htmlFor="hq">
                  Hostel name or area
                </label>
                <input
                  id="hq"
                  type="search"
                  placeholder="Hostel name or area"
                  autoComplete="off"
                  value={heroQ}
                  onChange={(event) => setHeroQ(event.target.value)}
                />
              </div>
              <label className="sr" htmlFor="harea">
                Area
              </label>
              <select id="harea" value={heroArea} onChange={(event) => setHeroArea(event.target.value)}>
                <option value="">Any area</option>
                {areas.map((area) => (
                  <option key={area.name} value={area.name}>
                    {area.name} ({area.count})
                  </option>
                ))}
              </select>
              <button className="btn btn-clay" type="submit">
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      <main className="wrap" id="results">
        <div className="browse-grid">
          <FilterPanel
            meta={meta}
            facets={facets}
            state={state}
            onChange={update}
            onReset={reset}
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
          />
          {filtersOpen ? <div className="filter-backdrop" onClick={() => setFiltersOpen(false)} /> : null}

          <section aria-live="polite">
            <div className="results-head">
              <div>
                <h2 id="count">{total === 1 ? '1 hostel' : `${total} hostels`}</h2>
                <div className="chips">
                  {activeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className="chip"
                      onClick={() => clearFilter(filter.key)}
                      aria-label={`Remove filter ${filter.label}`}
                    >
                      {filter.label}
                      <Icon name="close" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="sort">
                <button className="btn btn-ghost btn-sm filter-toggle" type="button" onClick={() => setFiltersOpen(true)}>
                  <Icon name="filter" />
                  Filters
                  {activeFilters.length ? ` (${activeFilters.length})` : ''}
                </button>
                <label>
                  Sort
                  <select value={state.sort} onChange={(event) => update('sort', event.target.value)}>
                    <option value="recommended">Recommended</option>
                    <option value="newest">Newest</option>
                    <option value="price_asc">Price: low to high</option>
                    <option value="price_desc">Price: high to low</option>
                    <option value="distance">Closest to campus</option>
                    <option value="popular">Most viewed</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="grid">
              {loading ? (
                <>
                  <div className="skel skel-card" />
                  <div className="skel skel-card" />
                  <div className="skel skel-card" />
                </>
              ) : error ? (
                <div className="empty-state">
                  <h3>We could not load the hostels</h3>
                  <p>{error}</p>
                  <button className="btn btn-solid" type="button" onClick={() => load(true)}>
                    Try again
                  </button>
                </div>
              ) : items.length ? (
                items.map((hostel) => <HostelCard key={hostel.id} hostel={hostel} />)
              ) : activeFilters.length ? (
                <div className="empty-state">
                  <h3>No hostels match those filters</h3>
                  <p>Try a wider price range, a different room type, or remove a filter.</p>
                  <button className="btn btn-solid" type="button" onClick={reset}>
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="empty-state">
                  <h3>Hostels are being added</h3>
                  <p>
                    Owners are putting their listings up right now. Check back soon, or ask your hostel owner to list on
                    BUhostels.
                  </p>
                  <Link className="btn btn-solid" to="/login?tab=register">
                    List a hostel
                  </Link>
                </div>
              )}
            </div>

            <div className="more">
              {page < pages ? (
                <button className="btn btn-ghost" type="button" onClick={() => load(false, page + 1)}>
                  Show more hostels
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
