"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost, errorMessage } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export default function SignUpPage() {
  useRedirectIfAuthenticated();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/api/auth/signup", {
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
        agreedToTerms: agreed,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(errorMessage(err, "Sign up failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold mb-2">Sign Up</h1>
      <p className="text-foreground/50 mb-8">Enter your details below to create your account!</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="First Name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
          />
          <TextField
            label="Last Name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
          />
        </div>

        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
        />

        <PasswordField
          label="Password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
        />

        <PasswordField
          label="Confirm Password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
        />

        <label className="flex items-start gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            By creating an account means you agree to the{" "}
            <Link href="/terms" target="_blank" className="text-primary font-medium">
              Terms and Conditions
            </Link>
            , and our{" "}
            <Link href="/privacy" target="_blank" className="text-primary font-medium">
              Privacy Policy
            </Link>
          </span>
        </label>

        <FormMessage error={error} />

        <Button type="submit" loading={loading} disabled={!agreed} className="mt-2">
          {loading ? "Creating account..." : "Sign Up"}
        </Button>
      </form>

      <p className="text-sm text-foreground/60 mt-8">
        Already have an account?{" "}
        <Link href="/signin" className="text-primary font-medium">
          Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
