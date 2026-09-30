"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiPost, errorMessage } from "@/lib/api";
import { AuthResponse, useCompleteAuth, useRedirectIfAuthenticated } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { OtpInput } from "@/components/ui/OtpInput";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { ResendCodeButton } from "@/components/ResendCodeButton";

// useSearchParams must sit inside a Suspense boundary, or `next build` fails
// for this route (it silently works in dev, which is how this usually slips).
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

function VerifyEmailForm() {
  useRedirectIfAuthenticated();
  const email = useSearchParams().get("email") ?? "";
  const completeAuth = useCompleteAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      completeAuth(await apiPost<AuthResponse>("/api/auth/verify-email", { email, code }));
    } catch (err) {
      setError(errorMessage(err, "Verification failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    await apiPost("/api/auth/resend-verification", { email });
    setNotice("A new code is on its way.");
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold mb-2">Verify your email</h1>
      <p className="text-foreground/50 mb-8">
        We&apos;ve sent a 6-digit code to <span className="font-medium text-foreground">{email || "your email"}</span>.
        Can&apos;t find it? Check your Spam folder.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <OtpInput value={code} onChange={setCode} />
        <FormMessage error={error} success={notice} />
        <Button type="submit" loading={loading} disabled={code.length !== 6}>
          {loading ? "Verifying..." : "Verify & continue"}
        </Button>
      </form>

      <div className="flex items-center justify-between mt-6">
        <ResendCodeButton onResend={handleResend} />
        <Link href="/signup" className="text-sm text-foreground/60">
          Wrong email?
        </Link>
      </div>
    </AuthShell>
  );
}
