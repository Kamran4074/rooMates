import { z } from "zod";

export const completeOnboardingSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().max(20).optional(),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
