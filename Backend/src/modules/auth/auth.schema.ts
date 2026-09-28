import { z } from "zod";

const email = z.string().email("Invalid email");
const password = z.string().min(8, "Password must be at least 8 characters");
const otpCode = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email,
  password,
  // Enforced server-side too - a client-only checkbox can be bypassed with a raw API call.
  agreedToTerms: z.literal(true, { error: "You must accept the Terms and Conditions" }),
});

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
