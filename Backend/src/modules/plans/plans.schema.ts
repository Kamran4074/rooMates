import { z } from "zod";
import { indianMobile } from "../users/users.schema";

export const upgradeRequestSchema = z.object({
  plan: z.enum(["standard", "premium"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  // Where the super admin calls them to take the payment.
  phone: indianMobile,
  note: z.string().trim().max(500).optional(),
});
export type UpgradeRequestInput = z.infer<typeof upgradeRequestSchema>;
