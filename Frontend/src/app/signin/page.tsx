"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost, ApiError, errorMessage } from "@/lib/api";
import { AuthResponse, useCompleteAuth, useRedirectIfAuthenticated } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

export default function SignInPage() {
  useRedirectIfAuthenticated();
  const router = useRouter();
  const completeAuth = useCompleteAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      completeAuth(await apiPost<AuthResponse>("/api/auth/login", { email, password }));
    } catch (err) {
      // 403 = correct password but email not verified yet; backend already emailed a fresh code.
      if (err instanceof ApiError && err.status === 403) {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(errorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold mb-2">Sign In</h1>
      <p className="text-foreground/50 mb-8">Enter your email and password to sign in!</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="info@gmail.com"
        />
        <div>
          <PasswordField
            label="Password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          <Link href="/forgot-password" className="block text-right text-sm text-primary mt-1.5">
            Forgot Password?
          </Link>
        </div>

        <FormMessage error={error} />

        <Button type="submit" loading={loading} className="mt-2">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <GoogleAuthButton onError={setError} />

      <p className="text-sm text-foreground/60 mt-8">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary font-medium">
          Sign Up
        </Link>
      </p>
    </AuthShell>
  );
}
