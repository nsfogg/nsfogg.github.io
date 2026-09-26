import { describe, expect, it } from 'vitest';
import { applyFilters, filtersToParams, needsGeocode, paramsToFilters, type ListingFilters } from '../../shared/property-finder/filter.ts';
import { extractKeywords } from '../../shared/property-finder/keywords.ts';
import { listing } from './helpers.ts';

const homes = [
  listing({ id: 'a', price: 900_000, beds: 2, waterfront: true, waterDistanceM: 40, waterName: 'Green Lake', keywords: ['dock'], lat: 47.68, lng: -122.34 }),
  listing({ id: 'b', price: 1_500_000, beds: 4, baths: 3, sqft: 3000, propertyType: 'condo', lat: 47.61, lng: -122.33, listedDate: '2026-09-20' }),
  listing({ id: 'c', price: 2_500_000, beds: 5, status: 'off_market', yearBuilt: 2020, lotSqft: 20_000 }),
  listing({ id: 'd', price: 700_000, beds: null, daysOnMarket: 90, lat: 47.3, lng: -122.3 }),
];
const ids = (f: ListingFilters) => applyFilters(homes, f).map((l) => l.id);

describe('applyFilters', () => {
  it('defaults to active listings', () => {
    expect(ids(paramsToFilters(new URLSearchParams()))).toEqual(['b', 'a', 'd']);
  });

  it('filters ranges, excluding unknown values when a bound is set', () => {
    expect(ids({ min_price: 800_000, max_price: 1_600_000 })).toEqual(['b', 'a']);
    expect(ids({ min_beds: 3 })).toEqual(['b', 'c']);
    expect(ids({ max_dom: 30 })).toEqual(['b', 'a', 'c']);
    expect(ids({ min_year_built: 2000 })).toEqual(['c']);
    expect(ids({ min_lot_sqft: 10_000 })).toEqual(['c']);
  });

  it('filters by type, waterfront, keywords and distance to water', () => {
    expect(ids({ property_type: ['condo'] })).toEqual(['b']);
    expect(ids({ waterfront_only: true })).toEqual(['a']);
    expect(ids({ keywords: ['dock'] })).toEqual(['a']);
    expect(ids({ max_water_m: 30 })).toEqual([]);
  });

  it('filters by radius around resolved city coordinates', () => {
    expect(ids({ status: ['active'], city: 'Seattle', radius_miles: 6, city_lat: 47.6062, city_lng: -122.3321 })).toEqual(['b', 'a']);
  });

  it('searches address and water name text', () => {
    expect(ids({ q: 'green lake' })).toEqual(['a']);
  });

  it('sorts', () => {
    expect(ids({ status: ['active'], sort_by: 'price_asc' })).toEqual(['d', 'a', 'b']);
    expect(ids({ status: ['active'], sort_by: 'water_asc' })[0]).toBe('a');
  });
});

describe('URL round-trip', () => {
  it('serializes and parses the same filters', () => {
    const f: ListingFilters = {
      min_price: 500_000,
      property_type: ['condo', 'townhouse'],
      keywords: ['dock'],
      waterfront_only: true,
      city: 'Seattle, WA',
      radius_miles: 10,
      city_lat: 47.6,
      city_lng: -122.3,
      status: ['active'],
      sort_by: 'price_desc',
    };
    expect(paramsToFilters(filtersToParams(f))).toEqual(f);
  });

  it('keeps unrelated params (like the open listing)', () => {
    const params = filtersToParams({ min_beds: 2 }, new URLSearchParams('listing=abc'));
    expect(params.get('listing')).toBe('abc');
  });

  it('knows when a city still needs geocoding', () => {
    expect(needsGeocode({ city: 'Seattle', radius_miles: 5 })).toBe(true);
    expect(needsGeocode({ city: 'Seattle', radius_miles: 5, city_lat: 1, city_lng: 2 })).toBe(false);
  });
});

describe('extractKeywords', () => {
  it('finds amenities in descriptions and keeps structured ones', () => {
    expect(extractKeywords('Lake views, boat lift and a detached ADU.', ['no_hoa'])).toEqual(['adu', 'dock', 'no_hoa', 'view']);
    expect(extractKeywords(null)).toEqual([]);
  });
});
