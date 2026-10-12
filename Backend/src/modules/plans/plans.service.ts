import { pool, withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { Plan } from "../../config/plans";
import { getPlan, listPlans } from "./plans.repository";
import { UpgradeRequestInput } from "./plans.schema";

// The public price list (GET /api/plans): the pricing page, onboarding and
// the Plans page all render from this; the super admin edits it.
export const catalog = () => listPlans(pool);

const REQUEST_COLUMNS = "id, plan, billing_cycle, amount_paise, phone, note, status, created_at, decided_at, admin_note";

// My plan, what it allows, how much of it I use, and my latest upgrade request.
export async function getMyPlan(userId: string) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{
      plan: Plan;
      plan_expires_at: Date | null;
      max_rooms: number;
      max_members_per_room: number;
      room_count: number;
      listing_count: number;
    }>(
      `SELECT o.plan, o.plan_expires_at, o.max_rooms, o.max_members_per_room, count_org_rooms(o.id) AS room_count,
              (SELECT COUNT(*)::int FROM listings l WHERE l.owner_id = u.id AND l.status NOT IN ('removed', 'rented')) AS listing_count
       FROM users u JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [userId]
    );
    const me = rows[0];
    const plan = await getPlan(client, me.plan);
    const latest = await client.query(
      `SELECT ${REQUEST_COLUMNS} FROM plan_upgrade_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return {
      plan: me.plan,
      expiresAt: me.plan_expires_at,
      limits: { maxRooms: me.max_rooms, maxMembersPerRoom: me.max_members_per_room, maxListings: plan.maxListings },
      features: plan.features,
      usage: { rooms: Number(me.room_count), listings: me.listing_count },
      latestRequest: latest.rows[0] ?? null,
    };
  });
}

export async function createUpgradeRequest(userId: string, input: UpgradeRequestInput) {
  return withUserContext(userId, async (client) => {
    // The price quoted now is what they pay, even if the list changes later.
    const plan = await getPlan(client, input.plan);
    try {
      const { rows } = await client.query(
        `INSERT INTO plan_upgrade_requests (user_id, plan, billing_cycle, amount_paise, phone, note)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${REQUEST_COLUMNS}`,
        [userId, input.plan, input.billingCycle, plan.price[input.billingCycle], input.phone, input.note || null]
      );
      return rows[0];
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        throw new AppError("You already have a plan request waiting - we'll call you soon. Cancel it to ask for a different plan.", 409);
      }
      throw err;
    }
  });
}

export async function cancelUpgradeRequest(userId: string, requestId: string) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query(
      `UPDATE plan_upgrade_requests SET status = 'cancelled', decided_at = now()
       WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING ${REQUEST_COLUMNS}`,
      [requestId, userId]
    );
    if (!rows[0]) throw new AppError("No waiting request to cancel", 404);
    return rows[0];
  });
}
