import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

export const usersQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  suspended: z.enum(["true", "false"]).optional(),
});

export const listingsQuery = paginationQuery.extend({
  status: z.enum(["draft", "pending", "published", "rejected", "rented", "removed"]).optional(),
});

export const reportsQuery = paginationQuery.extend({
  status: z.enum(["open", "resolved", "dismissed"]).optional(),
});

export const roomsQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Give a short reason").max(300),
});

export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(["dismiss", "resolve", "remove_listing"]),
  note: z.string().trim().max(300).optional(),
});

export const idParam = z.string().uuid("Invalid id");
