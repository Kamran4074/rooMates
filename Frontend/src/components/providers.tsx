"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const app = <ConfirmProvider>{children}</ConfirmProvider>;
  if (!GOOGLE_CLIENT_ID) return app;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{app}</GoogleOAuthProvider>;
}
