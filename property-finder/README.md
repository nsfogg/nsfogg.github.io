# Property Finder

**Live:** https://nsfogg.github.io/property-finder/

Seattle-area homes for sale, with waterfront homes found by measuring each
property's distance to real OpenStreetMap lake, river and coastline shapes,
not by trusting the listing text. It runs entirely on GitHub, with no server
and no database.

```
GitHub Action (Mon + Thu, or on demand)            GitHub Pages
┌──────────────────────────────────────────┐       ┌──────────────────────────────────┐
│ RentCast / SimplyRETS demo  → adapters   │       │ /property-finder/                │
│ → dedup + merge with last snapshot       │ JSON  │ loads listings.json once, then   │
│ → Overpass water shapes → waterfront     │ ────▶ │ filters, maps and geocodes       │
│ → saved-search alerts → Discord          │       │ (Nominatim) in the browser       │
│ → commit listings.json → redeploy        │       │ saved searches in localStorage   │
└──────────────────────────────────────────┘       └──────────────────────────────────┘
```

| Where | What |
|---|---|
| `scripts/property-finder/` | The ingest run: adapters, dedup/merge, waterfront, alerts, API budget |
| `shared/property-finder/` | Types, filters and keyword rules, used by both the Action and the page |
| `src/property-finder/` | The page: React, Leaflet and marker clustering |
| `public/property-finder/data/listings.json` | The published snapshot (committed by the Action) |
| `property-finder/config.json` | Areas to fetch, waterfront distance, monthly API call limit |
| `property-finder/saved-searches.json` | Alert searches published from the page |
| `.github/workflows/property-finder-ingest.yml` | Schedule, secrets, commit and redeploy |
| `tests/property-finder/` | `npm test` |

## Setup

1. **RentCast key.** Sign up at [rentcast.io/api](https://www.rentcast.io/api) (the Developer plan is free, 50 requests/month). Add the key as the repository secret `RENTCAST_API_KEY`. Without it, the Action uses the SimplyRETS demo feed (sample homes, not in Seattle) and the page shows a banner saying so.
2. **Discord alerts (optional).** In Discord, go to Channel settings → Integrations → Webhooks → New webhook → Copy URL. Add the URL as the secret `PF_DISCORD_WEBHOOK_URL`.
3. **First run.** Go to Actions → "Property Finder — refresh listings" → Run workflow. After that it runs every Monday and Thursday.
4. **Owner tools (optional).** Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new) for this repository only, with *Contents* read/write and *Actions* read/write. Paste it into the page under ⚙︎ Settings. You can then publish alert searches and press "Refresh listings now". The token stays in your browser.

## Budget

RentCast returns at most 500 listings per request, and every request counts. `listings.json` records calls used per calendar month in `meta.budget`. The run skips an area it can't fetch completely rather than half-fetch it; a partial fetch can't tell which listings sold. Seattle proper (~1–3k active listings) costs 2–6 calls, so two runs a week fit under the default `monthlyCallLimit` of 45. Turn on more areas in `config.json` only if your listing counts leave room.

## Adding a source

Implement `ListingSourceAdapter` (`scripts/property-finder/adapters/base.ts`) with `fetchRaw()` and `normalize()`, then return it from `activeAdapters()` in `registry.ts`. Dedup, merge, waterfront, alerts and the page don't change. MLS Grid / Bridge (RESO Web API, OAuth) or ATTOM follow the same two-method contract as `rentcast.ts`.

## Local development

```bash
npm run pf:ingest -- --fixtures --out /tmp/listings.json   # full pipeline on bundled Seattle fixtures, no network
npm test
npm run dev                                                   # http://localhost:5173/property-finder/
```
