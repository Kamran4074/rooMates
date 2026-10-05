import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

export const ROOM_TYPES = ["private_room", "shared_room", "entire_flat"] as const;
export const FURNISHING = ["furnished", "semi_furnished", "unfurnished"] as const;
export const AMENITIES = [
  "wifi",
  "ac",
  "parking",
  "washing_machine",
  "kitchen",
  "power_backup",
  "attached_bathroom",
  "geyser",
] as const;
export const REPORT_REASONS = ["fake_listing", "wrong_information", "already_rented", "spam", "other"] as const;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const listingFields = z.object({
  title: z.string().trim().min(5, "Title is too short").max(100),
  description: z.string().trim().min(20, "Describe the room in at least 20 characters").max(2000),
  rent: z.number().positive("Rent must be more than 0").max(1_000_000, "Rent looks too high"),
  roomType: z.enum(ROOM_TYPES),
  furnishing: z.enum(FURNISHING),
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length).default([]),
  locality: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  latitude: latitude.nullable().optional(),
  longitude: longitude.nullable().optional(),
  availableFrom: z.iso.date("Use YYYY-MM-DD"),
});

const bothOrNeither = (d: { latitude?: number | null; longitude?: number | null }) =>
  (d.latitude == null) === (d.longitude == null);
const locationMessage = { message: "Send both latitude and longitude, or neither", path: ["latitude"] };

export const createListingSchema = listingFields.refine(bothOrNeither, locationMessage);
// Partial update: send only what changed.
export const updateListingSchema = listingFields.partial().refine(bothOrNeither, locationMessage);

// Owner-driven status changes. Publishing/rejecting is admin-only and lives
// in the admin module.
export const listingStatusActionSchema = z.object({
  action: z.enum(["submit", "mark_rented", "relist"]),
});

const rupeeQuery = z.coerce.number().positive();

export const searchListingsQuery = paginationQuery.extend({
  city: z.string().trim().min(1).max(60).optional(),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/).optional(),
  minRent: rupeeQuery.optional(),
  maxRent: rupeeQuery.optional(),
  roomType: z.enum(ROOM_TYPES).optional(),
  furnishing: z.enum(FURNISHING).optional(),
  // "Available by" this date: listings whose available_from is on or before it.
  availableBy: z.iso.date().optional(),
});

export const nearbyListingsQuery = searchListingsQuery
  .omit({ city: true, pincode: true })
  .extend({
    lat: z.coerce.number().pipe(latitude),
    lng: z.coerce.number().pipe(longitude),
    radiusKm: z.coerce.number().min(1).max(50).default(10),
  });

export const myListingsQuery = paginationQuery.extend({
  status: z.enum(["draft", "pending", "published", "rejected", "rented", "removed"]).optional(),
});

export const saveImageSchema = z.object({
  publicId: z.string().min(1).max(300),
  url: z.url().max(500),
});

export const reportListingSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(500).optional(),
});

export const idParam = z.string().uuid("Invalid id");

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type UpdateListingInput = z.infer<typeof updateListingSchema>;
export type SearchListingsQuery = z.infer<typeof searchListingsQuery>;
export type NearbyListingsQuery = z.infer<typeof nearbyListingsQuery>;
export type ListingFilters = Omit<SearchListingsQuery, "page" | "limit">;
