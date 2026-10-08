import { z } from "zod";

// Today's date in India - expense dates are calendar days in the app's time zone.
export const todayInIndia = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const createExpenseSchema = z
  .object({
    description: z.string().trim().min(1, "Description is required").max(200),
    amount: z.number().positive("Amount must be positive"),
    splitType: z.enum(["equal", "custom"]),
    splits: z
      .array(z.object({ userId: z.string().uuid(), amount: z.number().nonnegative() }))
      .optional(),
    // Who paid. Defaults to whoever is adding it; must be a room member.
    paidBy: z.string().uuid("Invalid member").optional(),
    // The bill's section (Rent, Groceries...). Its people are who share an
    // equal split, unless participantIds says otherwise for this expense.
    categoryId: z.string().uuid("Invalid section").optional(),
    // Equal split only: who shares this expense. Default: the section's
    // people, or everyone in the room.
    participantIds: z.array(z.string().uuid("Invalid member")).min(1, "Pick at least one person").max(100).optional(),
    // The day it was spent (YYYY-MM-DD). Defaults to today.
    expenseDate: z.iso
      .date("Use YYYY-MM-DD")
      .refine((d) => d <= todayInIndia(), "The date can't be in the future")
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
