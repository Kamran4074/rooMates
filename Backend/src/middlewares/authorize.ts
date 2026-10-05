import { Request, Response, NextFunction } from "express";
import { withUserContext } from "../config/db";
import { AppError } from "./errorHandler";
import type { PlatformRole } from "../modules/auth/auth.service";

// Use after `authenticate`. The role is read from the database on every call,
// never from the JWT or the request body: demoting or suspending an admin takes
// effect immediately, not when their 15-minute token expires. That's one
// primary-key lookup per admin request, and admin traffic is tiny.
export function authorize(...allowed: PlatformRole[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.auth!.sub;
    const { rows } = await withUserContext(userId, (client) =>
      client.query<{ role: PlatformRole; suspended_at: Date | null }>(
        "SELECT role, suspended_at FROM users WHERE id = $1",
        [userId]
      )
    );
    const me = rows[0];
    if (!me || me.suspended_at || !allowed.includes(me.role)) {
      throw new AppError("You don't have access to this", 403);
    }
    next();
  };
}
