import { z } from "zod";
import { paginationQuery } from "../../utils/pagination";

const userFilters = {
  search: z.string().trim().max(100).optional(),
  // active / inactive = used / not used in the last 30 days. Default: everyone except deleted.
  status: z.enum(["active", "inactive", "suspended", "deleted"]).optional(),
  sort: z.enum(["newest", "oldest", "last_active", "least_active"]).optional(),
};

export const usersQuery = paginationQuery.extend({
  ...userFilters,
  // owners = group owners + people in no group (members are listed under their owner)
  view: z.enum(["owners", "all"]).optional(),
});

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

export const planSchema = z.object({ plan: z.enum(["basic", "standard", "premium"]) });

export const upgradeRequestsQuery = paginationQuery.extend({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

const rupees = z.coerce.number().min(0).max(100_000);
const count = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

// One plan in the price list, as the admin's Pricing form sends it (prices in rupees).
export const planCatalogSchema = z.object({
  name: z.string().trim().min(2).max(30),
  tagline: z.string().trim().max(120),
  priceMonthly: rupees,
  priceYearly: rupees,
  maxRooms: count(1, 100),
  maxMembersPerRoom: count(2, 100),
  maxListings: count(0, 100),
  unlimited: z.boolean(),
  features: z.object({ roomFund: z.boolean(), billSections: z.boolean(), findRoom: z.boolean() }),
  support: z.string().trim().min(1).max(40),
});
export type PlanCatalogInput = z.infer<typeof planCatalogSchema>;

export const planIdParam = z.enum(["basic", "standard", "premium"]);

export const decisionNoteSchema = z.object({ note: z.string().trim().max(500).optional() });

export const optionalReasonSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const resolveReportSchema = z.object({
  action: z.enum(["dismiss", "resolve", "remove_listing"]),
  note: z.string().trim().max(300).optional(),
});

export const idParam = z.string().uuid("Invalid id");
