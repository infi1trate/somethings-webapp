"use client";

// Shown once per session entry when the profile is in "needs changes". Verdict
// first, warm second. The body IS the change list (same items + same row as the
// dock). Primary CTA jumps to the first UNADDRESSED step. Reopenable from the dock.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChangeStateBadge } from "@/components/onboarding/change-row";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import { stepHref } from "@/lib/onboarding/useOnboardingNav";
import { PREVIEW_PATH } from "@/lib/onboarding/steps";
import {
  addressedStateOf,
  changeProgress,
  firstUnaddressed,
} from "@/lib/onboarding/change-requests";

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

  const active = mounted && status === "rejected" && changeRequests.length > 0;

  // Auto-open once per session entry; reopenable from the dock afterward.
  useEffect(() => {
    if (active && !autoShown) {
      markAutoShown();
      setOpen(true);
    }
  }, [active, autoShown, markAutoShown, setOpen]);

  if (!active) return null;

  const { addressed, total } = changeProgress(changeRequests, draft);
  const firstName = draft.firstName?.trim();
  const target = firstUnaddressed(changeRequests, draft);

  const go = (stepId: string) => {
    setOpen(false);
    router.push(stepHref(stepId));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {firstName
              ? `${firstName}, a few things to update`
              : "A few things to update"}
          </DialogTitle>
          <DialogDescription>
            {/* One template literal — keep the whole sentence in a single string
                so JSX can't swallow the space between "things" and "to". */}
            {`Your reviewer flagged ${total} ${
              total === 1 ? "thing" : "things"
            } to tweak before this goes live. Update each — or confirm it's already right — then resubmit.`}
            {addressed > 0 && (
              <span className="mt-1.5 block font-medium text-foreground">
                {addressed} of {total} already addressed.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* The list IS the body. Each row is a single tappable target that jumps
            to its step — the whole row is the CTA (trailing chevron signals it),
            so there's no separate link and no leading checkbox-looking circle.
            The progress badge appears only once an item is addressed. */}
        <ul className="-mx-2 max-h-[44vh] divide-y overflow-y-auto">
          {changeRequests.map((c) => {
            const state = addressedStateOf(c, draft);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => go(c.stepId)}
                  className="group flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-display text-sm font-bold tracking-tight">
                        {c.sectionLabel}
                      </span>
                      <ChangeStateBadge state={state} />
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                      {c.note}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          {target ? (
            <Button onClick={() => go(target.stepId)}>
              Start with {target.sectionLabel}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setOpen(false);
                router.push(PREVIEW_PATH);
              }}
            >
              Review &amp; resubmit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
