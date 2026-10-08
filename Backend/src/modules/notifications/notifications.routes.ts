import { Request, Response, Router } from "express";
import { z } from "zod";
import { authenticate } from "../../middlewares/authenticate";
import { paginationQuery } from "../../utils/pagination";
import { sendNoContent, sendSuccess } from "../../utils/response";
import { listNotifications, markSeen, unreadCount } from "./notifications.service";
import { addStream, MAX_STREAMS_PER_USER } from "../../config/realtime";

// Mounted at /api/notifications: the activity feed of every room I'm in.
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

// Live updates (Server-Sent Events): stays open; an "activity" event means
// "something changed in one of your rooms - refresh". See config/realtime.ts.
router.get("/stream", (req: Request, res: Response) => {
  res.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // don't let a proxy buffer the stream
  });
  res.flushHeaders();
  if (!addStream(req.auth!.sub, res)) {
    const message = `Too many open tabs (max ${MAX_STREAMS_PER_USER})`;
    res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    res.end();
  }
});

router.post("/seen", async (req: Request, res: Response) => {
  await markSeen(req.auth!.sub);
  sendNoContent(res);
});

export default router;
