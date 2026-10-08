import { z } from "zod";

// Rupees as typed by people; converted to paise in the service.
const rupees = z.number().positive("Amount must be positive").max(10_000_000, "Amount is too large");
const userId = z.string().uuid("Invalid member");

export const createFundSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  amountPerMember: rupees,
  // Who holds the cash. Defaults to the room admin.
  collectorId: userId.optional(),
});

export const contributionSchema = z.object({
  memberId: userId,
  amount: rupees,
  note: z.string().trim().max(200).optional(),
});

export const spendSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200),
  amount: rupees,
});

export const disputeSchema = z.object({
  note: z.string().trim().min(3, "Say what's wrong, e.g. \"I paid 1000, not 1500\"").max(200),
});

export const fundIdParam = z.string().uuid("Invalid fund id");
export const entryIdParam = z.string().uuid("Invalid entry id");

export type CreateFundInput = z.infer<typeof createFundSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type SpendInput = z.infer<typeof spendSchema>;
