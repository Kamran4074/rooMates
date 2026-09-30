"use client";

import { useState } from "react";
import { apiAuthPatch, errorMessage } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Me } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Avatar } from "@/components/ui/Avatar";
import { PhoneField, toLocalDigits } from "@/components/ui/PhoneField";

export default function SettingsPage() {
  const { data: me, error } = useApiQuery<Me>("/api/users/me");

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile." />
      {me ? <ProfileForm me={me} /> : error ? <FormMessage error={error} /> : <p className="text-foreground/50">Loading...</p>}
    </>
  );
}

// Mounted only once the profile has loaded, so the form fields can start from
// the server values directly instead of being copied in by an effect.
function ProfileForm({ me }: { me: Me }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(toLocalDigits(me.phone));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiAuthPatch<Me>("/api/users/me", { name, phone });
      if (user) setUser({ ...user, name: updated.name });
      setSuccess("Profile saved.");
    } catch (err) {
      setError(errorMessage(err, "Failed to save profile"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="rounded-3xl p-6 sm:p-8 max-w-2xl">
      <h2 className="font-semibold mb-6">Profile</h2>
      <div className="flex items-center gap-4 mb-8">
        <Avatar name={name} picture={me.picture} size={56} />
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-foreground/55">{me.email}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <TextField label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
        <PhoneField value={phone} onChange={setPhone} />
        <div className="sm:col-span-2">
          <TextField label="Email" value={me.email} disabled className="opacity-60 cursor-not-allowed" />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <FormMessage error={error} success={success} />
        <Button type="submit" variant="dark" size="sm" loading={saving} disabled={phone.length !== 10} className="ml-auto">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </Card>
  );
}
