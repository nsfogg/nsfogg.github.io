/**
 * Property Finder ingest — run by .github/workflows/property-finder-ingest.yml.
 *
 *   npm run pf:ingest                  # live: RentCast if RENTCAST_API_KEY is set, else SimplyRETS demo
 *   npm run pf:ingest -- --fixtures    # offline: bundled Seattle fixtures, nothing leaves the machine
 *   npm run pf:ingest -- --dry-run     # print alerts instead of sending them
 *
 * Env: RENTCAST_API_KEY, PF_DISCORD_WEBHOOK_URL, PF_PAGE_URL, PF_RAW_DIR (raw
 * payloads for the workflow artifact), PF_CACHE_DIR (Overpass geometry cache).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Listing, RunSummary, Snapshot } from '../../shared/property-finder/types.ts';
import type { Area, ListingSourceAdapter } from './adapters/base.ts';
import { RentcastAdapter } from './adapters/rentcast.ts';
import { activeAdapters } from './adapters/registry.ts';
import { DiscordChannel, findAlertMatches, buildMessages, type NotificationChannel, type SavedSearch } from './alerts.ts';
import { Budget } from './budget.ts';
import { fixtureFetch } from './fixtures/fetch.ts';
import { mergeSnapshot, type FetchedBatch } from './merge.ts';
import { bboxOf, fetchWater, WaterIndex, type WaterFeature } from './waterfront.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONFIG_PATH = join(ROOT, 'property-finder/config.json');
const SAVED_SEARCHES_PATH = join(ROOT, 'property-finder/saved-searches.json');
const DEFAULT_OUT = join(ROOT, 'public/property-finder/data/listings.json');
/** Water edges further than this are ignored; listings beyond it get waterDistanceM = null. */
const WATER_SEARCH_M = 1000;

interface Config {
  areas: Area[];
  waterfrontThresholdM: number;
  monthlyCallLimit: number;
  offMarketDropAfterDays: number;
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const log = (msg: string) => console.log(`[pf] ${msg}`);
const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

/** One listing per line keeps git diffs of the snapshot readable. */
function serializeSnapshot(snapshot: Snapshot): string {
  const rows = snapshot.listings.map((l) => JSON.stringify(l));
  return `{"meta":${JSON.stringify(snapshot.meta)},\n"listings":[\n${rows.join(',\n')}\n]}\n`;
}

function applyWater(listings: Listing[], index: WaterIndex, thresholdM: number) {
  for (const l of listings) {
    const match = index.nearest(l.lat, l.lng, WATER_SEARCH_M);
    l.waterDistanceM = match ? match.distanceM : null;
    l.waterName = match ? match.name : null;
    l.waterfront = match !== null && match.distanceM <= thresholdM;
  }
}

async function loadWater(listings: Listing[], fetchImpl: typeof fetch, cacheDir: string, notes: string[]): Promise<WaterIndex | null> {
  const bbox = bboxOf(listings);
  if (!bbox) return null;
  const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
  if (area > 2) {
    notes.push(`Listings span ${area.toFixed(1)} square degrees — too large for one Overpass query; waterfront not recomputed.`);
    return null;
  }
  // Restored between runs by actions/cache; used only when Overpass is unavailable.
  const cachePath = join(cacheDir, 'water-latest.json');
  try {
    const features = await fetchWater(bbox, fetchImpl);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cachePath, JSON.stringify({ bbox, fetchedAt: new Date().toISOString(), features }));
    log(`overpass: ${features.length} water features for bbox ${bbox.join(',')}`);
    return new WaterIndex(features);
  } catch (err) {
    if (existsSync(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as { fetchedAt: string; features: WaterFeature[] };
      notes.push(`Overpass failed (${(err as Error).message}); used water geometry cached ${cached.fetchedAt.slice(0, 10)}.`);
      return new WaterIndex(cached.features);
    }
    notes.push(`Overpass failed (${(err as Error).message}) and no cache — kept previous waterfront flags.`);
    return null;
  }
}

async function main() {
  const fixtures = flag('fixtures');
  const dryRun = flag('dry-run') || fixtures;
  const today = option('today') ?? new Date().toISOString().slice(0, 10);
  const outPath = resolve(option('out') ?? DEFAULT_OUT);
  const pageUrl = process.env.PF_PAGE_URL ?? 'https://nsfogg.github.io/property-finder/';
  const rawDir = process.env.PF_RAW_DIR;
  const cacheDir = process.env.PF_CACHE_DIR ?? join(ROOT, '.cache/property-finder');
  const fetchImpl: typeof fetch = fixtures ? fixtureFetch : fetch;

  const config = readJson<Config>(CONFIG_PATH, { areas: [], waterfrontThresholdM: 100, monthlyCallLimit: 45, offMarketDropAfterDays: 21 });
  const previous = readJson<Snapshot | null>(outPath, null);
  const { searches } = readJson<{ searches: SavedSearch[] }>(SAVED_SEARCHES_PATH, { searches: [] });

  const budget = new Budget(previous?.meta.budget, config.monthlyCallLimit, new Date(`${today}T12:00:00Z`));
  const adapters: ListingSourceAdapter[] = fixtures ? [new RentcastAdapter('fixture-key')] : activeAdapters();
  const areas = config.areas.filter((a) => a.enabled);
  const notes: string[] = [];
  const batches: FetchedBatch[] = [];
  let fetched = 0;
  let failures = 0;

  for (const adapter of adapters) {
    const targets: Area[] = adapter.areaIndependent ? [{ name: 'Demo feed', enabled: true, query: { city: '', state: '' } }] : areas;
    for (const area of targets) {
      const previousCount = (previous?.listings ?? []).filter(
        (l) => l.source === adapter.name && l.area === area.name && l.status !== 'off_market',
      ).length;
      try {
        const { raw, complete } = await adapter.fetchRaw({ area, budget, fetch: fetchImpl, log, previousCount });
        fetched += raw.length;
        if (rawDir) {
          mkdirSync(rawDir, { recursive: true });
          writeFileSync(join(rawDir, `${adapter.name}-${area.name.replace(/\W+/g, '_')}.json`), JSON.stringify(raw));
        }
        const listings = raw.map((r) => adapter.normalize(r)).filter((l) => l !== null);
        if (listings.length < raw.length) notes.push(`${adapter.name}/${area.name}: skipped ${raw.length - listings.length} records without coordinates or price.`);
        if (!complete) notes.push(`${adapter.name}/${area.name}: incomplete fetch (budget) — nothing marked off-market.`);
        batches.push({ source: adapter.name, area: area.name, complete, listings });
      } catch (err) {
        failures++;
        notes.push(`${adapter.name}/${area.name}: ${(err as Error).message}`);
        batches.push({ source: adapter.name, area: area.name, complete: false, listings: [] });
      }
    }
  }

  const activeSources = adapters.map((a) => a.name);
  const merged = mergeSnapshot(previous?.listings ?? [], batches, {
    today,
    activeSources,
    dropAfterDays: config.offMarketDropAfterDays,
  });

  const water = await loadWater(merged.listings, fetchImpl, cacheDir, notes);
  if (water) applyWater(merged.listings, water, config.waterfrontThresholdM);

  // Alerts: skip the first run for a source, when every listing is "new".
  const hadPrevious = (previous?.listings ?? []).some((l) => activeSources.includes(l.source));
  const matches = hadPrevious ? findAlertMatches(searches, merged.created, merged.priceDrops) : [];
  if (!hadPrevious && merged.created.length) notes.push('First run for this source — alerts skipped.');
  let alertsSent = 0;
  const channels: NotificationChannel[] = [];
  if (process.env.PF_DISCORD_WEBHOOK_URL) channels.push(new DiscordChannel(process.env.PF_DISCORD_WEBHOOK_URL, fetchImpl));
  if (matches.length) {
    if (dryRun || !channels.length) {
      for (const m of buildMessages(matches, pageUrl)) log(`alert (not sent):\n${m}`);
      if (!channels.length && !dryRun) notes.push(`${matches.length} alert matches, but PF_DISCORD_WEBHOOK_URL isn't set.`);
    } else {
      for (const channel of channels) {
        try {
          await channel.send(matches, pageUrl);
          alertsSent = matches.length;
        } catch (err) {
          notes.push(`${channel.name}: ${(err as Error).message}`);
        }
      }
    }
  }

  const allFailed = failures > 0 && failures === batches.length;
  const status: RunSummary['status'] = allFailed
    ? 'failed'
    : batches.every((b) => !b.complete && !b.listings.length)
      ? 'skipped'
      : batches.some((b) => !b.complete)
        ? 'partial'
        : 'success';

  const lastRun: RunSummary = {
    status,
    startedAt: new Date().toISOString(),
    fetched,
    created: merged.created.length,
    updated: merged.updated,
    offMarket: merged.offMarket,
    alertsSent,
    notes,
  };

  const snapshot: Snapshot = {
    meta: {
      generatedAt: allFailed ? previous?.meta.generatedAt ?? null : new Date().toISOString(),
      demo: adapters.every((a) => a.demo),
      sources: activeSources,
      areas: adapters.some((a) => !a.areaIndependent) ? areas.map((a) => a.name) : ['SimplyRETS demo feed'],
      waterfrontThresholdM: config.waterfrontThresholdM,
      budget: budget.toJSON(),
      lastRun,
    },
    listings: (allFailed ? previous?.listings ?? [] : merged.listings).sort((a, b) => a.id.localeCompare(b.id)),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeSnapshot(snapshot));

  const summary = [
    `### Property Finder ingest — ${status}`,
    `- Sources: ${activeSources.join(', ')}${snapshot.meta.demo ? ' (demo data)' : ''}`,
    `- Fetched ${fetched}, new ${merged.created.length}, updated ${merged.updated}, off-market ${merged.offMarket}, dropped ${merged.dropped}`,
    `- Waterfront: ${snapshot.listings.filter((l) => l.waterfront).length} of ${snapshot.listings.length}${water ? ` (${water.size} water features)` : ''}`,
    `- Alerts: ${matches.length} matches, ${alertsSent} sent`,
    `- API budget: ${budget.callsUsed}/${budget.limit} calls used in ${budget.month}`,
    ...notes.map((n) => `- ⚠️ ${n}`),
  ].join('\n');
  log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);

  if (allFailed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
