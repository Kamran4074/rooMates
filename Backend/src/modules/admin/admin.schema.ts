import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

const userFilters = {
  search: z.string().trim().max(100).optional(),
  // active / inactive = used / not used in the last 30 days. Default: everyone except deleted.
  status: z.enum(["active", "inactive", "suspended", "deleted"]).optional(),
  sort: z.enum(["newest", "oldest", "last_active", "least_active"]).optional(),
};

export const usersQuery = paginationQuery.extend(userFilters);

export const onboardingQuery = paginationQuery.extend({
  search: z.string().trim().max(100).optional(),
  filter: z
    .enum([
      "all",
      "stuck",
      "activated",
      "dormant",
      "waiting_email_verified",
      "waiting_profile_completed",
      "waiting_joined_group",
      "waiting_first_expense",
    ])
    .optional(),
  sort: z.enum(["newest", "oldest", "waiting_longest", "waiting_shortest"]).optional(),
});

// The CSV export takes the same filters, without paging.
export const usersExportQuery = z.object(userFilters);

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
