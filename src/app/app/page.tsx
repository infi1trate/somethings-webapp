"use client";

import { useRouter } from "next/navigation";
import { Home, MessageCircle, Settings } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Moodie } from "@/components/doodles";
import { StatusBadge } from "@/components/onboarding/status-badge";
import { MentorProfilePreview } from "@/components/onboarding/mentor-profile-preview";
import { PhoneFrame } from "@/components/onboarding/phone-frame";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Home", icon: Home },
  { label: "Messages", icon: MessageCircle },
  { label: "Settings", icon: Settings, active: true },
];

export default function AppShellPage() {
  const mounted = useMounted();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const status = useOnboardingStore((s) => s.status);
  const reset = useOnboardingStore((s) => s.reset);

  if (!mounted) return null;

  if (status !== "published") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold">Not published yet</h1>
        <p className="text-sm text-muted-foreground">
          Your profile needs to be approved before you can manage it here.
        </p>
        <Button variant="outline" onClick={() => router.push("/hub")}>
          Back to home
        </Button>
      </main>
    );
  }

  const restart = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-5">
          <Wordmark />
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-8 px-5 py-8">
        {/* Sidebar nav (the mentor app shell) */}
        <nav className="hidden w-44 shrink-0 flex-col gap-1 sm:flex">
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-brand/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent/60"
              )}
            >
              <item.icon
                className={cn("size-4", item.active && "text-brand")}
              />
              {item.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1">
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900">
            <Moodie name="face-excited" className="size-8 shrink-0" />
            <span>
              Your profile is live. Teens can find and message you now.
            </span>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Your profile</h1>
            <Button variant="outline" size="sm" disabled>
              Edit profile
            </Button>
          </div>

          <PhoneFrame>
            <MentorProfilePreview draft={draft} />
          </PhoneFrame>

          <p className="mt-4 text-sm text-muted-foreground">
            Editing your live profile from Settings is coming next (Milestone 2).
          </p>

          <div className="mt-10 border-t pt-6">
            <Button variant="ghost" size="sm" onClick={restart}>
              Restart demo
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
