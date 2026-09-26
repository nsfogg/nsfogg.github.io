import type { Listing, NormalizedListing } from '../../shared/property-finder/types.ts';

export function normalized(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
  return {
    source: 'rentcast',
    sourceId: 'a',
    sourceUrl: null,
    address: '100 Main St, Seattle, WA 98101',
    city: 'Seattle',
    state: 'WA',
    zip: '98101',
    lat: 47.61,
    lng: -122.33,
    price: 1_000_000,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotSqft: 5000,
    yearBuilt: 1950,
    propertyType: 'single_family',
    hoaFee: null,
    listedDate: '2026-09-01',
    daysOnMarket: 10,
    status: 'active',
    photos: [],
    description: null,
    listingOffice: null,
    structuredKeywords: [],
    ...overrides,
  };
}

export function listing(overrides: Partial<Listing> = {}): Listing {
  const { structuredKeywords: _unused, ...base } = normalized();
  return {
    ...base,
    id: 'rentcast:a',
    area: 'Seattle',
    dedupKey: '100 main street|98101',
    mergedSources: [],
    waterfront: false,
    waterDistanceM: null,
    waterName: null,
    keywords: [],
    firstSeen: '2026-09-01',
    lastSeen: '2026-09-01',
    offMarketSince: null,
    priceHistory: [{ date: '2026-09-01', price: 1_000_000 }],
    ...overrides,
  };
}
