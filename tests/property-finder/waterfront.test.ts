import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assembleRings, bboxOf, overpassQuery, parseOverpass, WaterIndex } from '../../scripts/property-finder/waterfront.ts';

const overpass = JSON.parse(
  readFileSync(new URL('../../scripts/property-finder/fixtures/overpass-seattle.json', import.meta.url), 'utf8'),
);

describe('assembleRings', () => {
  it('joins split ways (including reversed ones) into a closed ring', () => {
    const { rings, open } = assembleRings([
      [[0, 0], [1, 0]],
      [[1, 1], [1, 0]], // reversed
      [[1, 1], [0, 1], [0, 0]],
    ]);
    expect(open).toHaveLength(0);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);
  });

  it('keeps segments that never close as open lines', () => {
    const { rings, open } = assembleRings([[[0, 0], [1, 0], [2, 0]]]);
    expect(rings).toHaveLength(0);
    expect(open).toHaveLength(1);
  });
});

describe('parseOverpass', () => {
  const features = parseOverpass(overpass);

  it('assembles the Lake Washington multipolygon with Mercer Island as a hole', () => {
    const lake = features.find((f) => f.name === 'Lake Washington')!;
    expect(lake.outer).toHaveLength(1);
    expect(lake.inner).toHaveLength(1);
  });

  it('drops stormwater basins', () => {
    expect(features.some((f) => f.name === 'Stormwater basin')).toBe(false);
  });

  it('keeps coastline as lines, not polygons', () => {
    const coast = features.filter((f) => f.kind === 'coastline');
    expect(coast).toHaveLength(2);
    expect(coast.every((f) => f.outer.length === 0)).toBe(true);
  });
});

describe('WaterIndex', () => {
  const index = new WaterIndex(parseOverpass(overpass));

  it('measures distance to the nearest lake edge', () => {
    const m = index.nearest(47.595, -122.2848, 1000)!; // Leschi, just west of the shore
    expect(m.name).toBe('Lake Washington');
    expect(m.distanceM).toBeGreaterThan(30);
    expect(m.distanceM).toBeLessThan(100);
  });

  it('returns 0 for a point on the water (houseboat)', () => {
    expect(index.nearest(47.638, -122.334, 1000)).toEqual({ distanceM: 0, name: 'Lake Union' });
  });

  it('treats an island as land, not water', () => {
    const m = index.nearest(47.565, -122.23, 1000); // middle of Mercer Island
    expect(m === null || m.distanceM > 0).toBe(true);
  });

  it('measures distance to coastline lines', () => {
    const m = index.nearest(47.5752, -122.414, 1000)!; // Alki
    expect(m.name).toBeNull();
    expect(m.distanceM).toBeLessThan(100);
  });

  it('returns null when nothing is within the search radius', () => {
    expect(index.nearest(47.625, -122.312, 500)).toBeNull(); // Capitol Hill
  });
});

describe('overpass helpers', () => {
  it('pads the listing bbox and builds the query', () => {
    const bbox = bboxOf([{ lat: 47.6, lng: -122.3 }], 1000)!;
    expect(bbox[0]).toBeLessThan(47.6);
    expect(bbox[3]).toBeGreaterThan(-122.3);
    expect(overpassQuery(bbox)).toContain('way["natural"="coastline"]');
  });
});
