import { loginSchema, signupSchema } from "./auth.schema";

const validSignup = { name: "Kamran", email: "kamran@gmail.com", password: "password123", agreedToTerms: true };

describe("auth schemas", () => {
  it("normalises email case and whitespace so one inbox is one account", () => {
    const parsed = loginSchema.parse({ email: "  Kamran@Gmail.COM ", password: "x" });
    expect(parsed.email).toBe("kamran@gmail.com");
  });

  it("rejects passwords bcrypt would silently truncate (over 72 bytes)", () => {
    expect(signupSchema.safeParse({ ...validSignup, password: "a".repeat(72) }).success).toBe(true);
    expect(signupSchema.safeParse({ ...validSignup, password: "a".repeat(73) }).success).toBe(false);
    // Multi-byte characters count by bytes, not characters: 25 x 3 bytes = 75.
    expect(signupSchema.safeParse({ ...validSignup, password: "₹".repeat(25) }).success).toBe(false);
  });

  it("requires accepting the terms on signup", () => {
    expect(signupSchema.safeParse({ ...validSignup, agreedToTerms: false }).success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    expect(signupSchema.safeParse({ ...validSignup, name: "   " }).success).toBe(false);
  });
});
