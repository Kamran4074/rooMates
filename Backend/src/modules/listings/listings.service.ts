import crypto from "crypto";
import { PoolClient } from "pg";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { PageParams } from "../../utils/pagination";
import { assertOwnUpload, createUploadSignature, deleteImage } from "../../config/imageStorage";
import * as repo from "./listings.repository";
import { ListingRow, ListingStatus } from "./listings.repository";
import {
  CreateListingInput,
  ListingFilters,
  NearbyListingsQuery,
  UpdateListingInput,
} from "./listings.schema";

const MAX_IMAGES = 6;
// Anti-spam: how many listings one account can have that aren't removed/rented.
const MAX_ACTIVE_LISTINGS = 5;

// Object-level authorization. Being signed in isn't enough to change a
// listing - it has to be YOURS. RLS already hides other people's unpublished
// listings (-> 404); a published one is visible but not yours (-> 403).
async function requireOwned(client: PoolClient, listingId: string, userId: string): Promise<ListingRow> {
  const listing = await repo.findById(client, listingId);
  if (!listing) throw new AppError("Listing not found", 404);
  if (listing.owner_id !== userId) throw new AppError("You can only change your own listings", 403);
  if (listing.status === "removed") throw new AppError("This listing was removed by a moderator", 409);
  return listing;
}

// Changing what a live (or rejected) listing says sends it back for review,
// so an approved listing can't be edited into something that wasn't approved.
function statusAfterEdit(status: ListingStatus): ListingStatus | undefined {
  if (status === "published" || status === "rejected") return "pending";
  if (status === "rented") throw new AppError("Relist the room before editing it", 409);
  return undefined; // draft/pending stay as they are
}

export function search(userId: string, filters: ListingFilters, page: PageParams) {
  return withUserContext(userId, (client) => repo.searchPublished(client, userId, filters, page));
}

export function nearby(userId: string, query: NearbyListingsQuery) {
  return withUserContext(userId, (client) => repo.findNearby(client, userId, query));
}

export function mine(userId: string, status: ListingStatus | undefined, page: PageParams) {
  return withUserContext(userId, (client) => repo.listByOwner(client, userId, status, page));
}

export async function getDetail(userId: string, listingId: string) {
  return withUserContext(userId, async (client) => {
    const listing = await repo.findById(client, listingId);
    if (!listing) throw new AppError("Listing not found", 404);
    const { owner_id, ...rest } = listing;
    const isMine = owner_id === userId;
    const images = (await repo.listImages(client, listingId)).map(({ public_id: _p, ...img }) => img);

    // Owners see how many people are interested; everyone else sees whether
    // they've already asked (so the button can say "Request sent").
    const { rows } = await client.query<{ status: string; count: number }>(
      isMine
        ? "SELECT status, COUNT(*)::int AS count FROM listing_requests WHERE listing_id = $1 GROUP BY status"
        : "SELECT status, 1 AS count FROM listing_requests WHERE listing_id = $1 AND requester_id = $2",
      isMine ? [listingId] : [listingId, userId]
    );
    return {
      ...rest,
      is_mine: isMine,
      images,
      ...(isMine
        ? { request_counts: Object.fromEntries(rows.map((r) => [r.status, r.count])) }
        : { my_request_status: rows[0]?.status ?? null }),
    };
  });
}

export async function create(userId: string, input: CreateListingInput) {
  return withUserContext(userId, async (client) => {
    // The phone number is how an accepted roommate reaches the owner.
    const me = await client.query<{ phone: string | null }>("SELECT phone FROM users WHERE id = $1", [userId]);
    if (!me.rows[0]?.phone) throw new AppError("Add your mobile number in Settings before listing a room", 403);

    const { rows } = await client.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM listings WHERE owner_id = $1 AND status NOT IN ('removed', 'rented')",
      [userId]
    );
    if (rows[0].count >= MAX_ACTIVE_LISTINGS) {
      throw new AppError(`You can have up to ${MAX_ACTIVE_LISTINGS} active listings`, 403);
    }

    const id = crypto.randomUUID();
    await repo.insert(client, id, userId, input); // starts as 'draft' (column default)
    return { id, status: "draft" as const };
  });
}

export async function update(userId: string, listingId: string, input: UpdateListingInput) {
  return withUserContext(userId, async (client) => {
    const listing = await requireOwned(client, listingId, userId);
    const nextStatus = statusAfterEdit(listing.status);
    await repo.update(client, listingId, input, nextStatus);
    return { id: listingId, status: nextStatus ?? listing.status };
  });
}

// Owner-side lifecycle. Approve/reject are the admin's (admin module).
const OWNER_TRANSITIONS: Record<"submit" | "mark_rented" | "relist", { from: ListingStatus[]; to: ListingStatus }> = {
  submit: { from: ["draft", "rejected"], to: "pending" },
  mark_rented: { from: ["published"], to: "rented" },
  relist: { from: ["rented"], to: "pending" },
};

export async function changeStatus(userId: string, listingId: string, action: keyof typeof OWNER_TRANSITIONS) {
  return withUserContext(userId, async (client) => {
    const listing = await requireOwned(client, listingId, userId);
    const { from, to } = OWNER_TRANSITIONS[action];
    if (!from.includes(listing.status)) {
      throw new AppError(`Can't ${action.replace("_", " ")} a listing that is ${listing.status}`, 409);
    }
    await repo.setStatus(client, listingId, to);
    // Once it's rented, nobody else's request can still be "pending".
    if (to === "rented") {
      await client.query(
        "UPDATE listing_requests SET status = 'rejected', updated_at = now() WHERE listing_id = $1 AND status = 'pending'",
        [listingId]
      );
    }
    return { id: listingId, status: to };
  });
}

export async function remove(userId: string, listingId: string) {
  const publicIds = await withUserContext(userId, async (client) => {
    const listing = await repo.findById(client, listingId);
    if (!listing) throw new AppError("Listing not found", 404);
    if (listing.owner_id !== userId) throw new AppError("You can only delete your own listings", 403);
    const images = await repo.listImages(client, listingId);
    await repo.remove(client, listingId); // photos, requests and reports cascade
    return images.map((i) => i.public_id);
  });
  // Files are deleted only after the DB delete committed.
  await Promise.all(publicIds.map(deleteImage));
}

// ---------------- Photos ----------------

async function requireRoomForPhoto(client: PoolClient, listingId: string) {
  const { rows } = await client.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM listing_images WHERE listing_id = $1",
    [listingId]
  );
  if (rows[0].count >= MAX_IMAGES) throw new AppError(`A listing can have up to ${MAX_IMAGES} photos`, 400);
  return rows[0].count;
}

export async function signImageUpload(userId: string, listingId: string) {
  return withUserContext(userId, async (client) => {
    await requireOwned(client, listingId, userId);
    await requireRoomForPhoto(client, listingId);
    return createUploadSignature(listingId);
  });
}

export async function addImage(userId: string, listingId: string, image: { publicId: string; url: string }) {
  assertOwnUpload(listingId, image.publicId, image.url);
  return withUserContext(userId, async (client) => {
    const listing = await requireOwned(client, listingId, userId);
    const existing = await requireRoomForPhoto(client, listingId);
    const id = crypto.randomUUID();
    await client.query(
      "INSERT INTO listing_images (id, listing_id, url, public_id, is_primary) VALUES ($1, $2, $3, $4, $5)",
      [id, listingId, image.url, image.publicId, existing === 0] // first photo becomes the cover
    );
    const nextStatus = statusAfterEdit(listing.status);
    if (nextStatus) await repo.setStatus(client, listingId, nextStatus);
    return { id, url: image.url, is_primary: existing === 0 };
  });
}

export async function removeImage(userId: string, listingId: string, imageId: string) {
  const publicId = await withUserContext(userId, async (client) => {
    await requireOwned(client, listingId, userId);
    const { rows } = await client.query<{ public_id: string; is_primary: boolean }>(
      "DELETE FROM listing_images WHERE id = $1 AND listing_id = $2 RETURNING public_id, is_primary",
      [imageId, listingId]
    );
    if (!rows[0]) throw new AppError("Photo not found", 404);
    // Deleting the cover promotes the oldest remaining photo.
    if (rows[0].is_primary) {
      await client.query(
        `UPDATE listing_images SET is_primary = true
         WHERE id = (SELECT id FROM listing_images WHERE listing_id = $1 ORDER BY created_at LIMIT 1)`,
        [listingId]
      );
    }
    return rows[0].public_id;
  });
  await deleteImage(publicId);
}

export async function setCoverImage(userId: string, listingId: string, imageId: string) {
  return withUserContext(userId, async (client) => {
    await requireOwned(client, listingId, userId);
    const { rows } = await client.query("SELECT 1 FROM listing_images WHERE id = $1 AND listing_id = $2", [imageId, listingId]);
    if (!rows[0]) throw new AppError("Photo not found", 404);
    // Clear the old cover first: the unique index allows one primary per listing.
    await client.query("UPDATE listing_images SET is_primary = false WHERE listing_id = $1 AND is_primary", [listingId]);
    await client.query("UPDATE listing_images SET is_primary = true WHERE id = $1", [imageId]);
  });
}

// ---------------- Reports ----------------

export async function report(userId: string, listingId: string, input: { reason: string; description?: string }) {
  return withUserContext(userId, async (client) => {
    const listing = await repo.findById(client, listingId);
    if (!listing || listing.status !== "published") throw new AppError("Listing not found", 404);
    if (listing.owner_id === userId) throw new AppError("You can't report your own listing", 400);
    try {
      await client.query(
        "INSERT INTO listing_reports (listing_id, reported_by, reason, description) VALUES ($1, $2, $3, $4)",
        [listingId, userId, input.reason, input.description || null]
      );
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new AppError("You've already reported this listing", 409);
      throw err;
    }
  });
}
