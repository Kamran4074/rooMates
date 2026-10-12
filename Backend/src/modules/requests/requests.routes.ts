import { Router } from "express";
import { requireFeature } from "../../middlewares/planGate";
import { authenticate } from "../../middlewares/authenticate";
import * as c from "./requests.controller";

// Mounted at /api/requests.
const router = Router();

router.use(authenticate);

router.post("/", requireFeature("findRoom"), c.handleCreate);
router.get("/sent", c.handleSent);
router.get("/received", c.handleReceived);
router.patch("/:requestId", c.handleRespond);

export default router;
