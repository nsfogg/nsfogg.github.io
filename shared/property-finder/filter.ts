import { haversineM, METERS_PER_MILE } from './geo.ts';
import type { Listing } from './types.ts';

export type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'dom_asc' | 'water_asc';

// One vocabulary for the URL query string, saved searches (browser and
// property-finder/saved-searches.json) and the Action's alert check.
export interface ListingFilters {
  q?: string;
  min_price?: number;
  max_price?: number;
  min_beds?: number;
  min_baths?: number;
  min_sqft?: number;
  max_sqft?: number;
  min_lot_sqft?: number;
  max_lot_sqft?: number;
  min_year_built?: number;
  max_year_built?: number;
  max_dom?: number;
  property_type?: string[];
  status?: string[];
  waterfront_only?: boolean;
  max_water_m?: number;
  city?: string;
  radius_miles?: number;
  /** Resolved coordinates for `city`, stored so the Action never has to geocode. */
  city_lat?: number;
  city_lng?: number;
  keywords?: string[];
  sort_by?: SortBy;
}

export const DEFAULT_FILTERS: ListingFilters = { status: ['active'], sort_by: 'newest' };

const NUMBER_KEYS = [
  'min_price', 'max_price', 'min_beds', 'min_baths', 'min_sqft', 'max_sqft',
  'min_lot_sqft', 'max_lot_sqft', 'min_year_built', 'max_year_built', 'max_dom',
  'max_water_m', 'radius_miles', 'city_lat', 'city_lng',
] as const;
const LIST_KEYS = ['property_type', 'status', 'keywords'] as const;
const STRING_KEYS = ['q', 'city'] as const;

export function filtersToParams(filters: ListingFilters, params = new URLSearchParams()): URLSearchParams {
  for (const key of [...NUMBER_KEYS, ...STRING_KEYS, ...LIST_KEYS, 'waterfront_only', 'sort_by'] as const) {
    params.delete(key);
  }
  for (const key of NUMBER_KEYS) {
    const v = filters[key];
    if (typeof v === 'number' && Number.isFinite(v)) params.set(key, String(v));
  }
  for (const key of STRING_KEYS) {
    const v = filters[key]?.trim();
    if (v) params.set(key, v);
  }
  for (const key of LIST_KEYS) {
    const values = filters[key] ?? [];
    // Active-only is the default; leave it out of the URL.
    if (key === 'status' && values.length === 1 && values[0] === 'active') continue;
    for (const v of values) params.append(key, v);
  }
  if (filters.waterfront_only) params.set('waterfront_only', 'true');
  if (filters.sort_by && filters.sort_by !== 'newest') params.set('sort_by', filters.sort_by);
  return params;
}

export function paramsToFilters(params: URLSearchParams): ListingFilters {
  const filters: ListingFilters = {};
  for (const key of NUMBER_KEYS) {
    const raw = params.get(key);
    if (raw !== null && raw !== '' && Number.isFinite(Number(raw))) filters[key] = Number(raw);
  }
  for (const key of STRING_KEYS) {
    const raw = params.get(key);
    if (raw) filters[key] = raw;
  }
  for (const key of LIST_KEYS) {
    const values = params.getAll(key).filter(Boolean);
    if (values.length) filters[key] = values;
  }
  if (params.get('waterfront_only') === 'true') filters.waterfront_only = true;
  const sort = params.get('sort_by');
  if (sort) filters.sort_by = sort as SortBy;
  if (!filters.status) filters.status = ['active'];
  return filters;
}

function inRange(value: number | null, min?: number, max?: number): boolean {
  if (min === undefined && max === undefined) return true;
  if (value === null) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

export function matchesFilters(l: Listing, f: ListingFilters): boolean {
  if (f.status?.length && !f.status.includes(l.status)) return false;
  if (!inRange(l.price, f.min_price, f.max_price)) return false;
  if (!inRange(l.beds, f.min_beds)) return false;
  if (!inRange(l.baths, f.min_baths)) return false;
  if (!inRange(l.sqft, f.min_sqft, f.max_sqft)) return false;
  if (!inRange(l.lotSqft, f.min_lot_sqft, f.max_lot_sqft)) return false;
  if (!inRange(l.yearBuilt, f.min_year_built, f.max_year_built)) return false;
  if (!inRange(l.daysOnMarket, undefined, f.max_dom)) return false;
  if (f.property_type?.length && !f.property_type.includes(l.propertyType)) return false;
  if (f.waterfront_only && !l.waterfront) return false;
  if (f.max_water_m !== undefined && (l.waterDistanceM === null || l.waterDistanceM > f.max_water_m)) return false;
  if (f.keywords?.length && !f.keywords.every((k) => l.keywords.includes(k))) return false;
  if (f.radius_miles !== undefined && f.city_lat !== undefined && f.city_lng !== undefined) {
    if (haversineM(f.city_lat, f.city_lng, l.lat, l.lng) > f.radius_miles * METERS_PER_MILE) return false;
  }
  if (f.q) {
    const needle = f.q.toLowerCase();
    const hay = `${l.address} ${l.city} ${l.zip} ${l.description ?? ''} ${l.waterName ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

const byDateDesc = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

export function sortListings(listings: Listing[], sortBy: SortBy = 'newest'): Listing[] {
  const out = [...listings];
  switch (sortBy) {
    case 'price_asc':
      return out.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return out.sort((a, b) => b.price - a.price);
    case 'dom_asc':
      return out.sort((a, b) => (a.daysOnMarket ?? Infinity) - (b.daysOnMarket ?? Infinity));
    case 'water_asc':
      return out.sort((a, b) => (a.waterDistanceM ?? Infinity) - (b.waterDistanceM ?? Infinity));
    default:
      return out.sort((a, b) => byDateDesc(a.listedDate ?? a.firstSeen, b.listedDate ?? b.firstSeen));
  }
}

export function applyFilters(listings: Listing[], filters: ListingFilters): Listing[] {
  return sortListings(
    listings.filter((l) => matchesFilters(l, filters)),
    filters.sort_by,
  );
}

/** True when the city filter is set but its coordinates still need geocoding. */
export function needsGeocode(f: ListingFilters): boolean {
  return Boolean(f.city && f.radius_miles !== undefined && (f.city_lat === undefined || f.city_lng === undefined));
}
