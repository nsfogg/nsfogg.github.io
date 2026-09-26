import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ListingFilters, SortBy } from '../../../shared/property-finder/filter.ts';
import { KEYWORD_LABELS } from '../../../shared/property-finder/keywords.ts';
import { typeLabel } from './ListingList.tsx';

const TYPES = ['single_family', 'condo', 'townhouse', 'multi_family', 'manufactured', 'land'];
const ROOMS = [1, 2, 3, 4, 5];
const SQFT_PER_ACRE = 43_560;

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="pf-group">
      <legend>{label}</legend>
      {children}
    </fieldset>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  step,
  scale = 1,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: number;
  scale?: number;
}) {
  return (
    <label className="pf-field">
      <span className="pf-visually-hidden">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        placeholder={label}
        step={step}
        min={0}
        value={value === undefined ? '' : Math.round((value / scale) * 100) / 100}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value) * scale)}
      />
    </label>
  );
}

function Range(props: { min?: number; max?: number; onChange: (min?: number, max?: number) => void; label: string; step?: number; scale?: number }) {
  return (
    <div className="pf-range">
      <NumberInput label={`Min ${props.label}`} value={props.min} step={props.step} scale={props.scale} onChange={(v) => props.onChange(v, props.max)} />
      <span aria-hidden="true">–</span>
      <NumberInput label={`Max ${props.label}`} value={props.max} step={props.step} scale={props.scale} onChange={(v) => props.onChange(props.min, v)} />
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  selected,
  onToggle,
  render,
}: {
  options: T[];
  selected: (v: T) => boolean;
  onToggle: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div className="pf-chips">
      {options.map((o) => (
        <button key={o} type="button" className="pf-chip" aria-pressed={selected(o)} onClick={() => onToggle(o)}>
          {render(o)}
        </button>
      ))}
    </div>
  );
}

const toggleIn = (list: string[] | undefined, v: string) => {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
};

export default function FilterPanel({
  filters,
  onChange,
  onGeocode,
  geocodeState,
  resultCount,
  onSave,
  thresholdM,
}: {
  filters: ListingFilters;
  onChange: (f: ListingFilters) => void;
  onGeocode: (city: string, radius: number) => void;
  geocodeState: { busy: boolean; error: string | null; label: string | null };
  resultCount: number;
  onSave: () => void;
  thresholdM: number;
}) {
  const latest = useRef(filters);
  latest.current = filters;
  const set = (patch: Partial<ListingFilters>) => onChange({ ...latest.current, ...patch });
  const [lotAcres, setLotAcres] = useState(false);
  const [city, setCity] = useState(filters.city ?? '');
  const [radius, setRadius] = useState(filters.radius_miles ?? 5);
  const [q, setQ] = useState(filters.q ?? '');

  useEffect(() => setCity(filters.city ?? ''), [filters.city]);
  // Debounce free-text search so typing doesn't re-filter on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((latest.current.q ?? '') !== q) set({ q: q || undefined });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => setQ(filters.q ?? ''), [filters.q]);

  return (
    <form className="pf-filters" onSubmit={(e) => e.preventDefault()} aria-label="Filters">
      <label className="pf-search">
        <span className="pf-visually-hidden">Search address or neighborhood</span>
        <input type="search" placeholder="Address, zip or lake" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <label className="pf-toggle">
        <input type="checkbox" checked={filters.waterfront_only ?? false} onChange={(e) => set({ waterfront_only: e.target.checked || undefined })} />
        <span className="pf-toggle-track" aria-hidden="true" />
        <span>
          <span className="pf-toggle-title">Waterfront only</span>
          <span className="pf-help">Within {thresholdM} m of a lake, river or the Sound — measured from map shapes, not the listing text.</span>
        </span>
      </label>

      <Group label="Price">
        <Range label="price" min={filters.min_price} max={filters.max_price} step={50_000} onChange={(min_price, max_price) => set({ min_price, max_price })} />
      </Group>

      <Group label="Bedrooms">
        <Chips options={ROOMS} selected={(n) => filters.min_beds === n} onToggle={(n) => set({ min_beds: filters.min_beds === n ? undefined : n })} render={(n) => `${n}+`} />
      </Group>

      <Group label="Bathrooms">
        <Chips options={ROOMS} selected={(n) => filters.min_baths === n} onToggle={(n) => set({ min_baths: filters.min_baths === n ? undefined : n })} render={(n) => `${n}+`} />
      </Group>

      <Group label="Home type">
        <Chips options={TYPES} selected={(t) => filters.property_type?.includes(t) ?? false} onToggle={(t) => set({ property_type: toggleIn(filters.property_type, t) })} render={typeLabel} />
      </Group>

      <Group label="Distance from a place">
        <div className="pf-inline">
          <label className="pf-field pf-grow">
            <span className="pf-visually-hidden">City or address</span>
            <input type="text" placeholder="e.g. Bellevue, WA" value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="pf-field pf-narrow">
            <span className="pf-visually-hidden">Radius in miles</span>
            <input type="number" min={0.5} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
          </label>
          <span className="pf-unit">mi</span>
        </div>
        <div className="pf-inline">
          <button type="button" className="pf-btn" disabled={!city.trim() || geocodeState.busy} onClick={() => onGeocode(city, radius)}>
            {geocodeState.busy ? 'Finding…' : 'Apply'}
          </button>
          {filters.city && (
            <button type="button" className="pf-link" onClick={() => set({ city: undefined, radius_miles: undefined, city_lat: undefined, city_lng: undefined })}>
              Clear
            </button>
          )}
        </div>
        {geocodeState.error && <p className="pf-error">{geocodeState.error}</p>}
        {filters.city_lat !== undefined && geocodeState.label && <p className="pf-help">Within {filters.radius_miles} mi of {geocodeState.label}</p>}
        <p className="pf-help">Straight-line distance. Drive time needs a paid routing API.</p>
      </Group>

      <Group label="Living area (sqft)">
        <Range label="sqft" min={filters.min_sqft} max={filters.max_sqft} step={100} onChange={(min_sqft, max_sqft) => set({ min_sqft, max_sqft })} />
      </Group>

      <Group label={`Lot size (${lotAcres ? 'acres' : 'sqft'})`}>
        <Range
          label="lot"
          min={filters.min_lot_sqft}
          max={filters.max_lot_sqft}
          step={lotAcres ? 0.1 : 500}
          scale={lotAcres ? SQFT_PER_ACRE : 1}
          onChange={(min_lot_sqft, max_lot_sqft) => set({ min_lot_sqft, max_lot_sqft })}
        />
        <button type="button" className="pf-link" onClick={() => setLotAcres((a) => !a)}>
          Use {lotAcres ? 'sqft' : 'acres'}
        </button>
      </Group>

      <Group label="Year built">
        <Range label="year" min={filters.min_year_built} max={filters.max_year_built} onChange={(min_year_built, max_year_built) => set({ min_year_built, max_year_built })} />
      </Group>

      <Group label="Days on market">
        <Chips
          options={[7, 30, 90]}
          selected={(n) => filters.max_dom === n}
          onToggle={(n) => set({ max_dom: filters.max_dom === n ? undefined : n })}
          render={(n) => `≤ ${n} days`}
        />
      </Group>

      <Group label="Features">
        <Chips
          options={Object.keys(KEYWORD_LABELS)}
          selected={(k) => filters.keywords?.includes(k) ?? false}
          onToggle={(k) => set({ keywords: toggleIn(filters.keywords, k) })}
          render={(k) => KEYWORD_LABELS[k]}
        />
        <p className="pf-help">Read from listing descriptions and HOA data, when the source provides them.</p>
      </Group>

      <Group label="Sort">
        <select value={filters.sort_by ?? 'newest'} onChange={(e) => set({ sort_by: e.target.value as SortBy })}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="water_asc">Closest to water</option>
          <option value="dom_asc">Days on market</option>
        </select>
      </Group>

      <div className="pf-filter-actions">
        <button type="button" className="btn-primary" onClick={onSave}>
          Save search
        </button>
        <button type="button" className="pf-link" onClick={() => { setQ(''); onChange({ status: ['active'] }); }}>
          Reset all
        </button>
      </div>
      <p className="pf-help pf-count">{resultCount.toLocaleString('en-US')} homes</p>
    </form>
  );
}
