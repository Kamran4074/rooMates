"use client";

import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { apiPost, errorMessage } from "@/lib/api";
import { AuthResponse, useCompleteAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { TermsNotice } from "@/components/TermsCheckbox";

const googleEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

// "OR continue with Google" block shared by sign-in and sign-up. Google
// signs up and signs in through the same endpoint (find-or-create), so a
// brand-new user must accept the terms here. Pass `agreed` to gate the button
// on a terms checkbox; omit it and a "by continuing you agree" line is shown instead.
export function GoogleAuthButton({
  agreed: checkboxAgreed,
  onError,
}: {
  agreed?: boolean;
  onError: (message: string | null) => void;
}) {
  const completeAuth = useCompleteAuth();
  const hasCheckbox = checkboxAgreed !== undefined;
  const agreed = checkboxAgreed ?? true;

  async function handleSuccess(credential: CredentialResponse) {
    if (!credential.credential) return;
    onError(null);
    try {
      completeAuth(await apiPost<AuthResponse>("/api/auth/google", { idToken: credential.credential, agreedToTerms: agreed }));
    } catch (err) {
      onError(errorMessage(err, "Google sign-in failed. Please try again."));
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-card-border" />
        <span className="text-xs text-foreground/40">OR</span>
        <div className="h-px flex-1 bg-card-border" />
      </div>

      {/* Google's own button is an iframe that can't be disabled and only renders
          on allowed origins, so until it's usable we show a lookalike placeholder. */}
      {agreed && googleEnabled ? (
        <div className="flex justify-center min-h-11">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={() => onError("Google sign-in was cancelled or failed.")}
            shape="pill"
            width="320"
          />
        </div>
      ) : (
        <Button type="button" variant="outline" disabled className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
      )}

      {!hasCheckbox && <TermsNotice prefix="By continuing with Google you agree to the" />}
      {!agreed && <p className="text-xs text-foreground/45 text-center mt-2">Tick the box above to continue with Google.</p>}
      {agreed && !googleEnabled && (
        <p className="text-xs text-danger text-center mt-2">Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env to enable this.</p>
      )}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
