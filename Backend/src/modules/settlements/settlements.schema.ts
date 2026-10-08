import { z } from "zod";
import { todayInIndia } from "../expenses/expenses.schema";

// "Aman paid Chirag ₹285": money changing hands to settle up, not a new cost.
export const createSettlementSchema = z
  .object({
    fromUserId: z.string().uuid("Invalid member"),
    toUserId: z.string().uuid("Invalid member"),
    amount: z.number().positive("Amount must be positive").max(10_000_000, "Amount is too large"),
    // The day it was paid (YYYY-MM-DD). Defaults to today.
    settledOn: z.iso
      .date("Use YYYY-MM-DD")
      .refine((d) => d <= todayInIndia(), "The date can't be in the future")
      .optional(),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.fromUserId !== d.toUserId, { message: "Pick two different people", path: ["toUserId"] });

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>;
