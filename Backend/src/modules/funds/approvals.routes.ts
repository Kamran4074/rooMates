import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleMyPendingApprovals } from "./funds.controller";

// Mounted at /api/fund-approvals: fund payments others recorded for the caller,
// waiting for their approval (across every room they're in).
const router = Router();

router.use(authenticate);
router.get("/", handleMyPendingApprovals);

export default router;
