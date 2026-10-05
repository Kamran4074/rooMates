import { boundingBox, haversineKm } from "./listings.geo";

// Connaught Place, New Delhi
const CP = { lat: 28.6315, lng: 77.2167 };

describe("listings geo", () => {
  it("haversine gives known city distances", () => {
    // Connaught Place -> India Gate is roughly 2.3 km.
    expect(haversineKm(CP.lat, CP.lng, 28.6129, 77.2295)).toBeCloseTo(2.4, 0);
    expect(haversineKm(CP.lat, CP.lng, CP.lat, CP.lng)).toBe(0);
  });

  it("bounding box contains every point within the radius", () => {
    const radius = 10;
    const box = boundingBox(CP.lat, CP.lng, radius);
    // Sweep a grid around the centre: every point the SQL would keep (within
    // the radius) must also pass the box pre-filter, or it'd be silently lost.
    let inside = 0;
    for (let dLat = -0.12; dLat <= 0.12; dLat += 0.004) {
      for (let dLng = -0.12; dLng <= 0.12; dLng += 0.004) {
        const lat = CP.lat + dLat;
        const lng = CP.lng + dLng;
        if (haversineKm(CP.lat, CP.lng, lat, lng) > radius) continue;
        inside++;
        expect(lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng).toBe(true);
      }
    }
    expect(inside).toBeGreaterThan(1000); // the grid really covered the circle
  });

  it("longitude span widens away from the equator", () => {
    const equator = boundingBox(0, 77, 10);
    const delhi = boundingBox(28.6, 77, 10);
    expect(delhi.maxLng - delhi.minLng).toBeGreaterThan(equator.maxLng - equator.minLng);
  });
});
