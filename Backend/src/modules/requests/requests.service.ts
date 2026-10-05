import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { RequestStatus } from "./requests.schema";

// "I'm interested" -> owner accepts or rejects.
// Contact details (phone/email) are only shared once a request is ACCEPTED,
// and only between those two people. RLS (is_listing_counterparty) decides
// whose user row each side may read at all; the queries below decide which
// columns, based on the request's status.

export async function createRequest(userId: string, listingId: string, message?: string) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{ owner_id: string; status: string }>(
      "SELECT owner_id, status FROM listings WHERE id = $1",
      [listingId]
    );
    const listing = rows[0];
    if (!listing || listing.status !== "published") throw new AppError("Listing not found", 404);
    if (listing.owner_id === userId) throw new AppError("This is your own listing", 400);

    try {
      const { rows: created } = await client.query<{ id: string }>(
        "INSERT INTO listing_requests (listing_id, requester_id, message) VALUES ($1, $2, $3) RETURNING id",
        [listingId, userId, message || null]
      );
      return { id: created[0].id, status: "pending" as const };
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new AppError("You've already sent a request for this room", 409);
      throw err;
    }
  });
}

// Requests I sent, with the owner's contact once accepted.
export async function listSent(userId: string, status: RequestStatus | undefined, page: PageParams) {
  return withUserContext(userId, async (client) => {
    const { limit, offset } = toLimitOffset(page);
    const { rows } = await client.query(
      `SELECT r.id, r.status, r.message, r.created_at, r.updated_at,
              l.id AS listing_id, l.title AS listing_title, l.city AS listing_city, l.locality AS listing_locality,
              l.rent_paise::float8 AS listing_rent_paise, l.status AS listing_status,
              u.name AS owner_name,
              CASE WHEN r.status = 'accepted' THEN u.phone END AS owner_phone,
              CASE WHEN r.status = 'accepted' THEN u.email END AS owner_email,
              COUNT(*) OVER() AS total_count
       FROM listing_requests r
       JOIN listings l ON l.id = r.listing_id
       LEFT JOIN users u ON u.id = l.owner_id
       WHERE r.requester_id = $1 AND ($2::text IS NULL OR r.status = $2)
       ORDER BY r.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, status ?? null, limit, offset]
    );
    return paginate(rows, page);
  });
}

// Requests on my listings ("interested people"), with their contact once accepted.
export async function listReceived(
  userId: string,
  filters: { status?: RequestStatus; listingId?: string },
  page: PageParams
) {
  return withUserContext(userId, async (client) => {
    const { limit, offset } = toLimitOffset(page);
    const { rows } = await client.query(
      `SELECT r.id, r.status, r.message, r.created_at, r.updated_at,
              l.id AS listing_id, l.title AS listing_title, l.status AS listing_status,
              u.name AS requester_name, u.picture AS requester_picture,
              CASE WHEN r.status = 'accepted' THEN u.phone END AS requester_phone,
              CASE WHEN r.status = 'accepted' THEN u.email END AS requester_email,
              COUNT(*) OVER() AS total_count
       FROM listing_requests r
       JOIN listings l ON l.id = r.listing_id
       LEFT JOIN users u ON u.id = r.requester_id
       WHERE l.owner_id = $1
         AND ($2::text IS NULL OR r.status = $2)
         AND ($3::uuid IS NULL OR l.id = $3)
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC
       LIMIT $4 OFFSET $5`,
      [userId, filters.status ?? null, filters.listingId ?? null, limit, offset]
    );
    return paginate(rows, page);
  });
}

// Accept/reject. When accepting also marks the room rented, three writes must
// happen together - the request, the listing, and rejecting everyone else
// still waiting - so they share one transaction (withUserContext is one).
export async function respond(userId: string, requestId: string, action: "accept" | "reject", markRented: boolean) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{ status: RequestStatus; listing_id: string; owner_id: string; listing_status: string }>(
      `SELECT r.status, r.listing_id, l.owner_id, l.status AS listing_status
       FROM listing_requests r JOIN listings l ON l.id = r.listing_id
       WHERE r.id = $1`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw new AppError("Request not found", 404);
    if (request.owner_id !== userId) throw new AppError("Only the listing's owner can answer this request", 403);
    if (request.status !== "pending") throw new AppError(`This request was already ${request.status}`, 409);

    // Check-and-set in one statement: if two clicks race, only one UPDATE
    // still finds the row pending; the other changes nothing and gets a 409.
    const status = action === "accept" ? "accepted" : "rejected";
    const updated = await client.query(
      "UPDATE listing_requests SET status = $2, updated_at = now() WHERE id = $1 AND status = 'pending'",
      [requestId, status]
    );
    if (updated.rowCount === 0) throw new AppError("This request was just answered", 409);

    if (action === "accept" && markRented) {
      if (request.listing_status !== "published") throw new AppError("Only a live listing can be marked rented", 409);
      await client.query("UPDATE listings SET status = 'rented' WHERE id = $1", [request.listing_id]);
      await client.query(
        `UPDATE listing_requests SET status = 'rejected', updated_at = now()
         WHERE listing_id = $1 AND status = 'pending'`,
        [request.listing_id]
      );
    }
    return { id: requestId, status, listingRented: action === "accept" && markRented };
  });
}
