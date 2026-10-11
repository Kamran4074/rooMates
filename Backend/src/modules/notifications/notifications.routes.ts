import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/authenticate";
import { paginationQuery } from "../../utils/pagination";
import { sendNoContent, sendSuccess } from "../../utils/response";
import { listNotifications, markSeen, unreadCount } from "./notifications.service";

// Mounted at /api/notifications: the activity feed of every room I'm in.
// (Live updates arrive over the WebSocket at /api/ws - see config/realtime.ts.)
const router = Router();
router.use(authenticate);

export const notificationsQuery = paginationQuery.extend({
  roomId: z.string().uuid("Invalid room id").optional(),
});

router.get("/", async (req: Request, res: Response) => {
  const { roomId, page, limit } = notificationsQuery.parse(req.query);
  const { data, pagination } = await listNotifications(req.auth!.sub, roomId, { page, limit });
  sendSuccess(res, data, { pagination });
});

router.get("/unread-count", async (req: Request, res: Response) => {
  sendSuccess(res, await unreadCount(req.auth!.sub));
});

router.post("/seen", async (req: Request, res: Response) => {
  await markSeen(req.auth!.sub);
  sendNoContent(res);
});

export default router;
