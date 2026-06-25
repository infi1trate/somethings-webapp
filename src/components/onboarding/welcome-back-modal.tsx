"use client";

// Shown once per session entry when the profile is in "needs changes". Styled to
// match the /submitted "a few things to update" card (Figma 323-1764): a warm
// green header framing this as polish (not a rejection), then the change list as
// tappable rows that jump to each field. Reopenable from the dock.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";
import { PREVIEW_PATH } from "@/lib/onboarding/steps";
import {
  addressedStateOf,
  changeProgress,
  firstUnaddressed,
} from "@/lib/onboarding/change-requests";
import { cn } from "@/lib/utils";

export function WelcomeBackModal() {
  const mounted = useMounted();
  const router = useRouter();
  const status = useOnboardingStore((s) => s.status);
  const changeRequests = useOnboardingStore((s) => s.changeRequests);
  const draft = useOnboardingStore((s) => s.draft);
  const open = useOnboardingStore((s) => s.welcomeOpen);
  const autoShown = useOnboardingStore((s) => s.welcomeAutoShown);
  const setOpen = useOnboardingStore((s) => s.setWelcomeOpen);
  const markAutoShown = useOnboardingStore((s) => s.markWelcomeAutoShown);
  // Post-publish revisions happen in mentor settings, not the wizard.
  const everPublished = useOnboardingStore((s) => s.publishedSnapshot !== null);

  const active =
    mounted &&
    status === "rejected" &&
    changeRequests.length > 0 &&
    !everPublished;

  // Auto-open once per session entry; reopenable from the dock afterward.
  useEffect(() => {
    if (active && !autoShown) {
      markAutoShown();
      setOpen(true);
    }
  }, [active, autoShown, markAutoShown, setOpen]);

  if (!active) return null;

  const { addressed, total, allDone } = changeProgress(changeRequests, draft);
  const firstName = draft.firstName?.trim();
  const target = firstUnaddressed(changeRequests, draft);

  const go = (stepId: string) => {
    setOpen(false);
    router.push(stepHref(stepId));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Warm green header (Figma 323-1764) — frames this as polish, not a
            rejection. Subtitle text is darkened from the mock's grey so it clears
            AA on the green tint; right padding leaves room for the close button. */}
        <DialogHeader className="gap-2 bg-[#dfeddb] py-6 pl-6 pr-12 text-left">
          <DialogTitle className="font-display text-[22px] font-bold leading-[1.15] tracking-tight text-foreground">
            {firstName
              ? `${firstName}, a few things to update`
              : "A few things to update"}
          </DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-foreground/80">
            {`Your reviewer flagged ${total} ${
              total === 1 ? "thing" : "things"
            } to tweak before this goes live. Update each — or confirm it's already right — then resubmit.`}
          </DialogDescription>
        </DialogHeader>

        {/* The list IS the body — each row jumps to its step; a check replaces the
            chevron once that field's been addressed. */}
        <ul className="max-h-[44vh] space-y-2.5 overflow-y-auto px-5 py-5">
          {changeRequests.map((c) => {
            const done = addressedStateOf(c, draft) !== "none";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => go(c.stepId)}
                  className="flex w-full items-center gap-3 rounded-xl border border-foreground/12 py-3 pl-[18px] pr-3 text-left transition-colors hover:border-foreground/25 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-foreground">
                      {c.sectionLabel}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                      {c.note}
                    </span>
                  </span>
                  {done ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer: progress + the primary "get started / resubmit" action. The
            dialog's own close button (top-right) handles dismissal. */}
        <div className="flex items-center justify-between gap-3 border-t px-5 py-4">
          <span
            className={cn(
              "text-sm tabular-nums",
              allDone ? "font-medium text-emerald-700" : "text-muted-foreground"
            )}
          >
            {addressed} of {total} done
          </span>
          {target ? (
            <Button size="sm" onClick={() => go(target.stepId)}>
              Start with {target.sectionLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push(PREVIEW_PATH);
              }}
            >
              Review &amp; resubmit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
