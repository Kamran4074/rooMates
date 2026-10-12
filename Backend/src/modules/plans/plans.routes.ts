import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import * as c from "./plans.controller";

// Mounted at /api/plans. The price list is public (the pricing page shows it
// to visitors); everything else is the signed-in user's own plan.
const router = Router();

router.get("/", c.handleCatalog);
router.get("/me", authenticate, c.handleMyPlan);
router.post("/upgrade-requests", authenticate, c.handleCreateRequest);
router.post("/upgrade-requests/:requestId/cancel", authenticate, c.handleCancelRequest);

export default router;
