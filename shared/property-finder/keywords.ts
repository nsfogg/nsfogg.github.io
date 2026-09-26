// Amenity keywords pulled from listing descriptions. This is informational
// and filterable, but it is never used to decide `waterfront` — that comes
// from water geometry (scripts/property-finder/waterfront.ts).

export const KEYWORD_DEFINITIONS: Record<string, RegExp[]> = {
  dock: [/\bdock\b/i, /\bboat\s?lift\b/i, /\bboat\s?house\b/i, /\bmoorage\b/i],
  pool: [/\bpool\b/i],
  acreage: [/\bacres?\b/i, /\bacreage\b/i],
  no_hoa: [/\bno\s?hoa\b/i],
  view: [/\b(water|lake|sound|mountain|city)\s?views?\b/i],
  garage: [/\bgarage\b/i],
  fireplace: [/\bfireplace\b/i],
  new_construction: [/\bnew\s?construction\b/i, /\bnewly\s?built\b/i],
  adu: [/\badu\b/i, /\bmother[-\s]in[-\s]law\b/i, /\bdadu\b/i],
};

export const KEYWORD_LABELS: Record<string, string> = {
  dock: 'Dock / moorage',
  pool: 'Pool',
  acreage: 'Acreage',
  no_hoa: 'No HOA',
  view: 'View',
  garage: 'Garage',
  fireplace: 'Fireplace',
  new_construction: 'New construction',
  adu: 'ADU',
};

export function extractKeywords(description: string | null, structured: string[] = []): string[] {
  const found = new Set(structured);
  if (description) {
    for (const [key, patterns] of Object.entries(KEYWORD_DEFINITIONS)) {
      if (patterns.some((p) => p.test(description))) found.add(key);
    }
  }
  return [...found].sort();
}
