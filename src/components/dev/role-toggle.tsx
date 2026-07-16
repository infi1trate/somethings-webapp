"use client";

// Dev/demo scaffolding — not product UI. Lets you flip between the two sides of
// the review loop (the mentor's onboarding flow and the admin review console)
// without real auth. Mounted from the root layout in ALL environments (incl. the
// Vercel demo) so reviewers can switch sides — there's no auth gate behind it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

export function DevRoleToggle() {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");
  const isApp = pathname.startsWith("/app");
  const mounted = useMounted();
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);
  // Published mentors live in the mentor app (Settings), not the onboarding flow.
  // Guard on `mounted` so SSR/first paint matches (avoids a hydration mismatch).
  const mentorHref = mounted && everPublished ? "/app" : "/onboarding";

  // "Mentor+login": jump to the logged-in mentor app (/app/profile). If the demo
  // profile hasn't been published yet, silently do what admin-approve does first
  // (status → published + snapshot the draft) so this tab always lands on the
  // real logged-in view, never the "Not published yet" placeholder. getState()
  // reads live store state inside the handler (no stale closure / SSR concerns).
  // Hard navigation (not router.push): flipping the store to published makes the
  // onboarding surfaces' everPublished guards fire router.replace("/app"), which
  // races with (and clobbers) a client-side push to /app/profile.
  const openMentorApp = () => {
    const s = useOnboardingStore.getState();
    if (s.publishedSnapshot === null) {
      s.setStatus("published");
      s.capturePublishedSnapshot();
    }
    window.location.assign("/app/profile");
  };

  const tab = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
      active ? "bg-foreground text-background" : "text-foreground hover:bg-muted"
    );

  return (
    // On /app* the new §5 sidebar rail (92px) owns the bottom-left corner —
    // shift right of it so the rail's utility circles stay clear (Phase 7).
    <div
      className={cn(
        "fixed bottom-3 z-50 flex items-center gap-1 rounded-full border border-dashed border-foreground/40 bg-card/95 p-1 pl-2.5 text-xs shadow-md backdrop-blur",
        isApp ? "left-[104px]" : "left-3"
      )}
    >
      <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">
        Dev
      </span>
      <Link href={mentorHref} className={tab(!isAdmin && !isApp)}>
        Mentor
      </Link>
      <button type="button" onClick={openMentorApp} className={tab(isApp)}>
        Mentor+login
      </button>
      <Link href="/admin/users" className={tab(isAdmin)}>
        Admin
      </Link>
    </div>
  );
}
