const EARTH_RADIUS_M = 6_371_008.8;
export const METERS_PER_MILE = 1609.344;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Degrees of latitude/longitude spanning `meters` at `lat` — for padding bounding boxes. */
export function metersToDegrees(meters: number, lat: number): { dLat: number; dLng: number } {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(Math.cos(toRad(lat)), 0.01));
  return { dLat, dLng };
}
