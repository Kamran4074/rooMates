import { Request, Response } from "express";
import { roomIdParam } from "../../utils/validation";
import { createExpenseSchema } from "./expenses.schema";
import { createExpense, listExpenses, getRoomBalances } from "./expenses.service";

export async function handleCreateExpense(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const expense = await createExpense(req.auth!.sub, roomId, createExpenseSchema.parse(req.body));
  res.status(201).json(expense);
}

export async function handleListExpenses(req: Request, res: Response) {
  res.json(await listExpenses(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleGetBalances(req: Request, res: Response) {
  res.json(await getRoomBalances(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}
