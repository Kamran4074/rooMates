import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { deleteAccountLimiter } from "../../middlewares/rateLimit";
import { handleCompleteOnboarding, handleDeleteAccount, handleUpdateProfile, handleGetMe } from "./users.controller";

const router = Router();

router.use(authenticate);

router.get("/me", handleGetMe);
router.patch("/me", handleUpdateProfile);
router.post("/me/onboarding", handleCompleteOnboarding);
// POST, not DELETE: it carries a body (password), which some proxies drop on DELETE.
router.post("/me/delete", deleteAccountLimiter, handleDeleteAccount);

export default router;
