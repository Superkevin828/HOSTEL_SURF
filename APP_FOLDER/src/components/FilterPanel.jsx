import Icon from '../lib/icons';

export default function FilterPanel({ meta, facets, state, onChange, onReset, open, onClose }) {
  const campuses = facets && facets.campuses && facets.campuses.length
    ? facets.campuses
    : (meta.campuses || []).map((name) => ({ name }));
  const areas = (facets && facets.areas) || [];
  const roomTypes = meta.roomTypes || [];
  const genders = meta.genders || [];
  const amenities = meta.amenities || [];
  const minPlaceholder = facets && facets.price ? `Min \u00b7 ${Number(facets.price.min).toLocaleString('en-US')}` : 'Min';
  const maxPlaceholder = facets && facets.price ? `Max \u00b7 ${Number(facets.price.max).toLocaleString('en-US')}` : 'Max';

  const setAmenity = (amenity, checked) => {
    const next = checked ? [...state.amen, amenity] : state.amen.filter((item) => item !== amenity);
    onChange('amen', next);
  };

  return (
    <aside className={`filters ${open ? 'open' : ''}`} aria-label="Filters">
      <div className="filters-head">
        <h2>Filters</h2>
        <button className="link" type="button" onClick={onReset}>
          Reset
        </button>
        <button className="close-filters" type="button" aria-label="Close filters" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <div className="f-group">
        <label htmlFor="fq">Name or area</label>
        <input
          id="fq"
          type="search"
          placeholder="e.g. Nagongera"
          autoComplete="off"
          value={state.q}
          onChange={(event) => onChange('q', event.target.value)}
        />
      </div>

      <div className="f-group">
        <label htmlFor="fcampus">Campus</label>
        <select id="fcampus" value={state.campus} onChange={(event) => onChange('campus', event.target.value)}>
          <option value="">Any campus</option>
          {campuses.map((campus) => (
            <option key={campus.name} value={campus.name}>
              {campus.name} campus{campus.count != null ? ` (${campus.count})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="f-group">
        <label htmlFor="farea">Area</label>
        <select id="farea" value={state.area} onChange={(event) => onChange('area', event.target.value)}>
          <option value="">Any area</option>
          {areas.map((area) => (
            <option key={area.name} value={area.name}>
              {area.name} ({area.count})
            </option>
          ))}
        </select>
      </div>

      <div className="f-group">
        <span className="f-label">Price per semester (UGX)</span>
        <div className="range">
          <input
            id="fmin"
            type="number"
            inputMode="numeric"
            min="0"
            step="10000"
            placeholder={minPlaceholder}
            aria-label="Minimum price"
            value={state.min}
            onChange={(event) => onChange('min', event.target.value)}
          />
          <span>to</span>
          <input
            id="fmax"
            type="number"
            inputMode="numeric"
            min="0"
            step="10000"
            placeholder={maxPlaceholder}
            aria-label="Maximum price"
            value={state.max}
            onChange={(event) => onChange('max', event.target.value)}
          />
        </div>
      </div>

      <div className="f-group">
        <span className="f-label">Room type</span>
        <div className="pills">
          <button
            type="button"
            className="pill"
            aria-pressed={state.type === ''}
            onClick={() => onChange('type', '')}
          >
            Any
          </button>
          {roomTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              className="pill"
              aria-pressed={state.type === type.value}
              onClick={() => onChange('type', type.value)}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="f-group">
        <span className="f-label">Who it is for</span>
        <div className="pills">
          <button
            type="button"
            className="pill"
            aria-pressed={state.gender === ''}
            onClick={() => onChange('gender', '')}
          >
            Any
          </button>
          {genders.map((gender) => (
            <button
              key={gender.value}
              type="button"
              className="pill"
              aria-pressed={state.gender === gender.value}
              onClick={() => onChange('gender', gender.value)}
            >
              {gender.label}
            </button>
          ))}
        </div>
      </div>

      <div className="f-group">
        <label htmlFor="fdist">Distance from campus</label>
        <select id="fdist" value={state.dist} onChange={(event) => onChange('dist', event.target.value)}>
          <option value="">Any distance</option>
          <option value="0.5">Within 0.5 km</option>
          <option value="1">Within 1 km</option>
          <option value="2">Within 2 km</option>
          <option value="5">Within 5 km</option>
        </select>
      </div>

      <div className="f-group">
        <span className="f-label">Amenities</span>
        <div className="checks">
          {amenities.map((amenity) => (
            <label className="check" key={amenity}>
              <input
                type="checkbox"
                value={amenity}
                checked={state.amen.includes(amenity)}
                onChange={(event) => setAmenity(amenity, event.target.checked)}
              />
              <span>{amenity}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filters-foot">
        <button className="btn btn-solid btn-block" type="button" onClick={onClose}>
          Show results
        </button>
      </div>
    </aside>
  );
}
