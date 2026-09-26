import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { applyFilters, needsGeocode, type ListingFilters } from '../../shared/property-finder/filter.ts';
import type { Listing, Snapshot } from '../../shared/property-finder/types.ts';
import FilterPanel from './components/FilterPanel.tsx';
import ListingDrawer from './components/ListingDrawer.tsx';
import ListingList from './components/ListingList.tsx';
import MapView from './components/MapView.tsx';
import SavedSearchesPanel from './components/SavedSearchesPanel.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import { money, relativeDate, today, useSnapshot } from './data.ts';
import { geocode } from './geocode.ts';
import { loadGitHubConfig, publishAlertSearches } from './github.ts';
import { newMatches, useSavedSearches, type SavedSearch } from './savedSearches.ts';
import { useUrlState } from './urlState.ts';

const LAST_VISIT_KEY = 'pf.lastVisit.v1';

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="pf-sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      <div className="pf-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="pf-sheet-body">{children}</div>
    </dialog>
  );
}

function describe(f: ListingFilters): string {
  const parts = [
    f.waterfront_only && 'Waterfront',
    f.max_price && `≤ ${money(f.max_price)}`,
    f.min_price && `≥ ${money(f.min_price)}`,
    f.min_beds && `${f.min_beds}+ bd`,
    f.city && `near ${f.city.split(',')[0]}`,
    f.q && `“${f.q}”`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'All homes';
}

/** "New" = first seen after your previous visit (never the very first import, when everything is new). */
function useNewIds(listings: Listing[]): Set<string> {
  const [since] = useState(() => localStorage.getItem(LAST_VISIT_KEY) ?? '');
  useEffect(() => {
    if (listings.length) localStorage.setItem(LAST_VISIT_KEY, today());
  }, [listings.length]);
  return useMemo(() => {
    if (!listings.length) return new Set();
    const firstImport = listings.reduce((min, l) => (l.firstSeen < min ? l.firstSeen : min), listings[0].firstSeen);
    const cutoff = since > firstImport ? since : firstImport;
    return new Set(listings.filter((l) => l.firstSeen > cutoff).map((l) => l.id));
  }, [listings, since]);
}

function Finder({ snapshot }: { snapshot: Snapshot }) {
  const { meta, listings } = snapshot;
  const { filters, selectedId, setFilters, setSelected } = useUrlState();
  const saved = useSavedSearches();
  const [view, setView] = useState<'map' | 'list'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheet, setSheet] = useState<'saved' | 'settings' | 'save' | null>(null);
  const [saveName, setSaveName] = useState('');
  const [geo, setGeo] = useState<{ busy: boolean; error: string | null; label: string | null }>({ busy: false, error: null, label: null });
  const [publishState, setPublishState] = useState<string | null>(null);
  const [github, setGithub] = useState(loadGitHubConfig);

  const results = useMemo(() => applyFilters(listings, filters), [listings, filters]);
  const selected = useMemo(() => listings.find((l) => l.id === selectedId) ?? null, [listings, selectedId]);
  const newIds = useNewIds(listings);
  const newInSaved = saved.searches.reduce((n, s) => n + newMatches(s, listings).length, 0);

  const runGeocode = useCallback(
    async (city: string, radius: number, base: ListingFilters) => {
      setGeo({ busy: true, error: null, label: null });
      try {
        const hit = await geocode(city);
        if (!hit) {
          setGeo({ busy: false, error: `Couldn't find “${city}”.`, label: null });
          return;
        }
        setGeo({ busy: false, error: null, label: hit.label.split(',').slice(0, 2).join(',') });
        setFilters({ ...base, city, radius_miles: radius, city_lat: hit.lat, city_lng: hit.lng });
      } catch (err) {
        setGeo({ busy: false, error: (err as Error).message, label: null });
      }
    },
    [setFilters],
  );

  // A shared link can carry a city without coordinates — resolve it once.
  useEffect(() => {
    if (needsGeocode(filters)) void runGeocode(filters.city!, filters.radius_miles!, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applySaved = (s: SavedSearch) => {
    setFilters(s.filters);
    saved.update(s.id, { lastViewed: today() });
    setSelected(null);
    setSheet(null);
  };

  const publish = async () => {
    setPublishState('Publishing…');
    try {
      const n = await publishAlertSearches(github, saved.searches);
      setPublishState(`Published ${n} alert search${n === 1 ? '' : 'es'}. The next refresh will check them.`);
    } catch (err) {
      setPublishState((err as Error).message);
    }
  };

  const onSelect = useCallback((id: string) => setSelected(id), [setSelected]);

  return (
    <div className="pf" data-view={view}>
      <header className="pf-header">
        <a className="pf-back" href="/">
          ‹ Nick Fogg
        </a>
        <div className="pf-heading">
          <h1>Property Finder</h1>
          <p>
            {results.length.toLocaleString('en-US')} of {listings.length.toLocaleString('en-US')} homes · {meta.areas.join(', ') || 'no areas yet'} · updated{' '}
            {relativeDate(meta.generatedAt)}
          </p>
        </div>
        <div className="pf-header-actions">
          <button type="button" className="pf-pill pf-only-mobile" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            Filters
          </button>
          <button type="button" className="pf-pill" onClick={() => setSheet('saved')}>
            Saved{newInSaved > 0 && <span className="pf-count-badge">{newInSaved}</span>}
          </button>
          <button type="button" className="pf-pill" onClick={() => setSheet('settings')} aria-label="Settings">
            ⚙︎
          </button>
        </div>
      </header>

      {meta.demo && (
        <p className="pf-banner" role="note">
          Showing <strong>sample listings</strong> from the SimplyRETS demo feed — not real homes, and not in Seattle — until a RentCast key is added. The waterfront check is real.
        </p>
      )}

      <div className="pf-body">
        <aside className="pf-sidebar" data-open={filtersOpen}>
          <FilterPanel
            filters={filters}
            onChange={setFilters}
            onGeocode={(city, radius) => runGeocode(city, radius, filters)}
            geocodeState={geo}
            resultCount={results.length}
            thresholdM={meta.waterfrontThresholdM}
            onSave={() => {
              setSaveName(describe(filters));
              setSheet('save');
            }}
          />
          <button type="button" className="btn-primary pf-only-mobile pf-show-results" onClick={() => setFiltersOpen(false)}>
            Show {results.length.toLocaleString('en-US')} homes
          </button>
        </aside>

        <div className="pf-mapwrap">
          <MapView listings={results} selectedId={selectedId} onSelect={onSelect} />
        </div>

        <section className="pf-results" aria-label="Results">
          <ListingList listings={results} selectedId={selectedId} onSelect={onSelect} newIds={newIds} />
        </section>

        {selected && <ListingDrawer listing={selected} thresholdM={meta.waterfrontThresholdM} onClose={() => setSelected(null)} />}
      </div>

      <nav className="pf-segmented pf-only-mobile" aria-label="View">
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
          List
        </button>
        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
          Map
        </button>
      </nav>

      {sheet === 'saved' && (
        <Sheet title="Saved searches" onClose={() => setSheet(null)}>
          <SavedSearchesPanel
            searches={saved.searches}
            listings={listings}
            onApply={applySaved}
            onToggleAlert={(s) => saved.update(s.id, { alert: !s.alert })}
            onRemove={(s) => saved.remove(s.id)}
            canPublish={Boolean(github.token)}
            onPublish={publish}
            publishState={publishState}
          />
        </Sheet>
      )}

      {sheet === 'save' && (
        <Sheet title="Save search" onClose={() => setSheet(null)}>
          <form
            className="pf-save-form"
            onSubmit={(e) => {
              e.preventDefault();
              saved.add(saveName.trim() || describe(filters), filters, today());
              setSheet('saved');
            }}
          >
            <label className="pf-field">
              <span>Name</span>
              <input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} />
            </label>
            <p className="pf-help">Saved in this browser. Each visit shows how many matching homes are new.</p>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </form>
        </Sheet>
      )}

      {sheet === 'settings' && (
        <Sheet title="Settings" onClose={() => setSheet(null)}>
          <SettingsPanel meta={meta} onConfigChange={setGithub} />
        </Sheet>
      )}
    </div>
  );
}

export default function App() {
  const state = useSnapshot();
  if (state.status === 'loading') return <p className="pf-status">Loading listings…</p>;
  if (state.status === 'error') return <p className="pf-status">{state.message}</p>;
  if (!state.snapshot.meta.generatedAt) {
    return (
      <div className="pf-status">
        <h1>Property Finder</h1>
        <p>No listings yet — the first refresh hasn’t run. It runs every Monday and Thursday, or can be started from the repository’s Actions tab.</p>
        <a className="text-link" href="/">
          Back to nsfogg.github.io
        </a>
      </div>
    );
  }
  return <Finder snapshot={state.snapshot} />;
}
