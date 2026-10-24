import { PoolClient } from "pg";
import { adminPool, withAdminTransaction } from "../../config/db";
import { logger } from "../../config/logger";
import { BILLING_MONTHS, BillingCycle, Plan } from "../../config/plans";
import { listPlans, PlanRow, toPlanInfo } from "../plans/plans.repository";
import { toPaise } from "../../utils/money";
import type { PlanCatalogInput, RoomSort } from "./admin.schema";
import { AppError } from "../../middlewares/errorHandler";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { computeRoomBalances } from "../expenses/expenses.service";
import * as listingRepo from "../listings/listings.repository";
import { anonymiseAccount } from "../users/accountDeletion";

// Super-admin operations. These run on the OWNER connection (adminPool),
// which bypasses RLS - moderation has to see every user, listing and room.
// The only way in is admin.routes.ts, where every route sits behind
// authenticate + authorize("super_admin").
//
// Every change is written to audit_logs inside the same transaction.

async function audit(
  client: PoolClient,
  adminId: string,
  action: string,
  entityType: "user" | "listing" | "report" | "pricing",
  entityId: string,
  details?: Record<string, unknown>
) {
  await client.query(
    "INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
    [adminId, action, entityType, entityId, details ? JSON.stringify(details) : null]
  );
  logger.info("Admin action", { adminId, action, entityType, entityId });
}

// "Active" = signed in or refreshed a session within the window (see
// assertActiveAccount). Deleted (anonymised) accounts are left out of the
// user numbers except deleted_users.
export async function getStats() {
  const { rows } = await adminPool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS total_users,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '7 days') AS new_users_7d,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS new_users_30d,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND last_active_at > now() - interval '7 days') AS active_users_7d,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND last_active_at > now() - interval '30 days') AS active_users_30d,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND suspended_at IS NOT NULL) AS suspended_users,
       (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NOT NULL) AS deleted_users,
       (SELECT COUNT(*)::int FROM rooms) AS total_rooms,
       (SELECT COALESCE(round(avg(n), 1), 0)::float8 FROM (SELECT COUNT(*) AS n FROM room_members GROUP BY room_id) s) AS avg_room_size,
       (SELECT COUNT(*)::int FROM expenses WHERE deleted_at IS NULL) AS total_expenses,
       (SELECT COUNT(DISTINCT owner_id)::int FROM listings) AS listing_owners,
       (SELECT COUNT(*)::int FROM listings) AS total_listings,
       (SELECT COUNT(*)::int FROM listings WHERE status = 'pending') AS pending_listings,
       (SELECT COUNT(*)::int FROM listings WHERE status = 'published') AS published_listings,
       (SELECT COUNT(*)::int FROM listing_reports WHERE status = 'open') AS open_reports`
  );
  return rows[0];
}

// ---------------- Users ----------------

export type UserStatusFilter = "active" | "inactive" | "suspended" | "deleted";
export type UserSort = "newest" | "oldest" | "last_active" | "least_active";
export interface UserFilters {
  search?: string;
  status?: UserStatusFilter;
  sort?: UserSort;
  /**
   * "owners": only people who run a group, or aren't in any group yet - the
   * accounts that stand on their own. Everyone who only joined someone else's
   * group is listed under that owner instead (see listOwnedGroups).
   */
  view?: "owners" | "all";
}

// Runs a group, or isn't in one at all.
const OWNERS_SQL = `(EXISTS (SELECT 1 FROM room_members rm WHERE rm.user_id = u.id AND rm.role = 'admin')
                     OR NOT EXISTS (SELECT 1 FROM room_members rm WHERE rm.user_id = u.id))`;

const USER_STATUS_SQL: Record<UserStatusFilter | "all", string> = {
  all: "u.deleted_at IS NULL",
  active: "u.deleted_at IS NULL AND u.suspended_at IS NULL AND u.last_active_at > now() - interval '30 days'",
  inactive:
    "u.deleted_at IS NULL AND u.suspended_at IS NULL AND (u.last_active_at IS NULL OR u.last_active_at <= now() - interval '30 days')",
  suspended: "u.deleted_at IS NULL AND u.suspended_at IS NOT NULL",
  deleted: "u.deleted_at IS NOT NULL",
};
const USER_SORT_SQL: Record<UserSort, string> = {
  newest: "u.created_at DESC",
  oldest: "u.created_at ASC",
  last_active: "u.last_active_at DESC NULLS LAST",
  least_active: "u.last_active_at ASC NULLS FIRST",
};

// One query for the list and the CSV export, so both always agree.
// Status/sort come from a closed enum (Zod) mapped to fixed SQL - never user text.
function usersQuery(filters: UserFilters, limit: number, offset: number) {
  return adminPool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.picture, u.role, u.suspended_at, u.deleted_at,
            u.created_at, u.last_active_at, u.onboarding_completed, o.plan,
            (u.google_id IS NOT NULL) AS has_google, (u.password_hash IS NOT NULL) AS has_password,
            (SELECT COUNT(*)::int FROM listings l WHERE l.owner_id = u.id) AS listing_count,
            (SELECT COUNT(*)::int FROM room_members rm WHERE rm.user_id = u.id) AS room_count,
            (SELECT COUNT(*)::int FROM room_members rm WHERE rm.user_id = u.id AND rm.role = 'admin') AS owned_group_count,
            -- Distinct people in the groups they run (not counting themselves).
            (SELECT COUNT(DISTINCT m.user_id)::int FROM room_members own
               JOIN room_members m ON m.room_id = own.room_id AND m.user_id <> u.id
              WHERE own.user_id = u.id AND own.role = 'admin') AS people_in_groups,
            COUNT(*) OVER() AS total_count
     FROM users u JOIN organizations o ON o.id = u.organization_id
     WHERE ${USER_STATUS_SQL[filters.status ?? "all"]}
       AND ${filters.view === "owners" ? OWNERS_SQL : "true"}
       AND ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.phone LIKE '%' || $1 || '%')
     ORDER BY ${USER_SORT_SQL[filters.sort ?? "newest"]}, u.id
     LIMIT $2 OFFSET $3`,
    [filters.search || null, limit, offset]
  );
}

export async function listUsers(filters: UserFilters, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await usersQuery(filters, limit, offset);
  return paginate(rows, page);
}

// The groups someone runs, each with its members - what the users table shows
// when an owner's row is expanded.
export async function listOwnedGroups(userId: string) {
  const { rows } = await adminPool.query(
    `SELECT r.id, r.name, r.type, r.created_at,
            COALESCE(json_agg(json_build_object(
              'id', u.id, 'name', u.name, 'email', CASE WHEN u.deleted_at IS NULL THEN u.email END,
              'phone', u.phone, 'picture', u.picture, 'role', m.role, 'joined_at', m.joined_at,
              'last_active_at', u.last_active_at, 'suspended_at', u.suspended_at, 'deleted_at', u.deleted_at
            ) ORDER BY m.role = 'admin' DESC, m.joined_at), '[]') AS members
     FROM room_members own
     JOIN rooms r ON r.id = own.room_id
     JOIN room_members m ON m.room_id = r.id
     JOIN users u ON u.id = m.user_id
     WHERE own.user_id = $1 AND own.role = 'admin'
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    [userId]
  );
  return rows;
}

export const MAX_EXPORT_ROWS = 10_000;

// A spreadsheet treats a cell starting with = + - @ (or a tab/CR) as a
// formula; a user named "=HYPERLINK(...)" could run something on the admin's
// machine. Prefixing ' makes it plain text ("CSV injection"). A plain number
// like a phone "+919876543210" can't be a formula, so it's left as is.
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const iso = (d: Date | null) => (d ? d.toISOString() : "");

// Same filters as the list, as CSV. Exporting personal data is itself
// audit-logged: who exported, how many rows, with which filters.
export async function exportUsersCsv(adminId: string, filters: UserFilters) {
  const { rows } = await usersQuery(filters, MAX_EXPORT_ROWS, 0);
  const header = ["Name", "Email", "Mobile", "Plan", "Profile done", "Groups", "Listings", "Signs in with", "Status", "Joined", "Last active"];
  const lines = rows.map((u) =>
    [
      u.name,
      u.deleted_at ? "" : u.email,
      u.phone,
      u.plan,
      u.onboarding_completed ? "Yes" : "No",
      u.room_count,
      u.listing_count,
      [u.has_google && "Google", u.has_password && "Password"].filter(Boolean).join(" + "),
      u.deleted_at ? "Deleted" : u.suspended_at ? "Suspended" : "Active",
      iso(u.created_at),
      iso(u.last_active_at),
    ]
      .map(csvCell)
      .join(",")
  );

  await withAdminTransaction((client) =>
    audit(client, adminId, "EXPORTED_USERS", "user", adminId, { rows: rows.length, ...filters })
  );
  // BOM so Excel opens UTF-8 names (Hindi, accents) correctly.
  return "﻿" + [header.join(","), ...lines].join("\r\n") + "\r\n";
}

// Everything support needs on one screen: the account, its groups (with
// size and the person's balance in each), listings, sessions and history.
export async function getUser(userId: string) {
  const client = await adminPool.connect();
  try {
    const user = await client.query(
      `SELECT u.id, u.name, u.email, u.phone, u.picture, u.role, u.suspended_at, u.deleted_at,
              u.created_at, u.last_active_at, u.email_verified, u.onboarding_completed,
              (u.google_id IS NOT NULL) AS has_google, (u.password_hash IS NOT NULL) AS has_password,
              o.plan, o.max_rooms, o.max_members_per_room, o.plan_expires_at,
              (SELECT COUNT(*)::int FROM refresh_tokens rt
                WHERE rt.user_id = u.id AND rt.revoked_at IS NULL AND rt.expires_at > now()) AS active_sessions
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [userId]
    );
    if (!user.rows[0]) throw new AppError("User not found", 404);

    const rooms = await client.query(
      `SELECT r.id, r.name, r.type, rm.role, rm.joined_at,
              (SELECT COUNT(*)::int FROM room_members m WHERE m.room_id = r.id) AS member_count,
              COALESCE((SELECT SUM(l.amount_paise) FROM room_ledger l
                        WHERE l.room_id = r.id AND l.user_id = $1), 0)::float8 AS net_paise
       FROM room_members rm JOIN rooms r ON r.id = rm.room_id
       WHERE rm.user_id = $1
       ORDER BY rm.joined_at DESC`,
      [userId]
    );
    const listings = await client.query(
      `SELECT id, title, status, city, created_at FROM listings WHERE owner_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    const history = await client.query(
      `SELECT a.id, a.action, a.details, a.created_at, adm.name AS admin_name
       FROM audit_logs a LEFT JOIN users adm ON adm.id = a.admin_id
       WHERE a.entity_type = 'user' AND a.entity_id = $1
       ORDER BY a.created_at DESC LIMIT 20`,
      [userId]
    );
    return { ...user.rows[0], rooms: rooms.rows, listings: listings.rows, history: history.rows };
  } finally {
    client.release();
  }
}

// "Delete" = anonymise - see anonymiseAccount for exactly what happens.
export async function deleteUser(adminId: string, userId: string, reason: string) {
  if (userId === adminId) throw new AppError("You can't delete your own account", 400);
  return withAdminTransaction(async (client) => {
    const summary = await anonymiseAccount(client, userId, false);
    await audit(client, adminId, "DELETED_USER", "user", userId, { reason, ...summary });
    return { id: userId, deleted: true, ...summary };
  });
}

export async function setSuspended(adminId: string, userId: string, suspend: boolean, reason?: string) {
  if (userId === adminId) throw new AppError("You can't suspend your own account", 400);
  return withAdminTransaction(async (client) => {
    const { rows } = await client.query<{ role: string; suspended_at: Date | null; deleted_at: Date | null }>(
      "SELECT role, suspended_at, deleted_at FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    const user = rows[0];
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role === "super_admin") throw new AppError("Super admins can't be suspended", 403);
    if (Boolean(user.suspended_at) === suspend) {
      throw new AppError(suspend ? "Already suspended" : "This account isn't suspended", 409);
    }

    await client.query("UPDATE users SET suspended_at = $2 WHERE id = $1", [userId, suspend ? new Date() : null]);
    if (suspend) {
      // End every session now. Their current access token still works for
      // at most 15 minutes, but it can't be refreshed.
      await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    }
    await audit(client, adminId, suspend ? "SUSPENDED_USER" : "UNSUSPENDED_USER", "user", userId, reason ? { reason } : undefined);
    return { id: userId, suspended: suspend };
  });
}

// The super admin can also set a plan by hand (a comp, a fix): it has no end
// date. Paid upgrades normally go through upgrade requests below.
// The plan belongs to the user's organization: it sets how many rooms they
// can create, how many people fit in each room they own, and the features.
export async function setPlan(adminId: string, userId: string, plan: Plan) {
  return withAdminTransaction(async (client) => {
    const { rows } = await client.query<{ organization_id: string; plan: Plan; deleted_at: Date | null }>(
      `SELECT u.organization_id, o.plan, u.deleted_at
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1 FOR UPDATE OF o`,
      [userId]
    );
    const user = rows[0];
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.plan === plan) throw new AppError(`Already on the ${plan} plan`, 409);

    const updated = await client.query<{ max_rooms: number; max_members_per_room: number }>(
      `UPDATE organizations o
       SET plan = p.id, max_rooms = p.max_rooms, max_members_per_room = p.max_members_per_room, plan_expires_at = NULL
       FROM plan_catalog p
       WHERE o.id = $1 AND p.id = $2
       RETURNING o.max_rooms, o.max_members_per_room`,
      [user.organization_id, plan]
    );
    await audit(client, adminId, "CHANGED_PLAN", "user", userId, { from: user.plan, to: plan });
    const limits = updated.rows[0];
    return { id: userId, plan, maxRooms: limits.max_rooms, maxMembersPerRoom: limits.max_members_per_room };
  });
}

// ---------------- Pricing ----------------

// The price list with who changed each plan last and how many accounts are on it.
export async function listPricing() {
  const [plans, meta] = await Promise.all([
    listPlans(adminPool),
    adminPool.query<{ id: string; updated_at: Date; updated_by_name: string | null; accounts: number }>(
      `SELECT p.id, p.updated_at, u.name AS updated_by_name,
              (SELECT COUNT(*)::int FROM organizations o WHERE o.plan = p.id) AS accounts
       FROM plan_catalog p LEFT JOIN users u ON u.id = p.updated_by`
    ),
  ]);
  const byId = new Map(meta.rows.map((m) => [m.id, m]));
  return plans.map((p) => ({ ...p, updatedAt: byId.get(p.id)!.updated_at, updatedByName: byId.get(p.id)!.updated_by_name, accounts: byId.get(p.id)!.accounts }));
}

// Changing a plan's limits applies to everyone on it straight away (their
// organization rows are updated in the same transaction). People already
// over a lowered limit keep what they have; they just can't add more.
// Upgrade requests already sent keep the price they were quoted.
export async function updatePricing(adminId: string, id: Plan, input: PlanCatalogInput) {
  const monthly = toPaise(input.priceMonthly);
  const yearly = toPaise(input.priceYearly);
  if (id === "basic" && (monthly !== 0 || yearly !== 0)) throw new AppError("Basic is the free plan - its price stays 0", 400);
  if (id !== "basic" && (monthly <= 0 || yearly <= 0)) throw new AppError("A paid plan needs a monthly and a yearly price", 400);

  return withAdminTransaction(async (client) => {
    const before = await client.query<PlanRow>("SELECT * FROM plan_catalog WHERE id = $1 FOR UPDATE", [id]);
    if (!before.rows[0]) throw new AppError("Plan not found", 404);
    const { rows } = await client.query<PlanRow>(
      `UPDATE plan_catalog SET name = $2, tagline = $3, price_monthly_paise = $4, price_yearly_paise = $5,
              max_rooms = $6, max_members_per_room = $7, max_listings = $8, unlimited = $9,
              feature_room_fund = $10, feature_bill_sections = $11, feature_find_room = $12, support = $13,
              updated_at = now(), updated_by = $14
       WHERE id = $1 RETURNING *`,
      [
        id, input.name, input.tagline, monthly, yearly, input.maxRooms, input.maxMembersPerRoom, input.maxListings, input.unlimited,
        input.features.roomFund, input.features.billSections, input.features.findRoom, input.support, adminId,
      ]
    );
    const accounts = await client.query(
      "UPDATE organizations SET max_rooms = $2, max_members_per_room = $3 WHERE plan = $1 AND (max_rooms, max_members_per_room) IS DISTINCT FROM ($2, $3)",
      [id, input.maxRooms, input.maxMembersPerRoom]
    );

    const old = toPlanInfo(before.rows[0]);
    const now = toPlanInfo(rows[0]);
    const changes = Object.fromEntries(
      (Object.keys(now) as (keyof typeof now)[])
        .filter((k) => JSON.stringify(old[k]) !== JSON.stringify(now[k]))
        .map((k) => [k, { from: old[k], to: now[k] }])
    );
    // Audit entries point at a uuid; pricing has none, so it's filed under the admin like the CSV export.
    await audit(client, adminId, "CHANGED_PRICING", "pricing", adminId, { plan: id, changes, accountsUpdated: accounts.rowCount });
    return now;
  });
}

// ---------------- Upgrade requests ----------------

// Waiting ones oldest first (first asked, first called); decided ones newest first.
export async function listUpgradeRequests(status: string | undefined, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await adminPool.query(
    `SELECT r.id, r.user_id, u.name, u.email, u.picture, o.plan AS current_plan, o.plan_expires_at,
            r.plan, r.billing_cycle, r.amount_paise, r.phone, r.note, r.status, r.created_at, r.decided_at, r.admin_note,
            d.name AS decided_by_name, COUNT(*) OVER() AS total_count
     FROM plan_upgrade_requests r
     JOIN users u ON u.id = r.user_id
     JOIN organizations o ON o.id = u.organization_id
     LEFT JOIN users d ON d.id = r.decided_by
     WHERE ($1::text IS NULL OR r.status = $1)
     ORDER BY CASE WHEN r.status = 'pending' THEN r.created_at END ASC, r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset]
  );
  return paginate(rows, page);
}

// Approve = "they paid": the plan starts now, or - renewing the same plan
// before it ends - is extended from its current end date.
export async function decideUpgradeRequest(adminId: string, requestId: string, approve: boolean, note?: string) {
  return withAdminTransaction(async (client) => {
    const { rows } = await client.query<{
      user_id: string;
      organization_id: string;
      plan: Plan;
      billing_cycle: BillingCycle;
      amount_paise: number;
      status: string;
    }>(
      `SELECT r.user_id, u.organization_id, r.plan, r.billing_cycle, r.amount_paise, r.status
       FROM plan_upgrade_requests r JOIN users u ON u.id = r.user_id
       WHERE r.id = $1 FOR UPDATE OF r`,
      [requestId]
    );
    const request = rows[0];
    if (!request) throw new AppError("Request not found", 404);
    if (request.status !== "pending") throw new AppError(`This request was already ${request.status}`, 409);

    let expiresAt: Date | null = null;
    if (approve) {
      const updated = await client.query<{ plan_expires_at: Date }>(
        `UPDATE organizations o
         SET plan = p.id, max_rooms = p.max_rooms, max_members_per_room = p.max_members_per_room,
             plan_expires_at = CASE WHEN o.plan = p.id AND o.plan_expires_at > now() THEN o.plan_expires_at ELSE now() END
                               + make_interval(months => $3)
         FROM plan_catalog p
         WHERE o.id = $1 AND p.id = $2
         RETURNING o.plan_expires_at`,
        [request.organization_id, request.plan, BILLING_MONTHS[request.billing_cycle]]
      );
      expiresAt = updated.rows[0].plan_expires_at;
    }
    await client.query(
      "UPDATE plan_upgrade_requests SET status = $2, decided_by = $3, decided_at = now(), admin_note = $4 WHERE id = $1",
      [requestId, approve ? "approved" : "rejected", adminId, note || null]
    );
    await audit(client, adminId, approve ? "APPROVED_UPGRADE" : "REJECTED_UPGRADE", "user", request.user_id, {
      requestId,
      plan: request.plan,
      billingCycle: request.billing_cycle,
      amountPaise: request.amount_paise,
      ...(note && { note }),
    });
    return { id: requestId, status: approve ? ("approved" as const) : ("rejected" as const), planExpiresAt: expiresAt };
  });
}

// ---------------- Listings ----------------

export async function listListings(status: listingRepo.ListingStatus | undefined, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await adminPool.query(
    `SELECT l.id, l.title, l.city, l.locality, l.rent_paise::float8 AS rent_paise, l.status, l.created_at, l.updated_at,
            u.name AS owner_name, u.email AS owner_email,
            (SELECT COUNT(*)::int FROM listing_reports r WHERE r.listing_id = l.id AND r.status = 'open') AS open_reports,
            (SELECT i.url FROM listing_images i WHERE i.listing_id = l.id ORDER BY i.is_primary DESC, i.created_at LIMIT 1) AS cover_url,
            COUNT(*) OVER() AS total_count
     FROM listings l JOIN users u ON u.id = l.owner_id
     WHERE ($1::text IS NULL OR l.status = $1)
     -- The review queue reads oldest-first: first come, first reviewed.
     ORDER BY CASE WHEN l.status = 'pending' THEN l.updated_at END ASC, l.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset]
  );
  return paginate(rows, page);
}

export async function getListing(listingId: string) {
  const client = await adminPool.connect();
  try {
    const listing = await listingRepo.findById(client, listingId);
    if (!listing) throw new AppError("Listing not found", 404);
    const [images, owner, reports] = await Promise.all([
      listingRepo.listImages(client, listingId),
      client.query("SELECT id, name, email, phone, suspended_at FROM users WHERE id = $1", [listing.owner_id]),
      client.query(
        `SELECT r.id, r.reason, r.description, r.status, r.created_at, u.name AS reported_by_name
         FROM listing_reports r LEFT JOIN users u ON u.id = r.reported_by
         WHERE r.listing_id = $1 ORDER BY r.created_at DESC`,
        [listingId]
      ),
    ]);
    return { ...listing, images, owner: owner.rows[0], reports: reports.rows };
  } finally {
    client.release();
  }
}

type ModerationAction = "approve" | "reject" | "remove";

const MODERATION: Record<ModerationAction, { from: listingRepo.ListingStatus[]; to: listingRepo.ListingStatus; log: string }> = {
  approve: { from: ["pending"], to: "published", log: "APPROVED_LISTING" },
  reject: { from: ["pending"], to: "rejected", log: "REJECTED_LISTING" },
  remove: { from: ["draft", "pending", "published", "rejected", "rented"], to: "removed", log: "REMOVED_LISTING" },
};

async function moderate(client: PoolClient, adminId: string, listingId: string, action: ModerationAction, reason?: string) {
  const { rows } = await client.query<{ status: listingRepo.ListingStatus }>(
    "SELECT status FROM listings WHERE id = $1 FOR UPDATE",
    [listingId]
  );
  if (!rows[0]) throw new AppError("Listing not found", 404);
  const rule = MODERATION[action];
  if (!rule.from.includes(rows[0].status)) {
    throw new AppError(`Can't ${action} a listing that is ${rows[0].status}`, 409);
  }
  // The rejection reason is shown to the owner so they know what to fix.
  await client.query("UPDATE listings SET status = $2, rejection_reason = $3 WHERE id = $1", [
    listingId,
    rule.to,
    action === "approve" ? null : (reason ?? null),
  ]);
  if (action === "remove") {
    await client.query(
      "UPDATE listing_requests SET status = 'rejected', updated_at = now() WHERE listing_id = $1 AND status = 'pending'",
      [listingId]
    );
  }
  await audit(client, adminId, rule.log, "listing", listingId, reason ? { reason } : undefined);
  return { id: listingId, status: rule.to };
}

export const moderateListing = (adminId: string, listingId: string, action: ModerationAction, reason?: string) =>
  withAdminTransaction((client) => moderate(client, adminId, listingId, action, reason));

// ---------------- Reports ----------------

export async function listReports(status: "open" | "resolved" | "dismissed" | undefined, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await adminPool.query(
    `SELECT r.id, r.reason, r.description, r.status, r.created_at, r.resolved_at,
            l.id AS listing_id, l.title AS listing_title, l.status AS listing_status,
            reporter.name AS reported_by_name, resolver.name AS resolved_by_name,
            COUNT(*) OVER() AS total_count
     FROM listing_reports r
     JOIN listings l ON l.id = r.listing_id
     LEFT JOIN users reporter ON reporter.id = r.reported_by
     LEFT JOIN users resolver ON resolver.id = r.resolved_by
     WHERE ($1::text IS NULL OR r.status = $1)
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset]
  );
  return paginate(rows, page);
}

export async function resolveReport(adminId: string, reportId: string, action: "dismiss" | "resolve" | "remove_listing", note?: string) {
  return withAdminTransaction(async (client) => {
    const { rows } = await client.query<{ listing_id: string; status: string }>(
      "SELECT listing_id, status FROM listing_reports WHERE id = $1 FOR UPDATE",
      [reportId]
    );
    const report = rows[0];
    if (!report) throw new AppError("Report not found", 404);
    if (report.status !== "open") throw new AppError(`This report was already ${report.status}`, 409);

    const newStatus = action === "dismiss" ? "dismissed" : "resolved";
    if (action === "remove_listing") {
      await moderate(client, adminId, report.listing_id, "remove", note ?? "Removed after a report");
      // Removing the listing settles every open report about it, not just this one.
      await client.query(
        "UPDATE listing_reports SET status = 'resolved', resolved_by = $2, resolved_at = now() WHERE listing_id = $1 AND status = 'open'",
        [report.listing_id, adminId]
      );
    } else {
      await client.query("UPDATE listing_reports SET status = $2, resolved_by = $3, resolved_at = now() WHERE id = $1", [
        reportId,
        newStatus,
        adminId,
      ]);
    }
    await audit(client, adminId, action === "dismiss" ? "DISMISSED_REPORT" : "RESOLVED_REPORT", "report", reportId, note ? { note } : undefined);
    return { id: reportId, status: newStatus };
  });
}

// ---------------- Rooms (read-only support view) ----------------
// Lets a super admin see exactly what a room's members see - for support.
// Read-only on purpose: an admin never adds or edits expenses in someone's room.

// Whitelisted ORDER BY per sort (never built from user input). r.id breaks
// ties so paging is stable.
const ROOM_ORDER: Record<RoomSort, string> = {
  newest: "r.created_at DESC, r.id",
  oldest: "r.created_at ASC, r.id",
  largest: "mem.member_count DESC, r.created_at DESC, r.id",
  most_spent: "e.total_spent_paise DESC, r.created_at DESC, r.id",
  recent_activity: "e.last_expense_at DESC NULLS LAST, r.created_at DESC, r.id",
};

// Every group, for the admin's Groups tab and Groups page: who runs it now
// (the room admin - may differ from the creator after a hand-over), size,
// spending, last activity and the members (shown when a row is expanded,
// so it needs no second request). Search matches the group's name or its
// owner's name/email.
export async function listRooms(search: string | undefined, sort: RoomSort, page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await adminPool.query(
    `SELECT r.id, r.name, r.type, r.created_at, cu.name AS created_by_name,
            o.id AS owner_id, o.name AS owner_name, o.picture AS owner_picture,
            CASE WHEN o.deleted_at IS NULL THEN o.email END AS owner_email,
            mem.member_count, mem.members,
            e.expense_count, e.total_spent_paise, e.last_expense_at,
            COUNT(*) OVER() AS total_count
     FROM rooms r
     LEFT JOIN users cu ON cu.id = r.created_by
     LEFT JOIN room_members om ON om.room_id = r.id AND om.role = 'admin'
     LEFT JOIN users o ON o.id = om.user_id
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::int AS member_count,
              COALESCE(json_agg(json_build_object(
                'id', u.id, 'name', u.name, 'email', CASE WHEN u.deleted_at IS NULL THEN u.email END,
                'phone', u.phone, 'picture', u.picture, 'role', m.role, 'joined_at', m.joined_at,
                'last_active_at', u.last_active_at, 'suspended_at', u.suspended_at, 'deleted_at', u.deleted_at
              ) ORDER BY m.role = 'admin' DESC, m.joined_at), '[]') AS members
       FROM room_members m JOIN users u ON u.id = m.user_id
       WHERE m.room_id = r.id
     ) mem
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::int AS expense_count,
              COALESCE(SUM(x.amount_paise), 0)::float8 AS total_spent_paise,
              MAX(x.created_at) AS last_expense_at
       FROM expenses x
       WHERE x.room_id = r.id AND x.deleted_at IS NULL
     ) e
     WHERE ($1::text IS NULL OR r.name ILIKE '%' || $1 || '%' OR o.name ILIKE '%' || $1 || '%' OR o.email ILIKE '%' || $1 || '%')
     ORDER BY ${ROOM_ORDER[sort]}
     LIMIT $2 OFFSET $3`,
    [search || null, limit, offset]
  );
  return paginate(rows, page);
}

export async function getRoom(roomId: string) {
  const client = await adminPool.connect();
  try {
    const room = await client.query("SELECT id, name, type, created_at FROM rooms WHERE id = $1", [roomId]);
    if (!room.rows[0]) throw new AppError("Room not found", 404);
    const members = await client.query(
      `SELECT rm.user_id, rm.role, rm.joined_at, u.name, u.email
       FROM room_members rm JOIN users u ON u.id = rm.user_id WHERE rm.room_id = $1 ORDER BY rm.joined_at`,
      [roomId]
    );
    const expenses = await client.query(
      `SELECT e.id, e.description, e.amount_paise::float8 AS amount_paise, e.expense_date::text AS expense_date, e.created_at, u.name AS paid_by_name
       FROM expenses e LEFT JOIN users u ON u.id = e.paid_by
       WHERE e.room_id = $1 AND e.deleted_at IS NULL ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 50`,
      [roomId]
    );
    // Same balance code members see, just run on the admin connection.
    const balances = await computeRoomBalances(client, roomId);
    return { ...room.rows[0], members: members.rows, recent_expenses: expenses.rows, ...balances };
  } finally {
    client.release();
  }
}

export async function listAuditLogs(page: PageParams) {
  const { limit, offset } = toLimitOffset(page);
  const { rows } = await adminPool.query(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.name AS admin_name,
            COUNT(*) OVER() AS total_count
     FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return paginate(rows, page);
}
