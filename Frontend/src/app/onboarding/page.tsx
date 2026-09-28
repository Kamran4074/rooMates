"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";

interface OnboardingResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  picture: string | null;
  onboarding_completed: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth({ requireOnboarding: false });
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.onboardingCompleted) router.replace("/dashboard");
    else if (user?.name) setName(user.name);
  }, [user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiAuthPost<OnboardingResponse>("/api/users/me/onboarding", {
        name,
        phone: phone || undefined,
      });
      setUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        picture: updated.picture ?? undefined,
        onboardingCompleted: updated.onboarding_completed,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Failed to save your details"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-24 mb-6">
        <Image src="/roomates-icon.png" alt="RooMates" width={290} height={259} className="w-full h-auto" />
      </div>

      <h1 className="text-2xl font-bold mb-1">Let&apos;s finish setting you up</h1>
      <p className="text-foreground/60 mb-8 text-center max-w-sm">
        Just a couple of details before you jump into your rooms.
      </p>

      <Card as="form" onSubmit={handleSubmit} className="shadow-xl shadow-primary/5 p-8 flex flex-col gap-4 w-full max-w-sm">
        <TextField label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
        <TextField
          label="Phone number (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="For roommates to reach you"
        />

        <FormMessage error={error} />

        <Button type="submit" loading={submitting} className="mt-2">
          {submitting ? "Saving..." : "Continue to dashboard"}
        </Button>
      </Card>
    </div>
  );
}
