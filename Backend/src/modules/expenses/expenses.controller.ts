import { Request, Response } from "express";
import { roomIdParam, uuidParam } from "../../utils/validation";
import { paginationQuery } from "../../utils/pagination";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import { createExpenseSchema, monthExpensesQuerySchema, monthlySummaryQuerySchema } from "./expenses.schema";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  getRoomBalances,
  listMyExpenses,
  getMonthlySummary,
} from "./expenses.service";

export async function handleCreateExpense(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const expense = await createExpense(req.auth!.sub, roomId, createExpenseSchema.parse(req.body));
  sendCreated(res, expense, "Expense added");
}

export async function handleDeleteExpense(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  await deleteExpense(req.auth!.sub, roomId, uuidParam("expense").parse(req.params.expenseId));
  sendNoContent(res);
}

export async function handleListExpenses(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const { data, pagination } = await listExpenses(req.auth!.sub, roomId, paginationQuery.parse(req.query));
  sendSuccess(res, data, { pagination });
}

export async function handleGetBalances(req: Request, res: Response) {
  sendSuccess(res, await getRoomBalances(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

// Not paginated: always one month of one person's rooms, which stays small.
export async function handleListMyExpenses(req: Request, res: Response) {
  sendSuccess(res, await listMyExpenses(req.auth!.sub, monthExpensesQuerySchema.parse(req.query)));
}

export async function handleMonthlySummary(req: Request, res: Response) {
  const { roomId } = monthlySummaryQuerySchema.parse(req.query);
  sendSuccess(res, await getMonthlySummary(req.auth!.sub, roomId));
}
