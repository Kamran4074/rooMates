import { adminPool } from "../../config/db";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";

// Onboarding funnel for the super admin: how far each person got.
//
//   signed up -> email verified -> profile completed (phone) -> in a group -> first expense = activated
//
// Every step has a timestamp (users.email_verified_at / onboarding_completed_at,
// first room_members.joined_at, first live expense they added or paid), so
// "current stage" is the first missing step, and "days waiting" is the time
// since their last completed step. Only regular accounts count: super admins
// and deleted accounts are left out.

export const STAGES = ["email_verified", "profile_completed", "joined_group", "first_expense", "activated"] as const;
export type Stage = (typeof STAGES)[number];
export type OnboardingFilter = "all" | "stuck" | "activated" | "dormant" | `waiting_${Exclude<Stage, "activated">}`;
export type OnboardingSort = "newest" | "oldest" | "waiting_longest" | "waiting_shortest";

export const STUCK_AFTER_DAYS = 3;
export const DORMANT_AFTER_DAYS = 30;

const FUNNEL_SQL = `
  WITH base AS (
    SELECT u.id, u.name, u.email, u.phone, u.picture, u.created_at, u.last_active_at,
           u.email_verified_at, u.onboarding_completed_at,
           (SELECT min(rm.joined_at) FROM room_members rm WHERE rm.user_id = u.id) AS joined_group_at,
           (SELECT min(e.created_at) FROM expenses e
             WHERE e.deleted_at IS NULL AND (e.created_by = u.id OR e.paid_by = u.id)) AS first_expense_at
    FROM users u
    WHERE u.deleted_at IS NULL AND u.role = 'user'
  ),
  staged AS (
    SELECT b.*,
           CASE WHEN b.email_verified_at IS NULL THEN 'email_verified'
                WHEN b.onboarding_completed_at IS NULL THEN 'profile_completed'
                WHEN b.joined_group_at IS NULL THEN 'joined_group'
                WHEN b.first_expense_at IS NULL THEN 'first_expense'
                ELSE 'activated' END AS stage,
           -- GREATEST skips NULLs: the latest step they did complete.
           GREATEST(b.created_at, b.email_verified_at, b.onboarding_completed_at, b.joined_group_at, b.first_expense_at) AS last_step_at
    FROM base b
  ),
  scored AS (
    SELECT s.*,
           CASE WHEN s.stage = 'activated' THEN NULL
                ELSE floor(extract(epoch FROM now() - s.last_step_at) / 86400)::int END AS days_waiting,
           (s.last_active_at IS NULL OR s.last_active_at < now() - interval '${DORMANT_AFTER_DAYS} days') AS dormant
    FROM staged s
  )`;

// Closed enums from Zod mapped to fixed SQL - never user text.
const FILTER_SQL: Record<OnboardingFilter, string> = {
  all: "true",
  stuck: `stage <> 'activated' AND days_waiting >= ${STUCK_AFTER_DAYS}`,
  activated: "stage = 'activated'",
  dormant: "dormant",
  waiting_email_verified: "stage = 'email_verified'",
  waiting_profile_completed: "stage = 'profile_completed'",
  waiting_joined_group: "stage = 'joined_group'",
  waiting_first_expense: "stage = 'first_expense'",
};
const SORT_SQL: Record<OnboardingSort, string> = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  waiting_longest: "days_waiting DESC NULLS LAST, created_at ASC",
  waiting_shortest: "days_waiting ASC NULLS LAST, created_at DESC",
};

export async function getOnboarding(
  filters: { search?: string; filter?: OnboardingFilter; sort?: OnboardingSort },
  page: PageParams
) {
  const { limit, offset } = toLimitOffset(page);
  const client = await adminPool.connect();
  try {
    // Funnel + tab counts over everyone (the search box doesn't change them).
    const counts = await client.query(
      `${FUNNEL_SQL}
       SELECT COUNT(*)::int AS signed_up,
              COUNT(email_verified_at)::int AS email_verified,
              COUNT(onboarding_completed_at)::int AS profile_completed,
              COUNT(joined_group_at)::int AS joined_group,
              COUNT(first_expense_at)::int AS first_expense,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.stuck})::int AS stuck,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.activated})::int AS activated,
              COUNT(*) FILTER (WHERE dormant)::int AS dormant,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.waiting_email_verified})::int AS waiting_email_verified,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.waiting_profile_completed})::int AS waiting_profile_completed,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.waiting_joined_group})::int AS waiting_joined_group,
              COUNT(*) FILTER (WHERE ${FILTER_SQL.waiting_first_expense})::int AS waiting_first_expense
       FROM scored`
    );

    const { rows } = await client.query(
      `${FUNNEL_SQL}
       SELECT id, name, email, phone, picture, created_at, last_active_at,
              email_verified_at, onboarding_completed_at, joined_group_at, first_expense_at,
              stage, days_waiting, dormant, COUNT(*) OVER() AS total_count
       FROM scored
       WHERE ${FILTER_SQL[filters.filter ?? "all"]}
         AND ($1::text IS NULL OR name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR phone LIKE '%' || $1 || '%')
       ORDER BY ${SORT_SQL[filters.sort ?? "newest"]}, id
       LIMIT $2 OFFSET $3`,
      [filters.search || null, limit, offset]
    );

    const { data, pagination } = paginate(rows, page);
    return { counts: counts.rows[0], items: data, pagination };
  } finally {
    client.release();
  }
}
