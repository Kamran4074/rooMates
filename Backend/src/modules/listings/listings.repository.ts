import { PoolClient } from "pg";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { toPaise } from "../../utils/money";
import { boundingBox } from "./listings.geo";
import { CreateListingInput, ListingFilters, NearbyListingsQuery, UpdateListingInput } from "./listings.schema";

// All listing SQL lives here; listings.service.ts holds the rules (who may do
// what, status transitions). Every function takes the transaction's client,
// so RLS applies: a non-owner only ever sees published listings.

export type ListingStatus = "draft" | "pending" | "published" | "rejected" | "rented" | "removed";

export interface ListingRow {
  id: string;
  owner_id: string;
  status: ListingStatus;
}

// Columns for list views (cards). The owner's id isn't sent to other users;
// `is_mine` is enough for the UI. $1 is always the caller's user id.
const CARD_COLUMNS = `
  l.id, l.title, l.rent_paise::float8 AS rent_paise, l.room_type, l.furnishing, l.locality, l.city,
  l.pincode, l.available_from::text AS available_from, l.status, l.created_at, (l.owner_id = $1) AS is_mine,
  (SELECT i.url FROM listing_images i WHERE i.listing_id = l.id
   ORDER BY i.is_primary DESC, i.created_at LIMIT 1) AS cover_url`;

// Builds the WHERE clause from the optional filters. Values only ever go in
// as $n parameters - never concatenated into the SQL string.
function filterClauses(filters: Partial<ListingFilters>, params: unknown[]) {
  const where = ["l.status = 'published'"];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.city) add("lower(l.city) = lower(?)", filters.city);
  if (filters.pincode) add("l.pincode = ?", filters.pincode);
  if (filters.minRent) add("l.rent_paise >= ?", toPaise(filters.minRent));
  if (filters.maxRent) add("l.rent_paise <= ?", toPaise(filters.maxRent));
  if (filters.roomType) add("l.room_type = ?", filters.roomType);
  if (filters.furnishing) add("l.furnishing = ?", filters.furnishing);
  if (filters.availableBy) add("l.available_from <= ?", filters.availableBy);
  return where.join(" AND ");
}

export async function searchPublished(client: PoolClient, userId: string, filters: ListingFilters, page: PageParams) {
  const params: unknown[] = [userId];
  const where = filterClauses(filters, params);
  const { limit, offset } = toLimitOffset(page);
  params.push(limit, offset);
  const { rows } = await client.query(
    `SELECT ${CARD_COLUMNS}, COUNT(*) OVER() AS total_count
     FROM listings l
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return paginate(rows, page);
}

export async function findNearby(client: PoolClient, userId: string, query: NearbyListingsQuery) {
  const { lat, lng, radiusKm, page, limit: pageSize, ...filters } = query;
  const box = boundingBox(lat, lng, radiusKm);
  const params: unknown[] = [userId];
  const where = filterClauses(filters, params);
  params.push(lat, lng, box.minLat, box.maxLat, box.minLng, box.maxLng, radiusKm);
  const p = params.length; // $p is radiusKm; lat is $p-6, lng $p-5, ...
  const { limit, offset } = toLimitOffset({ page, limit: pageSize });
  params.push(limit, offset);

  // Inner query: the indexed box plus the exact haversine distance.
  // Outer query: drop the corners of the box outside the radius, sort by distance.
  const { rows } = await client.query(
    `SELECT *, COUNT(*) OVER() AS total_count FROM (
       SELECT ${CARD_COLUMNS},
              6371 * 2 * asin(least(1, sqrt(
                power(sin(radians(l.latitude - $${p - 6}) / 2), 2) +
                cos(radians($${p - 6})) * cos(radians(l.latitude)) * power(sin(radians(l.longitude - $${p - 5}) / 2), 2)
              ))) AS distance_km
       FROM listings l
       WHERE ${where}
         AND l.latitude BETWEEN $${p - 4} AND $${p - 3}
         AND l.longitude BETWEEN $${p - 2} AND $${p - 1}
     ) nearby
     WHERE distance_km <= $${p}
     ORDER BY distance_km
     LIMIT $${p + 1} OFFSET $${p + 2}`,
    params
  );
  const result = paginate(rows, { page, limit: pageSize });
  return { ...result, data: result.data.map((r) => ({ ...r, distance_km: Math.round(Number(r.distance_km) * 10) / 10 })) };
}

export async function listByOwner(client: PoolClient, userId: string, status: ListingStatus | undefined, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await client.query(
    `SELECT ${CARD_COLUMNS}, l.rejection_reason,
            (SELECT COUNT(*)::int FROM listing_requests r WHERE r.listing_id = l.id AND r.status = 'pending') AS pending_requests,
            COUNT(*) OVER() AS total_count
     FROM listings l
     WHERE l.owner_id = $1 AND ($2::text IS NULL OR l.status = $2)
     ORDER BY l.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, status ?? null, limit, offset]
  );
  return paginate(rows, page);
}

// The row as the caller is allowed to see it (RLS), or undefined.
export async function findById(client: PoolClient, listingId: string) {
  const { rows } = await client.query<ListingRow & Record<string, unknown>>(
    `SELECT l.id, l.owner_id, l.title, l.description, l.rent_paise::float8 AS rent_paise, l.room_type,
            l.furnishing, l.amenities, l.locality, l.city, l.state, l.pincode,
            l.latitude::float8 AS latitude, l.longitude::float8 AS longitude, l.available_from::text AS available_from,
            l.status, l.rejection_reason, l.created_at, l.updated_at
     FROM listings l WHERE l.id = $1`,
    [listingId]
  );
  return rows[0];
}

export async function listImages(client: PoolClient, listingId: string) {
  const { rows } = await client.query<{ id: string; url: string; public_id: string; is_primary: boolean }>(
    "SELECT id, url, public_id, is_primary FROM listing_images WHERE listing_id = $1 ORDER BY is_primary DESC, created_at",
    [listingId]
  );
  return rows;
}

// API field name -> column, for insert and partial update.
function toColumns(input: UpdateListingInput) {
  const cols: Record<string, unknown> = {};
  if (input.title !== undefined) cols.title = input.title;
  if (input.description !== undefined) cols.description = input.description;
  if (input.rent !== undefined) cols.rent_paise = toPaise(input.rent);
  if (input.roomType !== undefined) cols.room_type = input.roomType;
  if (input.furnishing !== undefined) cols.furnishing = input.furnishing;
  if (input.amenities !== undefined) cols.amenities = input.amenities;
  if (input.locality !== undefined) cols.locality = input.locality;
  if (input.city !== undefined) cols.city = input.city;
  if (input.state !== undefined) cols.state = input.state;
  if (input.pincode !== undefined) cols.pincode = input.pincode;
  if (input.latitude !== undefined) cols.latitude = input.latitude;
  if (input.longitude !== undefined) cols.longitude = input.longitude;
  if (input.availableFrom !== undefined) cols.available_from = input.availableFrom;
  return cols;
}

export async function insert(client: PoolClient, id: string, ownerId: string, input: CreateListingInput) {
  const cols = { id, owner_id: ownerId, ...toColumns(input) };
  const names = Object.keys(cols);
  await client.query(
    `INSERT INTO listings (${names.join(", ")}) VALUES (${names.map((_, i) => `$${i + 1}`).join(", ")})`,
    Object.values(cols)
  );
}

// Column names come from toColumns' fixed list, never from the request.
export async function update(client: PoolClient, id: string, input: UpdateListingInput, status?: ListingStatus) {
  const cols = toColumns(input);
  if (status) cols.status = status;
  const names = Object.keys(cols);
  if (names.length === 0) return;
  await client.query(
    `UPDATE listings SET ${names.map((n, i) => `${n} = $${i + 2}`).join(", ")} WHERE id = $1`,
    [id, ...Object.values(cols)]
  );
}

export async function setStatus(client: PoolClient, id: string, status: ListingStatus) {
  await client.query("UPDATE listings SET status = $2 WHERE id = $1", [id, status]);
}

export async function remove(client: PoolClient, id: string) {
  await client.query("DELETE FROM listings WHERE id = $1", [id]);
}
