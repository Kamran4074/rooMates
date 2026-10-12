import { NextFunction, Request, Response } from "express";
import { PoolClient } from "pg";
import { adminPool } from "../config/db";
import { Feature, FEATURE_NAMES } from "../config/plans";
import { listPlans, PlanInfo, PlanRow, toPlanInfo } from "../modules/plans/plans.repository";
import { AppError } from "./errorHandler";

// Plan checks, against the live price list (the super admin can move a
// feature between plans). Two kinds of feature:
//  - your own (Find a room): needs YOUR plan;
//  - a room's (funds, bill sections): needs the plan of the room's owner,
//    who pays for the room - the same rule as the room's size limit.
// Only starting something new is locked: funds and sections a room already
// has keep working after a downgrade.

async function lockedError(feature: Feature, who: "you" | "room") {
  const cheapest = (await listPlans(adminPool)).find((p) => p.features[feature]);
  const where = cheapest ? `on the ${cheapest.name} plan and above` : "not on any plan right now";
  const action = who === "room" ? "The room admin can upgrade to use it." : "Upgrade on the Plans page to use it.";
  return new AppError(`${FEATURE_NAMES[feature]} is ${where}. ${action}`, 403);
}

// My plan as it stands in the price list.
export async function planInfoOf(userId: string): Promise<PlanInfo> {
  const { rows } = await adminPool.query<PlanRow>(
    `SELECT p.* FROM users u
     JOIN organizations o ON o.id = u.organization_id
     JOIN plan_catalog p ON p.id = o.plan
     WHERE u.id = $1`,
    [userId]
  );
  return toPlanInfo(rows[0]);
}

// Route middleware for features of your own plan.
// (Express 5 passes a rejected promise to the error handler.)
export const requireFeature = (feature: Feature) => async (req: Request, _res: Response, next: NextFunction) => {
  if (!(await planInfoOf(req.auth!.sub)).features[feature]) throw await lockedError(feature, "you");
  next();
};

// Inside a service transaction, for features of a room's plan. room_capacity
// only answers members, which the caller already has to be.
export async function requireRoomFeature(client: PoolClient, roomId: string, feature: Feature) {
  const { rows } = await client.query<PlanRow>("SELECT p.* FROM room_capacity($1) c JOIN plan_catalog p ON p.id = c.plan", [roomId]);
  if (rows[0] && !toPlanInfo(rows[0]).features[feature]) throw await lockedError(feature, "room");
}
