import { Router } from "express";
import { contactLimiter } from "../../middlewares/rateLimit";
import { handleContact } from "./contact.controller";

const router = Router();

router.post("/", contactLimiter, handleContact);

export default router;
