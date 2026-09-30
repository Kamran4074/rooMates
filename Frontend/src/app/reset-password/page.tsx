"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiPost, errorMessage } from "@/lib/api";
import { AuthResponse, useCompleteAuth, useRedirectIfAuthenticated } from "@/lib/auth";
import { AuthShell } from "@/components/AuthShell";
import { OtpInput } from "@/components/ui/OtpInput";
import { PasswordField } from "@/components/ui/PasswordField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { ResendCodeButton } from "@/components/ResendCodeButton";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  useRedirectIfAuthenticated();
  const email = useSearchParams().get("email") ?? "";
  const completeAuth = useCompleteAuth();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      completeAuth(await apiPost<AuthResponse>("/api/auth/reset-password", { email, code, newPassword }));
    } catch (err) {
      setError(errorMessage(err, "Could not reset password"));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    await apiPost("/api/auth/forgot-password", { email });
    setNotice("A new code is on its way.");
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-bold mb-2">Reset password</h1>
      <p className="text-foreground/50 mb-8">
        If an account exists for <span className="font-medium text-foreground">{email || "that email"}</span>, we&apos;ve
        sent it a 6-digit code. Can&apos;t find it? Check your Spam folder.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <OtpInput value={code} onChange={setCode} />
        <PasswordField
          label="New Password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <PasswordField
          label="Confirm New Password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
        />
        <FormMessage error={error} success={notice} />
        <Button type="submit" loading={loading} disabled={code.length !== 6}>
          {loading ? "Resetting..." : "Reset password & sign in"}
        </Button>
      </form>

      <div className="flex items-center justify-between mt-6">
        <ResendCodeButton onResend={handleResend} />
        <Link href="/signin" className="text-sm text-foreground/60">
          Back to Sign In
        </Link>
      </div>
    </AuthShell>
  );
}
