import { useCallback, useEffect, useState } from 'react';
import { matchesFilters, type ListingFilters } from '../../shared/property-finder/filter.ts';
import type { Listing } from '../../shared/property-finder/types.ts';

// Saved searches live in this browser. The ones with `alert` on can also be
// published to property-finder/saved-searches.json (Settings → GitHub), where
// the ingest Action checks them for new matches and posts to Discord.

export interface SavedSearch {
  id: string;
  name: string;
  filters: ListingFilters;
  alert: boolean;
  createdAt: string;
  /** YYYY-MM-DD — listings first seen after this count as "new". */
  lastViewed: string;
}

const KEY = 'pf.savedSearches.v1';

function load(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSearch[];
  } catch {
    return [];
  }
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(searches));
    } catch {
      /* private mode — searches last for this visit only */
    }
  }, [searches]);

  const add = useCallback((name: string, filters: ListingFilters, lastViewed: string) => {
    const search: SavedSearch = {
      id: crypto.randomUUID(),
      name,
      filters,
      alert: false,
      createdAt: new Date().toISOString(),
      lastViewed,
    };
    setSearches((prev) => [search, ...prev]);
    return search;
  }, []);

  const update = useCallback((id: string, patch: Partial<SavedSearch>) => {
    setSearches((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const remove = useCallback((id: string) => setSearches((prev) => prev.filter((s) => s.id !== id)), []);

  return { searches, add, update, remove };
}

/** Active listings matching the search that were first seen after its last view. */
export function newMatches(search: SavedSearch, listings: Listing[]): Listing[] {
  return listings.filter((l) => l.status === 'active' && l.firstSeen > search.lastViewed && matchesFilters(l, search.filters));
}
