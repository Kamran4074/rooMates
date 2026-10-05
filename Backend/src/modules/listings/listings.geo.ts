// "Near me" without PostGIS. Two steps:
//  1. a cheap lat/lng rectangle around the user, which the
//     listings_location_idx index can narrow down quickly;
//  2. the exact great-circle (haversine) distance, computed in SQL only for
//     the few rows inside that rectangle, then filtered to the radius.
// Good enough for city-scale distances; PostGIS would be the next step if
// this ever needed polygons or millions of rows.

const KM_PER_DEGREE_LAT = 111.045;

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  // A degree of longitude shrinks towards the poles. Clamp so the poles
  // (cos = 0) don't divide by zero - irrelevant for India, but cheap to guard.
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

// Same formula as the SQL in listings.repository.ts - used by the tests to
// check the rectangle never cuts off a listing that's within the radius.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
