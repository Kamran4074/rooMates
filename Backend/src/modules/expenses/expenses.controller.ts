import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createExpenseSchema } from "./expenses.schema";
import { createExpense, listExpenses, getRoomBalances } from "./expenses.service";

const roomIdParamSchema = z.string().uuid("Invalid room id");

export async function handleCreateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = roomIdParamSchema.parse(req.params.roomId);
    const input = createExpenseSchema.parse(req.body);
    const expense = await createExpense(req.auth!.sub, roomId, input);
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function handleListExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = roomIdParamSchema.parse(req.params.roomId);
    const expenses = await listExpenses(req.auth!.sub, roomId);
    res.status(200).json(expenses);
  } catch (err) {
    next(err);
  }
}

export async function handleGetBalances(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = roomIdParamSchema.parse(req.params.roomId);
    const balances = await getRoomBalances(req.auth!.sub, roomId);
    res.status(200).json(balances);
  } catch (err) {
    next(err);
  }
}
