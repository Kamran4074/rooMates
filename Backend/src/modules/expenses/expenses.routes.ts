import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCreateExpense, handleListExpenses, handleGetBalances } from "./expenses.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post("/expenses", handleCreateExpense);
router.get("/expenses", handleListExpenses);
router.get("/balances", handleGetBalances);

export default router;
