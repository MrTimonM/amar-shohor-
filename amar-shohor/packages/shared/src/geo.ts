/** GeoJSON Point, stored exactly as MongoDB's 2dsphere index expects. */
export interface GeoPoint {
  type: 'Point';
  /** [longitude, latitude] — GeoJSON order, not the human order. */
  coordinates: [number, number];
}

export const point = (lng: number, lat: number): GeoPoint => ({
  type: 'Point',
  coordinates: [lng, lat],
});

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. Used by dedup candidate scoring. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Dhaka, used as the default map centre until the browser reports a fix. */
export const DHAKA_CENTER = { lat: 23.7806, lng: 90.4074 };
