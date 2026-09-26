import { matchesFilters, type ListingFilters } from '../../shared/property-finder/filter.ts';
import type { Listing } from '../../shared/property-finder/types.ts';

export interface SavedSearch {
  id: string;
  name: string;
  filters: ListingFilters;
  alert: boolean;
  updatedAt?: string;
}

export interface Match {
  search: SavedSearch;
  listing: Listing;
  reason: 'new' | 'price_drop';
  previousPrice?: number;
}

/** A delivery route for alerts. Add email/SMS by implementing this and adding it to `channels()` in ingest.ts. */
export interface NotificationChannel {
  name: string;
  send(matches: Match[], pageUrl: string): Promise<void>;
}

/** New listings and price drops from this run that match an alert-enabled saved search. */
export function findAlertMatches(searches: SavedSearch[], created: Listing[], priceDrops: Listing[]): Match[] {
  const matches: Match[] = [];
  for (const search of searches) {
    if (!search.alert) continue;
    for (const listing of created) {
      if (listing.status === 'active' && matchesFilters(listing, search.filters)) matches.push({ search, listing, reason: 'new' });
    }
    for (const listing of priceDrops) {
      if (!matchesFilters(listing, search.filters)) continue;
      const history = listing.priceHistory;
      matches.push({ search, listing, reason: 'price_drop', previousPrice: history[history.length - 2]?.price });
    }
  }
  return matches;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

export function formatMatch(m: Match, pageUrl: string): string {
  const l = m.listing;
  const facts = [l.beds !== null && `${l.beds} bd`, l.baths !== null && `${l.baths} ba`, l.sqft !== null && `${l.sqft.toLocaleString('en-US')} sqft`]
    .filter(Boolean)
    .join(' · ');
  const price = m.reason === 'price_drop' && m.previousPrice ? `${money(l.price)} (was ${money(m.previousPrice)})` : money(l.price);
  const water = l.waterfront ? ` · 🌊 ${l.waterName ?? 'water'}${l.waterDistanceM ? ` ${l.waterDistanceM} m` : ''}` : '';
  return `• ${price} · ${facts} · ${l.address}${water}\n  <${pageUrl}?listing=${encodeURIComponent(l.id)}>`;
}

/** Groups matches per saved search into Discord-sized (≤2000 char) messages. */
export function buildMessages(matches: Match[], pageUrl: string): string[] {
  const bySearch = new Map<string, Match[]>();
  for (const m of matches) bySearch.set(m.search.id, [...(bySearch.get(m.search.id) ?? []), m]);

  const messages: string[] = [];
  for (const group of bySearch.values()) {
    const newCount = group.filter((m) => m.reason === 'new').length;
    const dropCount = group.length - newCount;
    const parts = [newCount && `${newCount} new`, dropCount && `${dropCount} price drop${dropCount > 1 ? 's' : ''}`].filter(Boolean);
    let current = `🏠 **${group[0].search.name}** — ${parts.join(', ')}`;
    for (const m of group) {
      const line = formatMatch(m, pageUrl);
      if (current.length + line.length + 1 > 1900) {
        messages.push(current);
        current = `🏠 **${group[0].search.name}** (cont.)`;
      }
      current += `\n${line}`;
    }
    messages.push(current);
  }
  return messages;
}

export class DiscordChannel implements NotificationChannel {
  name = 'discord';
  constructor(private webhookUrl: string, private fetchImpl: typeof fetch = fetch) {}

  async send(matches: Match[], pageUrl: string): Promise<void> {
    for (const content of buildMessages(matches, pageUrl)) {
      const res = await this.fetchImpl(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      });
      if (!res.ok) throw new Error(`Discord webhook ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    }
  }
}
