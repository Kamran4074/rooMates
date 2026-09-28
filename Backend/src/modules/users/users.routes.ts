import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCompleteOnboarding } from "./users.controller";

const router = Router();

router.use(authenticate);

router.post("/me/onboarding", handleCompleteOnboarding);

export default router;
