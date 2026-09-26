import { haversineM } from '../../shared/property-finder/geo.ts';
import type { Listing, NormalizedListing } from '../../shared/property-finder/types.ts';

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bst\b/g, 'street'],
  [/\bave\b/g, 'avenue'],
  [/\bdr\b/g, 'drive'],
  [/\bln\b/g, 'lane'],
  [/\brd\b/g, 'road'],
  [/\bblvd\b/g, 'boulevard'],
  [/\bct\b/g, 'court'],
  [/\bpl\b/g, 'place'],
  [/\bapt\b/g, 'unit'],
  [/\bste\b/g, 'unit'],
  [/\bn\b/g, 'north'],
  [/\bs\b/g, 'south'],
  [/\be\b/g, 'east'],
  [/\bw\b/g, 'west'],
  [/\bne\b/g, 'northeast'],
  [/\bnw\b/g, 'northwest'],
  [/\bse\b/g, 'southeast'],
  [/\bsw\b/g, 'southwest'],
];

/** Street line only (text before the first comma), lower-cased with common abbreviations expanded. */
export function normalizeStreet(address: string): string {
  let s = address.split(',')[0].toLowerCase().replace(/[.#]/g, ' ');
  for (const [pattern, replacement] of ABBREVIATIONS) s = s.replace(pattern, replacement);
  return s.replace(/\s+/g, ' ').trim();
}

export function dedupKey(l: Pick<NormalizedListing, 'address' | 'zip'>): string {
  return `${normalizeStreet(l.address)}|${l.zip.slice(0, 5)}`;
}

const houseNumber = (address: string) => normalizeStreet(address).match(/^\d+/)?.[0] ?? null;

/**
 * Finds the existing listing that is the same physical property:
 * 1. same source + source id (a re-fetch),
 * 2. same normalized street + zip from any source,
 * 3. within 50 m with the same house number (formatting differs between sources).
 */
export function findMatch(
  existing: Map<string, Listing>,
  byKey: Map<string, Listing>,
  n: NormalizedListing,
): Listing | undefined {
  const exact = existing.get(`${n.source}:${n.sourceId}`);
  if (exact) return exact;

  const keyed = byKey.get(dedupKey(n));
  if (keyed) return keyed;

  const num = houseNumber(n.address);
  if (!num) return undefined;
  for (const l of existing.values()) {
    if (Math.abs(l.lat - n.lat) > 0.001 || Math.abs(l.lng - n.lng) > 0.001) continue;
    if (houseNumber(l.address) === num && haversineM(l.lat, l.lng, n.lat, n.lng) <= 50) return l;
  }
  return undefined;
}
