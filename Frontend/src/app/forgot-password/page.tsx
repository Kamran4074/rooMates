"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost, errorMessage } from "@/lib/api";
import { useRedirectIfAuthenticated } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export default function ForgotPasswordPage() {
  useRedirectIfAuthenticated();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/auth/forgot-password", { email });
      router.push(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold mb-2">Forgot password?</h1>
      <p className="text-foreground/50 mb-8">Enter your account email and we&apos;ll send you a code to reset it.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="info@gmail.com"
        />
        <FormMessage error={error} />
        <Button type="submit" loading={loading} className="mt-2">
          {loading ? "Sending code..." : "Send reset code"}
        </Button>
      </form>

      <p className="text-sm text-foreground/60 mt-8">
        Remembered it?{" "}
        <Link href="/signin" className="text-primary font-medium">
          Back to Sign In
        </Link>
      </p>
    </AuthShell>
  );
}
