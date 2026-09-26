import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { lineString, point, polygon } from '@turf/helpers';
import pointToLineDistance from '@turf/point-to-line-distance';
import Flatbush from 'flatbush';
import { metersToDegrees } from '../../shared/property-finder/geo.ts';

// Waterfront is decided from real water geometry — OpenStreetMap lakes,
// rivers and coastline fetched from the free Overpass API — never from the
// listing text.

export type BBox = [south: number, west: number, north: number, east: number];
type Coord = [lng: number, lat: number];

export interface WaterFeature {
  id: string;
  name: string | null;
  kind: 'water' | 'riverbank' | 'coastline';
  /** Every edge of the feature as open or closed polylines — distance is measured to these. */
  lines: Coord[][];
  /** Closed outer/inner rings, for "is the point inside the water" (houseboats). */
  outer: Coord[][];
  inner: Coord[][];
}

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Bodies of water that don't make a home "waterfront".
const EXCLUDED_WATER = new Set(['basin', 'wastewater', 'reflecting_pool', 'fountain', 'pool', 'retention_basin', 'detention_basin']);

export function overpassQuery([s, w, n, e]: BBox): string {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:120];
(
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
  way["waterway"="riverbank"](${bbox});
  relation["waterway"="riverbank"](${bbox});
  way["natural"="coastline"](${bbox});
);
out geom;`;
}

type OsmNode = { lat: number; lon: number };
type OsmElement = {
  type: 'way' | 'relation' | 'node';
  id: number;
  tags?: Record<string, string>;
  geometry?: (OsmNode | null)[];
  members?: { type: string; role: string; geometry?: (OsmNode | null)[] }[];
};

const toCoords = (geometry: (OsmNode | null)[] | undefined): Coord[] =>
  (geometry ?? []).filter((p): p is OsmNode => !!p).map((p) => [p.lon, p.lat]);

const sameCoord = (a: Coord, b: Coord) => a[0] === b[0] && a[1] === b[1];
const isClosed = (c: Coord[]) => c.length >= 4 && sameCoord(c[0], c[c.length - 1]);

/**
 * Chains multipolygon member ways into closed rings by joining matching
 * endpoints (large lakes like Lake Washington are split across many ways).
 * Segments that never close are returned separately so their edges still
 * count for distance.
 */
export function assembleRings(segments: Coord[][]): { rings: Coord[][]; open: Coord[][] } {
  const pending = segments.filter((s) => s.length >= 2).map((s) => [...s]);
  const rings: Coord[][] = [];
  const open: Coord[][] = [];
  while (pending.length) {
    let current = pending.shift()!;
    let grew = true;
    while (!isClosed(current) && grew) {
      grew = false;
      const end = current[current.length - 1];
      for (let i = 0; i < pending.length; i++) {
        const seg = pending[i];
        if (sameCoord(seg[0], end)) current = current.concat(seg.slice(1));
        else if (sameCoord(seg[seg.length - 1], end)) current = current.concat([...seg].reverse().slice(1));
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    (isClosed(current) ? rings : open).push(current);
  }
  return { rings, open };
}

export function parseOverpass(json: { elements?: OsmElement[] }): WaterFeature[] {
  const features: WaterFeature[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    if (tags.intermittent === 'yes' || EXCLUDED_WATER.has(tags.water ?? '')) continue;
    const kind: WaterFeature['kind'] =
      tags.natural === 'coastline' ? 'coastline' : tags.waterway === 'riverbank' ? 'riverbank' : 'water';
    const base = { id: `${el.type}/${el.id}`, name: tags.name ?? null, kind };

    if (el.type === 'way') {
      const coords = toCoords(el.geometry);
      if (coords.length < 2) continue;
      const closedPolygon = kind !== 'coastline' && isClosed(coords);
      features.push({ ...base, lines: [coords], outer: closedPolygon ? [coords] : [], inner: [] });
    } else if (el.type === 'relation') {
      const outerSegs = (el.members ?? []).filter((m) => m.type === 'way' && m.role !== 'inner').map((m) => toCoords(m.geometry));
      const innerSegs = (el.members ?? []).filter((m) => m.type === 'way' && m.role === 'inner').map((m) => toCoords(m.geometry));
      const outer = assembleRings(outerSegs);
      const inner = assembleRings(innerSegs);
      const lines = [...outer.rings, ...outer.open, ...inner.rings, ...inner.open];
      if (!lines.length) continue;
      features.push({ ...base, lines, outer: outer.rings, inner: inner.rings });
    }
  }
  return features;
}

export async function fetchWater(bbox: BBox, fetchImpl: typeof fetch = fetch): Promise<WaterFeature[]> {
  const res = await fetchImpl(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'nsfogg.github.io property-finder (GitHub Actions)',
    },
    body: new URLSearchParams({ data: overpassQuery(bbox) }).toString(),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  return parseOverpass(await res.json());
}

export function bboxOf(points: { lat: number; lng: number }[], padM = 1500): BBox | null {
  if (!points.length) return null;
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const p of points) {
    s = Math.min(s, p.lat); n = Math.max(n, p.lat);
    w = Math.min(w, p.lng); e = Math.max(e, p.lng);
  }
  const { dLat, dLng } = metersToDegrees(padM, (s + n) / 2);
  const r = (x: number) => Math.round(x * 1e4) / 1e4;
  return [r(s - dLat), r(w - dLng), r(n + dLat), r(e + dLng)];
}

export interface WaterMatch {
  distanceM: number;
  name: string | null;
}

/** Spatial index over water edges; answers "nearest water within `searchM`" for a point. */
export class WaterIndex {
  private segments: { feature: WaterFeature; line: Coord[] }[] = [];
  private index: Flatbush | null = null;

  constructor(private features: WaterFeature[]) {
    for (const feature of features) for (const line of feature.lines) this.segments.push({ feature, line });
    if (!this.segments.length) return;
    this.index = new Flatbush(this.segments.length);
    for (const { line } of this.segments) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of line) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      this.index.add(minX, minY, maxX, maxY);
    }
    this.index.finish();
  }

  get size() {
    return this.features.length;
  }

  nearest(lat: number, lng: number, searchM: number): WaterMatch | null {
    if (!this.index) return null;
    const pt = point([lng, lat]);

    // Inside a water polygon (and not in one of its islands) → distance 0.
    // An outer ring's bounding box always contains the points inside it.
    const candidates = new Set(this.index.search(lng, lat, lng, lat).map((i) => this.segments[i].feature));
    for (const f of candidates) {
      if (!f.outer.length) continue;
      if (f.outer.some((ring) => booleanPointInPolygon(pt, polygon([ring])))) {
        if (!f.inner.some((ring) => booleanPointInPolygon(pt, polygon([ring])))) return { distanceM: 0, name: f.name };
      }
    }

    const { dLat, dLng } = metersToDegrees(searchM, lat);
    let best: WaterMatch | null = null;
    for (const i of this.index.search(lng - dLng, lat - dLat, lng + dLng, lat + dLat)) {
      const { feature, line } = this.segments[i];
      const d = pointToLineDistance(pt, lineString(line), { units: 'meters' });
      if (d <= searchM && (!best || d < best.distanceM)) best = { distanceM: Math.round(d), name: feature.name };
    }
    return best;
  }
}
