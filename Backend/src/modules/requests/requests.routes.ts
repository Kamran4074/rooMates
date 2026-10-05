import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import * as c from "./requests.controller";

// Mounted at /api/requests.
const router = Router();

router.use(authenticate);

router.post("/", c.handleCreate);
router.get("/sent", c.handleSent);
router.get("/received", c.handleReceived);
router.patch("/:requestId", c.handleRespond);

export default router;
