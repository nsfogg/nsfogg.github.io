import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RentcastAdapter } from '../../scripts/property-finder/adapters/rentcast.ts';
import { SimplyRetsDemoAdapter } from '../../scripts/property-finder/adapters/simplyrets.ts';
import { activeAdapters } from '../../scripts/property-finder/adapters/registry.ts';
import { Budget } from '../../scripts/property-finder/budget.ts';
import { fixtureFetch } from '../../scripts/property-finder/fixtures/fetch.ts';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../scripts/property-finder/fixtures/${name}`, import.meta.url), 'utf8'));

const seattle = { name: 'Seattle', enabled: true, query: { city: 'Seattle', state: 'WA' } };

describe('RentcastAdapter', () => {
  const adapter = new RentcastAdapter('key');

  it('normalizes a sale listing', () => {
    const raw = fixture('rentcast-seattle.json').find((r: { _neighborhood: string }) => r._neighborhood === 'Ballard');
    const l = adapter.normalize(raw)!;
    expect(l).toMatchObject({
      source: 'rentcast',
      address: '6100 Sample 24th Ave NW, Seattle, WA 98107',
      city: 'Seattle',
      zip: '98107',
      price: 899000,
      beds: 3,
      baths: 2.5,
      propertyType: 'townhouse',
      hoaFee: 0,
      status: 'active',
      listedDate: '2026-08-27',
      sourceUrl: null,
    });
    expect(l.structuredKeywords).toEqual(['no_hoa', 'new_construction']);
  });

  it('skips records without coordinates', () => {
    expect(adapter.normalize({ id: 'x', price: 1 })).toBeNull();
  });

  it('pages until a short page and spends one call per request', async () => {
    const budget = new Budget(undefined, 45);
    const result = await adapter.fetchRaw({ area: seattle, budget, fetch: fixtureFetch, log: () => {}, previousCount: 0 });
    expect(result.complete).toBe(true);
    expect(result.raw).toHaveLength(28);
    expect(budget.callsUsed).toBe(1);
  });

  it('skips an area it cannot afford to fetch completely', async () => {
    const budget = new Budget({ month: new Date().toISOString().slice(0, 7), callsUsed: 44 }, 45);
    const result = await adapter.fetchRaw({ area: seattle, budget, fetch: fixtureFetch, log: () => {}, previousCount: 1200 });
    expect(result).toEqual({ raw: [], complete: false });
    expect(budget.callsUsed).toBe(44);
  });
});

describe('SimplyRetsDemoAdapter', () => {
  const adapter = new SimplyRetsDemoAdapter();

  it('normalizes the demo shape', () => {
    const [raw] = fixture('simplyrets-sample.json');
    const l = adapter.normalize(raw)!;
    expect(l).toMatchObject({
      source: 'simplyrets-demo',
      sourceId: '1005192',
      lat: 29.689418,
      lng: -95.474464,
      baths: 4.5,
      lotSqft: null, // the demo feed sends "0-.49 Acres"
      propertyType: 'condo',
      status: 'active',
      listedDate: '2011-05-23',
    });
    expect(l.photos).toHaveLength(1);
    expect(l.structuredKeywords).toEqual(['no_hoa']);
  });

  it('drops records without coordinates', () => {
    expect(adapter.normalize(fixture('simplyrets-sample.json')[1])).toBeNull();
  });
});

describe('activeAdapters', () => {
  it('uses RentCast when the key is set, the demo feed otherwise', () => {
    expect(activeAdapters({ RENTCAST_API_KEY: 'abc' }).map((a) => a.name)).toEqual(['rentcast']);
    expect(activeAdapters({}).map((a) => a.name)).toEqual(['simplyrets-demo']);
  });
});

describe('Budget', () => {
  it('resets when the month changes', () => {
    const b = new Budget({ month: '2026-08', callsUsed: 40 }, 45, new Date('2026-09-02'));
    expect(b.callsUsed).toBe(0);
    expect(b.month).toBe('2026-09');
  });

  it('refuses calls past the limit', () => {
    const b = new Budget({ month: '2026-09', callsUsed: 44 }, 45, new Date('2026-09-20'));
    expect(b.canSpend(1)).toBe(true);
    expect(b.canSpend(2)).toBe(false);
  });
});
