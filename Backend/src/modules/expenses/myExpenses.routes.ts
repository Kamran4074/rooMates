import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { monthExpensesQuerySchema, monthlySummaryQuerySchema } from "./expenses.schema";
import { listMyExpenses, getMonthlySummary } from "./expenses.service";

// Cross-room views of the caller's expenses (the /api/rooms/:roomId routes
// are per room).
const router = Router();

router.use(authenticate);

router.get("/", async (req, res) => {
  res.json(await listMyExpenses(req.auth!.sub, monthExpensesQuerySchema.parse(req.query)));
});

router.get("/monthly-summary", async (req, res) => {
  const { roomId } = monthlySummaryQuerySchema.parse(req.query);
  res.json(await getMonthlySummary(req.auth!.sub, roomId));
});

export default router;
