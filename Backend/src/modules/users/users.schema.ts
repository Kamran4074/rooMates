import { z } from "zod";

// Accepts "9876543210", "098765 43210", "+91 98765-43210" etc. and stores the
// canonical "+919876543210", so the same number can't be registered twice
// just by writing it differently. Indian mobiles only, for now.
export const indianMobile = z
  .string({ error: "Phone number is required" })
  .transform((value) => {
    let digits = value.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
  })
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"))
  .transform((digits) => `+91${digits}`);

// Same shape for first-time onboarding and later edits from Settings.
export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: indianMobile,
});

export type ProfileInput = z.infer<typeof profileSchema>;
