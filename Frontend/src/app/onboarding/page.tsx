"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PartyPopper } from "lucide-react";
import { apiAuthPost, apiAuthPatch, errorMessage } from "@/lib/api";
import { useRequireAuth, useLogout } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/Logo";
import { Stepper } from "@/components/ui/Stepper";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PhoneField } from "@/components/ui/PhoneField";
import { CreateRoomForm } from "@/components/rooms/CreateRoomForm";
import { JoinRoomForm } from "@/components/rooms/JoinRoomForm";
import { InviteShare } from "@/components/rooms/InviteShare";

const STEPS = ["Your profile", "Your first room", "Invite roommates"];

type FirstRoom =
  | { mode: "created"; id: string; name: string; inviteCode: string }
  | { mode: "joined"; id: string; name: string }
  | { mode: "skipped" };

interface OnboardingResponse {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  onboarding_completed: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth({ requireOnboarding: false });
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useLogout();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [roomMode, setRoomMode] = useState<"create" | "join">("create");
  const [firstRoom, setFirstRoom] = useState<FirstRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (user?.onboardingCompleted) router.replace("/dashboard");
  }, [user, router]);

  // Saved now (without completing onboarding) because creating a room in the
  // next step requires a phone number server-side, and a duplicate number
  // should be caught here rather than at the very end.
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    try {
      await apiAuthPatch("/api/users/me", { name, phone });
      setStep(1);
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your details"));
    } finally {
      setSavingProfile(false);
    }
  }

  function chooseRoom(room: FirstRoom) {
    setFirstRoom(room);
    setStep(2);
  }

  // Onboarding only counts as complete here, at the very end - a user who
  // drops off halfway lands back in onboarding next time, not the dashboard.
  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      const updated = await apiAuthPost<OnboardingResponse>("/api/users/me/onboarding", { name, phone });
      setUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        picture: updated.picture ?? undefined,
        onboardingCompleted: updated.onboarding_completed,
      });
      router.push(firstRoom && firstRoom.mode !== "skipped" ? `/rooms/${firstRoom.id}` : "/dashboard");
    } catch (err) {
      setError(errorMessage(err, "Couldn't finish setup. Please try again."));
      setFinishing(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between border-b border-card-border">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Logo size={32} /> RooMates
        </div>
        <button onClick={logout} className="text-sm font-medium hover:text-primary">
          Log out
        </button>
      </header>

      <div className="border-b border-card-border py-5 px-4">
        <Stepper steps={STEPS} current={step} />
      </div>

      <main className="flex-1 flex justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {step === 0 && (
            <>
              <StepHeading title={`Welcome${name ? `, ${name.split(" ")[0]}` : ""}!`} subtitle="Let's set up your account. This takes under a minute." />
              <Card as="form" onSubmit={saveProfile} className="p-8 flex flex-col gap-4 rounded-3xl">
                <TextField label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
                <PhoneField value={phone} onChange={setPhone} hint="One account per mobile number. Your roommates can use it to reach you." />
                <FormMessage error={error} />
                <Button type="submit" variant="dark" className="mt-2" loading={savingProfile} disabled={!name.trim() || phone.length !== 10}>
                  {savingProfile ? "Saving..." : "Continue"}
                </Button>
              </Card>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading title="Set up your first room" subtitle="A room is one shared group — your flat, or a trip with friends." />
              <Card className="p-8 rounded-3xl">
                <div className="mb-6">
                  <SegmentedControl
                    value={roomMode}
                    onChange={setRoomMode}
                    options={[
                      { value: "create", label: "Create a room" },
                      { value: "join", label: "Join with a code" },
                    ]}
                  />
                </div>
                {roomMode === "create" ? (
                  <CreateRoomForm submitLabel="Create & continue" onCreated={(r) => chooseRoom({ mode: "created", id: r.id, name: r.name, inviteCode: r.inviteCode })} />
                ) : (
                  <JoinRoomForm submitLabel="Join & continue" onJoined={(r) => chooseRoom({ mode: "joined", id: r.id, name: r.name })} />
                )}
              </Card>
              <div className="flex items-center justify-between mt-5">
                <button onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <button onClick={() => chooseRoom({ mode: "skipped" })} className="text-sm font-medium text-primary">
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === 2 && firstRoom && (
            <>
              {firstRoom.mode === "created" ? (
                <StepHeading title="Invite your roommates" subtitle={`Share this code so others can join "${firstRoom.name}".`} />
              ) : (
                <StepHeading
                  title="You're all set!"
                  subtitle={
                    firstRoom.mode === "joined"
                      ? `You've joined "${firstRoom.name}". Invite others from the room page anytime.`
                      : "You can create or join a room from your dashboard whenever you're ready."
                  }
                />
              )}
              <Card className="p-8 rounded-3xl flex flex-col gap-5">
                {firstRoom.mode === "created" ? (
                  <InviteShare roomName={firstRoom.name} inviteCode={firstRoom.inviteCode} />
                ) : (
                  <div className="flex justify-center py-4">
                    <span className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <PartyPopper className="h-8 w-8" />
                    </span>
                  </div>
                )}
                <FormMessage error={error} />
                <Button variant="dark" onClick={finish} loading={finishing}>
                  {finishing ? "Finishing..." : firstRoom.mode === "skipped" ? "Go to dashboard" : "Finish & open room"}
                </Button>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">{title}</h1>
      <p className="text-foreground/55">{subtitle}</p>
    </div>
  );
}
