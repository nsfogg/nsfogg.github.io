import { describe, expect, it } from 'vitest';
import { dedupKey, normalizeStreet } from '../../scripts/property-finder/dedup.ts';
import { mergeSnapshot } from '../../scripts/property-finder/merge.ts';
import { listing, normalized } from './helpers.ts';

const opts = { today: '2026-09-26', activeSources: ['rentcast'], dropAfterDays: 21 };

describe('dedup', () => {
  it('normalizes abbreviations and drops the city part', () => {
    expect(normalizeStreet('100 NE Main St., Seattle, WA')).toBe('100 northeast main street');
    expect(dedupKey({ address: '100 N Main Ave', zip: '98101-1234' })).toBe('100 north main avenue|98101');
  });
});

describe('mergeSnapshot', () => {
  it('adds new listings with first-seen and price history', () => {
    const r = mergeSnapshot([], [{ source: 'rentcast', area: 'Seattle', complete: true, listings: [normalized({ description: 'Private dock' })] }], opts);
    expect(r.created).toHaveLength(1);
    expect(r.listings[0]).toMatchObject({ id: 'rentcast:a', firstSeen: '2026-09-26', keywords: ['dock'] });
    expect(r.listings[0].priceHistory).toEqual([{ date: '2026-09-26', price: 1_000_000 }]);
  });

  it('records price drops on re-seen listings', () => {
    const r = mergeSnapshot([listing()], [{ source: 'rentcast', area: 'Seattle', complete: true, listings: [normalized({ price: 950_000 })] }], opts);
    expect(r.created).toHaveLength(0);
    expect(r.priceDrops).toHaveLength(1);
    expect(r.listings[0].priceHistory.at(-1)).toEqual({ date: '2026-09-26', price: 950_000 });
    expect(r.listings[0].firstSeen).toBe('2026-09-01');
    expect(r.listings[0].lastSeen).toBe('2026-09-26');
  });

  it('merges the same home from another source instead of duplicating it', () => {
    const other = normalized({ source: 'mlsgrid', sourceId: 'X9', address: '100 Main Street, Seattle, WA 98101' });
    const r = mergeSnapshot([listing()], [{ source: 'mlsgrid', area: 'Seattle', complete: false, listings: [other] }], {
      ...opts,
      activeSources: ['rentcast', 'mlsgrid'],
    });
    expect(r.listings).toHaveLength(1);
    expect(r.listings[0].id).toBe('rentcast:a');
    expect(r.listings[0].mergedSources).toEqual(['mlsgrid:X9']);
  });

  it('marks listings missing from a complete fetch as off-market, then drops them', () => {
    const r = mergeSnapshot([listing()], [{ source: 'rentcast', area: 'Seattle', complete: true, listings: [] }], opts);
    expect(r.offMarket).toBe(1);
    expect(r.listings[0]).toMatchObject({ status: 'off_market', offMarketSince: '2026-09-26' });

    const later = mergeSnapshot(r.listings, [{ source: 'rentcast', area: 'Seattle', complete: true, listings: [] }], {
      ...opts,
      today: '2026-10-30',
    });
    expect(later.listings).toHaveLength(0);
    expect(later.dropped).toBe(1);
  });

  it('leaves listings alone when the fetch was incomplete', () => {
    const r = mergeSnapshot([listing()], [{ source: 'rentcast', area: 'Seattle', complete: false, listings: [] }], opts);
    expect(r.offMarket).toBe(0);
    expect(r.listings[0].status).toBe('active');
  });

  it('removes listings from sources that are no longer active (demo → RentCast)', () => {
    const demo = listing({ id: 'simplyrets-demo:1', source: 'simplyrets-demo' });
    const r = mergeSnapshot([demo], [], opts);
    expect(r.listings).toHaveLength(0);
  });
});
