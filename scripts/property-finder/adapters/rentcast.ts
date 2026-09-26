import type { NormalizedListing, PropertyType } from '../../../shared/property-finder/types.ts';
import { isoDate, num, str, type FetchContext, type FetchResult, type ListingSourceAdapter } from './base.ts';

// https://developers.rentcast.io/reference/sale-listings
// Free "Developer" plan: 50 requests/month, up to 500 listings per request.
const BASE_URL = 'https://api.rentcast.io/v1';
export const RENTCAST_PAGE_SIZE = 500;

const PROPERTY_TYPES: Record<string, PropertyType> = {
  'single family': 'single_family',
  condo: 'condo',
  townhouse: 'townhouse',
  'multi-family': 'multi_family',
  manufactured: 'manufactured',
  land: 'land',
};

type RentcastListing = Record<string, unknown> & {
  hoa?: { fee?: unknown } | null;
  listingOffice?: { name?: unknown } | null;
};

export class RentcastAdapter implements ListingSourceAdapter {
  name = 'rentcast';
  demo = false;
  areaIndependent = false;

  constructor(private apiKey: string) {}

  async fetchRaw(ctx: FetchContext): Promise<FetchResult> {
    const raw: unknown[] = [];
    // Skip an area outright rather than half-fetch it: a partial fetch costs
    // calls and still can't tell us which listings went off-market.
    const expectedPages = Math.max(1, Math.ceil((ctx.previousCount + 50) / RENTCAST_PAGE_SIZE));
    if (!ctx.budget.canSpend(expectedPages)) {
      ctx.log(`rentcast: skipping ${ctx.area.name} — needs ~${expectedPages} calls, ${ctx.budget.remaining} left this month`);
      return { raw, complete: false };
    }

    for (let offset = 0; ; offset += RENTCAST_PAGE_SIZE) {
      if (!ctx.budget.canSpend(1)) {
        ctx.log(`rentcast: monthly call budget reached mid-fetch for ${ctx.area.name}`);
        return { raw, complete: false };
      }
      const params = new URLSearchParams({
        city: ctx.area.query.city,
        state: ctx.area.query.state,
        status: 'Active',
        limit: String(RENTCAST_PAGE_SIZE),
        offset: String(offset),
      });
      ctx.budget.spend(1);
      const res = await ctx.fetch(`${BASE_URL}/listings/sale?${params}`, {
        headers: { Accept: 'application/json', 'X-Api-Key': this.apiKey },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`RentCast ${res.status} for ${ctx.area.name}: ${body.slice(0, 300)}`);
      }
      const page = (await res.json()) as unknown[];
      raw.push(...page);
      ctx.log(`rentcast: ${ctx.area.name} offset ${offset} → ${page.length} listings`);
      if (page.length < RENTCAST_PAGE_SIZE) return { raw, complete: true };
    }
  }

  normalize(input: unknown): NormalizedListing | null {
    const r = input as RentcastListing;
    const lat = num(r.latitude);
    const lng = num(r.longitude);
    const price = num(r.price);
    const id = str(r.id);
    if (lat === null || lng === null || price === null || !id) return null;

    const hoaFee = num(r.hoa?.fee);
    const structuredKeywords: string[] = [];
    if (hoaFee === 0) structuredKeywords.push('no_hoa');
    if (str(r.listingType)?.toLowerCase() === 'new construction') structuredKeywords.push('new_construction');

    const status = str(r.status)?.toLowerCase();

    return {
      source: this.name,
      sourceId: id,
      // RentCast doesn't provide a public listing page; the UI links to an address search instead.
      sourceUrl: null,
      address: str(r.formattedAddress) ?? str(r.addressLine1) ?? id,
      city: str(r.city) ?? '',
      state: str(r.state) ?? '',
      zip: str(r.zipCode) ?? '',
      lat,
      lng,
      price,
      beds: num(r.bedrooms),
      baths: num(r.bathrooms),
      sqft: num(r.squareFootage),
      lotSqft: num(r.lotSize),
      yearBuilt: num(r.yearBuilt),
      propertyType: PROPERTY_TYPES[str(r.propertyType)?.toLowerCase() ?? ''] ?? 'other',
      hoaFee,
      listedDate: isoDate(r.listedDate),
      daysOnMarket: num(r.daysOnMarket),
      status: status === 'active' ? 'active' : status === 'pending' ? 'pending' : 'off_market',
      photos: [],
      description: str(r.description),
      listingOffice: str(r.listingOffice?.name),
      structuredKeywords,
    };
  }
}
