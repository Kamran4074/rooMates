import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleMyFundStatus } from "./funds.controller";

// Mounted at /api/funds: cross-room views of my funds (per-room routes live
// under /api/rooms/:roomId/funds).
const router = Router();

router.use(authenticate);
router.get("/summary", handleMyFundStatus);

export default router;
