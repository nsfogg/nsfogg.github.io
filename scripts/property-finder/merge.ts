import { extractKeywords } from '../../shared/property-finder/keywords.ts';
import type { Listing, NormalizedListing } from '../../shared/property-finder/types.ts';
import { dedupKey, findMatch } from './dedup.ts';

export interface FetchedBatch {
  source: string;
  area: string;
  complete: boolean;
  listings: NormalizedListing[];
}

export interface MergeResult {
  listings: Listing[];
  created: Listing[];
  priceDrops: Listing[];
  updated: number;
  offMarket: number;
  dropped: number;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Folds this run's fetched listings into the previous snapshot:
 * new listings get firstSeen/priceHistory, re-seen ones are updated and
 * record price changes, and listings missing from a *complete* fetch of their
 * source+area are marked off-market (then dropped after `dropAfterDays`).
 * Listings from sources that are no longer active are removed.
 */
export function mergeSnapshot(
  previous: Listing[],
  batches: FetchedBatch[],
  opts: { today: string; activeSources: string[]; dropAfterDays: number },
): MergeResult {
  const { today } = opts;
  const existing = new Map<string, Listing>();
  const byKey = new Map<string, Listing>();
  for (const l of previous) {
    if (!opts.activeSources.includes(l.source)) continue;
    const copy: Listing = { ...l, priceHistory: [...l.priceHistory], mergedSources: [...l.mergedSources] };
    existing.set(copy.id, copy);
    byKey.set(copy.dedupKey, copy);
  }

  const seen = new Set<string>();
  const created: Listing[] = [];
  const priceDrops: Listing[] = [];
  let updated = 0;

  for (const batch of batches) {
    for (const n of batch.listings) {
      const { structuredKeywords, ...fields } = n;
      const keywords = extractKeywords(n.description, structuredKeywords);
      const match = findMatch(existing, byKey, n);

      if (match) {
        if (seen.has(match.id)) continue; // same property twice in one run
        seen.add(match.id);
        const oldPrice = match.price;
        const alias = `${n.source}:${n.sourceId}`;
        // Keep the original id/source; other sources for the same home are recorded as aliases.
        const identity = { id: match.id, source: match.source, sourceId: match.sourceId };
        Object.assign(match, fields, identity, {
          area: batch.area,
          keywords,
          lastSeen: today,
          offMarketSince: fields.status === 'off_market' ? match.offMarketSince ?? today : null,
        });
        if (alias !== match.id && !match.mergedSources.includes(alias)) match.mergedSources.push(alias);
        if (n.price !== oldPrice) {
          match.priceHistory.push({ date: today, price: n.price });
          if (n.price < oldPrice) priceDrops.push(match);
        }
        updated++;
        continue;
      }

      const listing: Listing = {
        ...fields,
        id: `${n.source}:${n.sourceId}`,
        area: batch.area,
        dedupKey: dedupKey(n),
        mergedSources: [],
        waterfront: false,
        waterDistanceM: null,
        waterName: null,
        keywords,
        firstSeen: today,
        lastSeen: today,
        offMarketSince: n.status === 'off_market' ? today : null,
        priceHistory: [{ date: today, price: n.price }],
      };
      existing.set(listing.id, listing);
      byKey.set(listing.dedupKey, listing);
      seen.add(listing.id);
      created.push(listing);
    }
  }

  const completeScopes = new Set(batches.filter((b) => b.complete).map((b) => `${b.source}|${b.area}`));
  let offMarket = 0;
  let dropped = 0;
  const listings: Listing[] = [];
  for (const l of existing.values()) {
    if (!seen.has(l.id) && completeScopes.has(`${l.source}|${l.area}`) && l.status !== 'off_market') {
      l.status = 'off_market';
      l.offMarketSince = today;
      offMarket++;
    }
    if (l.status === 'off_market' && l.offMarketSince && daysBetween(l.offMarketSince, today) > opts.dropAfterDays) {
      dropped++;
      continue;
    }
    listings.push(l);
  }

  return { listings, created, priceDrops, updated, offMarket, dropped };
}
