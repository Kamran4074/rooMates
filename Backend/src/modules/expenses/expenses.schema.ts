import { z } from "zod";

export const createExpenseSchema = z
  .object({
    description: z.string().min(1, "Description is required").max(200),
    amount: z.number().positive("Amount must be positive"),
    splitType: z.enum(["equal", "custom"]),
    splits: z
      .array(z.object({ userId: z.string().uuid(), amount: z.number().nonnegative() }))
      .optional(),
  })
  .refine((data) => data.splitType === "equal" || (data.splits && data.splits.length > 0), {
    message: "splits are required when splitType is 'custom'",
    path: ["splits"],
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

const roomId = z.string().uuid("Invalid room id").optional();

export const monthExpensesQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  roomId,
});

export const monthlySummaryQuerySchema = z.object({ roomId });

export type MonthExpensesQuery = z.infer<typeof monthExpensesQuerySchema>;
