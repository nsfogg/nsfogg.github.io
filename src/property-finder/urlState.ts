import { useCallback, useEffect, useState } from 'react';
import { filtersToParams, paramsToFilters, type ListingFilters } from '../../shared/property-finder/filter.ts';

// Filters and the open listing live in the query string — shareable,
// bookmarkable, and safe on static hosting (no router, no 404 on refresh).

const read = () => new URLSearchParams(window.location.search);

function write(params: URLSearchParams, push: boolean) {
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (push) window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

export function useUrlState() {
  const [params, setParams] = useState(read);

  useEffect(() => {
    const onPop = () => setParams(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const setFilters = useCallback((filters: ListingFilters) => {
    const next = filtersToParams(filters, read());
    write(next, false);
    setParams(next);
  }, []);

  const setSelected = useCallback((id: string | null) => {
    const next = read();
    if (id) next.set('listing', id);
    else next.delete('listing');
    // Opening a listing is a history entry, so the back button closes it.
    write(next, id !== null && !read().get('listing'));
    setParams(next);
  }, []);

  return {
    filters: paramsToFilters(params),
    selectedId: params.get('listing'),
    setFilters,
    setSelected,
  };
}
