import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

export const createRequestSchema = z.object({
  listingId: z.string().uuid("Invalid listing"),
  message: z.string().trim().max(500).optional(),
});

export const respondToRequestSchema = z.object({
  action: z.enum(["accept", "reject"]),
  // Accepting can also close the listing in the same step ("this room is taken").
  markRented: z.boolean().default(false),
});

const statusFilter = z.enum(["pending", "accepted", "rejected"]).optional();

export const sentRequestsQuery = paginationQuery.extend({ status: statusFilter });
export const receivedRequestsQuery = paginationQuery.extend({
  status: statusFilter,
  listingId: z.string().uuid().optional(),
});

export const requestIdParam = z.string().uuid("Invalid request id");

export type RequestStatus = "pending" | "accepted" | "rejected";
