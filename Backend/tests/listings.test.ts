import { adminPool } from "../src/config/db";
import { api, cleanup, createUser, startServer, TestUser, validListing } from "./helpers";

// The listing lifecycle end to end: draft -> review -> published -> found by
// search / "near me" -> interest request -> accepted -> rented.

let ownerA: TestUser, ownerB: TestUser, seeker: TestUser, admin: TestUser;

beforeAll(async () => {
  await startServer();
  [ownerA, ownerB, seeker, admin] = await Promise.all([
    createUser(),
    createUser(),
    createUser(),
    createUser({ role: "super_admin" }),
  ]);
});
afterAll(cleanup);

// Each account may have only 5 active listings (anti-spam), so tests that need
// several published listings give each one its own owner.
async function createPublishedListing(owner: TestUser | "new", overrides = {}) {
  if (owner === "new") owner = await createUser();
  const created = await api(owner, "POST", "/api/listings", validListing(overrides));
  const id = created.body.data.id;
  await api(owner, "POST", `/api/listings/${id}/status`, { action: "submit" });
  await api(admin, "POST", `/api/admin/listings/${id}/approve`);
  return id as string;
}

describe("creating and editing", () => {
  it("creates a draft, validated on the server", async () => {
    const bad = await api(ownerA, "POST", "/api/listings", validListing({ rent: -5, pincode: "12" }));
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
    expect(Object.keys(bad.body.errors)).toEqual(expect.arrayContaining(["rent", "pincode"]));

    const res = await api(ownerA, "POST", "/api/listings", validListing());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("draft");
  });

  it("requires a phone number (it's how accepted requesters reach the owner)", async () => {
    const noPhone = await createUser({ phone: false });
    const res = await api(noPhone, "POST", "/api/listings", validListing());
    expect(res.status).toBe(403);
  });

  it("Owner B cannot edit or delete Owner A's listing", async () => {
    const id = await createPublishedListing(ownerA);

    const edit = await api(ownerB, "PATCH", `/api/listings/${id}`, { rent: 1 });
    expect(edit.status).toBe(403);
    const del = await api(ownerB, "DELETE", `/api/listings/${id}`);
    expect(del.status).toBe(403);
    const status = await api(ownerB, "POST", `/api/listings/${id}/status`, { action: "mark_rented" });
    expect(status.status).toBe(403);

    const after = await api(ownerA, "GET", `/api/listings/${id}`);
    expect(after.body.data.rent_paise).toBe(850000); // untouched
  });

  it("someone else's unpublished listing is invisible (404, not 403)", async () => {
    const draft = await api(ownerA, "POST", "/api/listings", validListing());
    const res = await api(ownerB, "GET", `/api/listings/${draft.body.data.id}`);
    expect(res.status).toBe(404);
  });

  it("editing a published listing sends it back for review", async () => {
    const id = await createPublishedListing(ownerA);
    const res = await api(ownerA, "PATCH", `/api/listings/${id}`, { title: "Updated room title here" });
    expect(res.body.data.status).toBe("pending");
  });

  it("an owner can never publish their own listing - the database refuses it", async () => {
    // Even bypassing the API's rules, app_user can't set 'published'.
    const draft = await api(ownerA, "POST", "/api/listings", validListing());
    const { pool } = await import("../src/config/db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [ownerA.id]);
      await expect(
        client.query("UPDATE listings SET status = 'published' WHERE id = $1", [draft.body.data.id])
      ).rejects.toThrow(/only an admin/);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});

describe("search and near me", () => {
  it("only published listings are searchable, with filters", async () => {
    const city = `Searchville${Date.now()}`;
    await createPublishedListing("new", { city, rent: 6000 });
    await createPublishedListing("new", { city, rent: 15000, roomType: "entire_flat" });
    await api(ownerB, "POST", "/api/listings", validListing({ city })); // draft: must not appear

    const all = await api(seeker, "GET", `/api/listings?city=${city}`);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.pagination.total).toBe(2);
    expect(all.body.data[0]).not.toHaveProperty("owner_id");

    const cheap = await api(seeker, "GET", `/api/listings?city=${city.toLowerCase()}&maxRent=10000`);
    expect(cheap.body.data.map((l: { rent_paise: number }) => l.rent_paise)).toEqual([600000]);

    const flats = await api(seeker, "GET", `/api/listings?city=${city}&roomType=entire_flat`);
    expect(flats.body.data).toHaveLength(1);
  });

  it("finds listings near a point, nearest first, and leaves out far ones", async () => {
    // A tiny made-up area so other data in the DB can't interfere.
    const base = { latitude: -45.01, longitude: 170.01 };
    const near = await createPublishedListing("new", base);
    const nearer = await createPublishedListing("new", { latitude: -45.0, longitude: 170.0 });
    await createPublishedListing("new", { latitude: -45.5, longitude: 170.5 }); // ~65 km away

    const res = await api(seeker, "GET", "/api/listings/nearby?lat=-45&lng=170&radiusKm=5");
    const ids = res.body.data.map((l: { id: string }) => l.id);
    expect(ids).toEqual([nearer, near]);
    expect(res.body.data[0].distance_km).toBeLessThan(res.body.data[1].distance_km);
  });
});

describe("interest requests", () => {
  it("full flow: request -> owner accepts and marks rented -> contact shared", async () => {
    const owner = await createUser();
    const listingId = await createPublishedListing(owner);
    const other = await createUser();

    expect((await api(owner, "POST", "/api/requests", { listingId })).status).toBe(400); // own listing
    const sent = await api(seeker, "POST", "/api/requests", { listingId, message: "Hi, is it still available?" });
    expect(sent.status).toBe(201);
    expect((await api(seeker, "POST", "/api/requests", { listingId })).status).toBe(409); // duplicate
    await api(other, "POST", "/api/requests", { listingId });

    // Before accepting, no contact details either way.
    const before = await api(seeker, "GET", "/api/requests/sent");
    expect(before.body.data[0].owner_phone).toBeNull();
    const received = await api(owner, "GET", `/api/requests/received?listingId=${listingId}`);
    expect(received.body.data).toHaveLength(2);
    expect(received.body.data.every((r: { requester_phone: unknown }) => r.requester_phone === null)).toBe(true);

    // Only the owner can answer. Another user can't even see the request
    // (RLS), so it's a 404 - which also doesn't confirm that it exists.
    expect((await api(ownerB, "PATCH", `/api/requests/${sent.body.data.id}`, { action: "accept" })).status).toBe(404);
    // ...and the person who sent it can't accept their own request.
    expect((await api(seeker, "PATCH", `/api/requests/${sent.body.data.id}`, { action: "accept" })).status).toBe(403);

    const accepted = await api(owner, "PATCH", `/api/requests/${sent.body.data.id}`, { action: "accept", markRented: true });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.listingRented).toBe(true);

    // All three writes happened together.
    const { rows } = await adminPool.query(
      "SELECT (SELECT status FROM listings WHERE id = $1) AS listing, array_agg(status ORDER BY status) AS requests FROM listing_requests WHERE listing_id = $1",
      [listingId]
    );
    expect(rows[0].listing).toBe("rented");
    expect(rows[0].requests).toEqual(["accepted", "rejected"]);

    const after = await api(seeker, "GET", "/api/requests/sent");
    expect(after.body.data[0].owner_phone).toMatch(/^\+91/);
    expect(after.body.data[0].listing_status).toBe("rented"); // still visible to the requester

    // Can't answer twice.
    expect((await api(owner, "PATCH", `/api/requests/${sent.body.data.id}`, { action: "reject" })).status).toBe(409);
  });

  it("reports go to the moderation queue", async () => {
    const owner = await createUser();
    const listingId = await createPublishedListing(owner);
    const res = await api(seeker, "POST", `/api/listings/${listingId}/reports`, { reason: "fake_listing" });
    expect(res.status).toBe(201);
    expect((await api(seeker, "POST", `/api/listings/${listingId}/reports`, { reason: "spam" })).status).toBe(409);
    expect((await api(owner, "POST", `/api/listings/${listingId}/reports`, { reason: "spam" })).status).toBe(400);
  });
});
