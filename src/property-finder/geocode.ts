// City → coordinates via OpenStreetMap's Nominatim, called straight from the
// browser (it allows CORS). Results are cached in localStorage and requests
// are spaced at least a second apart, per Nominatim's usage policy.

const CACHE_KEY = 'pf.geocode.v1';
let lastCall = 0;

type Cache = Record<string, { lat: number; lng: number; label: string } | null>;

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked — geocoding still works, just uncached */
  }
}

export async function geocode(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  const cache = loadCache();
  if (key in cache) return cache[key];

  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'us' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const result = hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name } : null;
  saveCache({ ...cache, [key]: result });
  return result;
}
