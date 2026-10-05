import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleListMyExpenses, handleMonthlySummary } from "./expenses.controller";

// Cross-room views of the caller's expenses (the /api/rooms/:roomId routes
// are per room).
const router = Router();

router.use(authenticate);

router.get("/", handleListMyExpenses);
router.get("/monthly-summary", handleMonthlySummary);

export default router;
