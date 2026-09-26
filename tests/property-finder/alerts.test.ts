import { describe, expect, it, vi } from 'vitest';
import { buildMessages, DiscordChannel, findAlertMatches, type SavedSearch } from '../../scripts/property-finder/alerts.ts';
import { listing } from './helpers.ts';

const waterfront: SavedSearch = { id: 's1', name: 'Waterfront under $2M', alert: true, filters: { waterfront_only: true, max_price: 2_000_000 } };
const muted: SavedSearch = { id: 's2', name: 'Anything', alert: false, filters: {} };
const pageUrl = 'https://nsfogg.github.io/property-finder/';

const lake = listing({ id: 'rentcast:lake', address: '1 Shore Dr, Seattle, WA', waterfront: true, waterName: 'Lake Washington', waterDistanceM: 40 });
const inland = listing({ id: 'rentcast:inland' });
const dropped = listing({
  id: 'rentcast:drop',
  price: 1_800_000,
  waterfront: true,
  priceHistory: [
    { date: '2026-09-01', price: 1_950_000 },
    { date: '2026-09-26', price: 1_800_000 },
  ],
});

describe('findAlertMatches', () => {
  it('matches new listings and price drops against alert-enabled searches only', () => {
    const matches = findAlertMatches([waterfront, muted], [lake, inland], [dropped]);
    expect(matches.map((m) => [m.search.id, m.listing.id, m.reason])).toEqual([
      ['s1', 'rentcast:lake', 'new'],
      ['s1', 'rentcast:drop', 'price_drop'],
    ]);
    expect(matches[1].previousPrice).toBe(1_950_000);
  });
});

describe('buildMessages', () => {
  it('groups by search with links back to the page', () => {
    const [msg] = buildMessages(findAlertMatches([waterfront], [lake], [dropped]), pageUrl);
    expect(msg).toContain('**Waterfront under $2M** — 1 new, 1 price drop');
    expect(msg).toContain('Lake Washington 40 m');
    expect(msg).toContain('(was $1,950,000)');
    expect(msg).toContain(`<${pageUrl}?listing=rentcast%3Alake>`);
  });

  it('splits long groups under the Discord limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => listing({ id: `rentcast:${i}`, waterfront: true, address: `${i} Long Address Boulevard Northeast, Seattle, WA 98101` }));
    const messages = buildMessages(findAlertMatches([waterfront], many, []), pageUrl);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((m) => m.length <= 2000)).toBe(true);
  });
});

describe('DiscordChannel', () => {
  it('posts each message to the webhook', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    await new DiscordChannel('https://discord.com/api/webhooks/x', fetchMock).send(findAlertMatches([waterfront], [lake], []), pageUrl);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
