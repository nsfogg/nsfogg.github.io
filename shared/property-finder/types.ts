// Shared by the page (src/property-finder) and the ingest script
// (scripts/property-finder). Keep this file free of Node and DOM APIs.

export type PropertyType =
  | 'single_family'
  | 'condo'
  | 'townhouse'
  | 'multi_family'
  | 'manufactured'
  | 'land'
  | 'other';

export type ListingStatus = 'active' | 'pending' | 'off_market';

/** What an adapter produces from one raw source record. */
export interface NormalizedListing {
  source: string;
  sourceId: string;
  /** Link to the listing on the source, when the source has one. */
  sourceUrl: string | null;

  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;

  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: PropertyType;
  hoaFee: number | null;

  listedDate: string | null; // YYYY-MM-DD
  daysOnMarket: number | null;
  status: ListingStatus;

  photos: string[];
  description: string | null;
  listingOffice: string | null;

  /** Amenity keys the adapter can infer from structured fields (e.g. hoaFee === 0 → no_hoa). */
  structuredKeywords: string[];
}

export interface PricePoint {
  date: string; // YYYY-MM-DD
  price: number;
}

/** A listing as published in listings.json. */
export interface Listing extends Omit<NormalizedListing, 'structuredKeywords'> {
  id: string; // `${source}:${sourceId}`
  area: string;
  dedupKey: string;
  mergedSources: string[];

  /** Geometry-derived: within the threshold of an OpenStreetMap lake, river or coastline. */
  waterfront: boolean;
  /** Distance to the nearest water edge in metres (0 = inside the water, e.g. a houseboat), null if none nearby. */
  waterDistanceM: number | null;
  waterName: string | null;

  /** Amenity keys found in the description or structured fields. */
  keywords: string[];

  firstSeen: string; // YYYY-MM-DD
  lastSeen: string; // YYYY-MM-DD
  offMarketSince: string | null;
  priceHistory: PricePoint[];
}

export interface RunSummary {
  status: 'success' | 'partial' | 'skipped' | 'failed';
  startedAt: string;
  fetched: number;
  created: number;
  updated: number;
  offMarket: number;
  alertsSent: number;
  notes: string[];
}

export interface SnapshotMeta {
  generatedAt: string | null;
  /** True when listings come from the SimplyRETS demo feed (fake data). */
  demo: boolean;
  sources: string[];
  areas: string[];
  waterfrontThresholdM: number;
  budget: { month: string; callsUsed: number; limit: number };
  lastRun: RunSummary | null;
}

export interface Snapshot {
  meta: SnapshotMeta;
  listings: Listing[];
}
