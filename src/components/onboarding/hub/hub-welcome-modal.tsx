"use client";

// First-visit hub intro. Introduces Somethings and sets the expectation that a
// few more steps remain before mentoring can start. Shows ONCE — gated by the
// persisted hubWelcomeSeen flag — and never reappears once dismissed.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Moodie } from "@/components/doodles";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export function HubWelcomeModal() {
  const mounted = useMounted();
  const hubWelcomeSeen = useOnboardingStore((s) => s.hubWelcomeSeen);
  const markHubWelcomeSeen = useOnboardingStore((s) => s.markHubWelcomeSeen);
  const draft = useOnboardingStore((s) => s.draft);
  const firstName = draft.firstName?.trim();

  // `open` is DERIVED, not stored in local state: it shows on the first hub
  // visit (hubWelcomeSeen still false) and closes the instant we mark it seen —
  // so there's no setState-in-effect (a lint rule this project enforces).
  const open = mounted && !hubWelcomeSeen;
  const dismiss = () => markHubWelcomeSeen();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span
            aria-hidden
            className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-brand/10"
          >
            <Moodie name="face-love" className="size-8" />
          </span>
          <DialogTitle>
            {firstName
              ? `Welcome to Somethings, ${firstName}`
              : "Welcome to Somethings"}
          </DialogTitle>
          <DialogDescription>
            Somethings pairs teens with trained young-adult mentors. Your profile
            is in review now — and there are a few more steps to finish before you
            can start mentoring. They all live here in your hub, and you can work
            through them in any order.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={dismiss}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
