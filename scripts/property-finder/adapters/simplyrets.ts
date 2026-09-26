import type { NormalizedListing, PropertyType } from '../../../shared/property-finder/types.ts';
import { isoDate, num, str, type FetchContext, type FetchResult, type ListingSourceAdapter } from './base.ts';

// SimplyRETS' public demo feed — documented sandbox credentials, no signup.
// The listings are sample data (not real homes and not in Seattle), so the
// page shows a "demo data" banner while this source is active.
const BASE_URL = 'https://api.simplyrets.com';
const DEMO_AUTH = 'Basic ' + Buffer.from('simplyrets:simplyrets').toString('base64');
const PAGE_SIZE = 500;

const SUBTYPES: Record<string, PropertyType> = {
  singlefamilyresidence: 'single_family',
  condominium: 'condo',
  townhouse: 'townhouse',
  multifamily: 'multi_family',
  manufacturedhome: 'manufactured',
};

type Raw = Record<string, unknown> & {
  address?: Record<string, unknown>;
  geo?: Record<string, unknown>;
  property?: Record<string, unknown>;
  mls?: Record<string, unknown>;
  office?: Record<string, unknown>;
  association?: Record<string, unknown>;
};

export class SimplyRetsDemoAdapter implements ListingSourceAdapter {
  name = 'simplyrets-demo';
  demo = true;
  areaIndependent = true;

  async fetchRaw(ctx: FetchContext): Promise<FetchResult> {
    const raw: unknown[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const res = await ctx.fetch(`${BASE_URL}/properties?limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { Accept: 'application/json', Authorization: DEMO_AUTH },
      });
      if (!res.ok) throw new Error(`SimplyRETS ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
      const page = (await res.json()) as unknown[];
      raw.push(...page);
      ctx.log(`simplyrets-demo: offset ${offset} → ${page.length} listings`);
      if (page.length < PAGE_SIZE) return { raw, complete: true };
    }
  }

  normalize(input: unknown): NormalizedListing | null {
    const r = input as Raw;
    const address = r.address ?? {};
    const geo = r.geo ?? {};
    const property = r.property ?? {};
    const mls = r.mls ?? {};

    const lat = num(geo.lat);
    const lng = num(geo.lng);
    const price = num(r.listPrice);
    const id = r.mlsId ?? r.listingId;
    if (lat === null || lng === null || price === null || id === undefined || id === null) return null;

    const full = num(property.bathsFull) ?? 0;
    const half = num(property.bathsHalf) ?? 0;
    const baths = num(property.bathrooms) ?? (full || half ? full + half * 0.5 : null);

    const subType = (str(property.subType) ?? '').toLowerCase().replace(/[\s_]/g, '');
    const type = (str(property.type) ?? '').toLowerCase();
    const status = (str(mls.status) ?? '').toLowerCase();
    const hoaFee = num(r.association?.fee);

    return {
      source: this.name,
      sourceId: String(id),
      sourceUrl: null,
      address: str(address.full) ?? str(address.streetName) ?? String(id),
      city: str(address.city) ?? '',
      state: str(address.state) ?? '',
      zip: str(address.postalCode) ?? '',
      lat,
      lng,
      price,
      beds: num(property.bedrooms),
      baths,
      sqft: num(property.area),
      lotSqft: num(property.lotSize),
      yearBuilt: num(property.yearBuilt),
      propertyType: SUBTYPES[subType] ?? (type === 'land' ? 'land' : 'other'),
      hoaFee,
      listedDate: isoDate(r.listDate),
      daysOnMarket: num(mls.daysOnMarket),
      status: status === 'active' ? 'active' : status.includes('pending') || status.includes('contract') ? 'pending' : 'off_market',
      photos: Array.isArray(r.photos) ? r.photos.filter((p): p is string => typeof p === 'string') : [],
      description: str(r.remarks),
      listingOffice: str(r.office?.name) ?? str(r.office?.brokerid),
      structuredKeywords: hoaFee === 0 ? ['no_hoa'] : [],
    };
  }
}
