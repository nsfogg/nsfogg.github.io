import { useEffect, useState } from 'react';
import type { Snapshot } from '../../shared/property-finder/types.ts';

export const DATA_URL = `${import.meta.env.BASE_URL}property-finder/data/listings.json`;

type State = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; snapshot: Snapshot };

/** listings.json is written by the ingest Action and served by GitHub Pages; everything else happens in the browser. */
export function useSnapshot(): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch(DATA_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Couldn't load listings (${res.status}).`);
        return res.json() as Promise<Snapshot>;
      })
      .then((snapshot) => !cancelled && setState({ status: 'ready', snapshot }))
      .catch((err: Error) => !cancelled && setState({ status: 'error', message: err.message }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`;
export const moneyFull = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function relativeDate(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const today = () => new Date().toISOString().slice(0, 10);

export function formatWater(distanceM: number | null, name: string | null): string | null {
  if (distanceM === null) return null;
  const where = name ?? 'the shoreline';
  if (distanceM === 0) return `On ${where}`;
  return `${distanceM < 1000 ? `${distanceM} m` : `${(distanceM / 1000).toFixed(1)} km`} from ${where}`;
}

/** RentCast has no public listing pages, so link to an address search instead. */
export function listingLinks(address: string): { label: string; href: string }[] {
  return [
    { label: 'Zillow', href: `https://www.zillow.com/homes/${encodeURIComponent(address.replace(/\s+/g, '-'))}_rb/` },
    { label: 'Search the web', href: `https://www.google.com/search?q=${encodeURIComponent(`${address} for sale`)}` },
    { label: 'Google Maps', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` },
  ];
}
