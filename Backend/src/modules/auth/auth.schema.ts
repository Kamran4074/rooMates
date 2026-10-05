import { z } from "zod";

// Normalised before anything else sees it: emails are case-insensitive in
// practice, and the DB only accepts lowercase (users_email_lowercase).
const email = z.string().trim().toLowerCase().email("Invalid email");
// bcrypt silently ignores everything after 72 bytes, so a longer password
// would "work" while only part of it actually protects the account.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Password must be at most 72 characters");
const otpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
// Enforced server-side too - a client-only checkbox can be bypassed with a raw API call.
const agreedToTerms = z.literal(true, { error: "You must accept the Terms and Conditions" });

// Google users may never see the signup form, so the Google button is where they accept the terms.
export const googleLoginSchema = z.object({
  accessToken: z.string().min(1, "accessToken is required"),
  agreedToTerms,
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  password,
  agreedToTerms,
});

// No terms flag: password accounts accepted them when signing up.
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export const emailOnlySchema = z.object({ email });

export const verifyEmailSchema = z.object({ email, code: otpCode });

export const resetPasswordSchema = z.object({ email, code: otpCode, newPassword: password });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
