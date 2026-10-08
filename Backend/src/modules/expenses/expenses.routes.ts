import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCreateExpense, handleListExpenses, handleGetBalances, handleDeleteExpense } from "./expenses.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post("/expenses", handleCreateExpense);
router.get("/expenses", handleListExpenses);
router.delete("/expenses/:expenseId", handleDeleteExpense);
router.get("/balances", handleGetBalances);

export default router;
