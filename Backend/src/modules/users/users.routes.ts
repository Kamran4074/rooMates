import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCompleteOnboarding, handleUpdateProfile, handleGetMe } from "./users.controller";

const router = Router();

router.use(authenticate);

router.get("/me", handleGetMe);
router.patch("/me", handleUpdateProfile);
router.post("/me/onboarding", handleCompleteOnboarding);

export default router;
