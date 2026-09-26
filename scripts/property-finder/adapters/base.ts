import type { NormalizedListing } from '../../../shared/property-finder/types.ts';
import type { Budget } from '../budget.ts';

export interface Area {
  name: string;
  enabled: boolean;
  /** Source-agnostic location query; each adapter maps it to its own API params. */
  query: { city: string; state: string };
}

export interface FetchContext {
  area: Area;
  budget: Budget;
  fetch: typeof fetch;
  log: (message: string) => void;
  /** Listings this source returned for the area last run — used to estimate how many pages a fetch will take. */
  previousCount: number;
}

export interface FetchResult {
  raw: unknown[];
  /** False when the fetch stopped early (budget, error). Missing listings are then NOT marked off-market. */
  complete: boolean;
}

/**
 * Contract every listing source implements. Adding a source means writing one
 * of these and registering it in registry.ts — ingest, dedup, waterfront,
 * alerts and the page don't change.
 */
export interface ListingSourceAdapter {
  name: string;
  /** Fake/sample data — the page shows a "demo data" banner. */
  demo: boolean;
  /** True when one fetch returns the whole feed regardless of area (the SimplyRETS demo). */
  areaIndependent: boolean;
  fetchRaw(ctx: FetchContext): Promise<FetchResult>;
  /** Map one raw record to the common schema, or null to skip it (e.g. no coordinates). */
  normalize(raw: unknown): NormalizedListing | null;
}

export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const isoDate = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
