import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  StepStatusBadge,
  type StepCardState,
} from "@/components/onboarding/hub/step-status-badge";
import { cn } from "@/lib/utils";

interface CtaSpec {
  label: string;
  variant: "default" | "outline" | "ghost";
}

// The CTA the card offers, derived entirely from state. Actionable states get
// the black pill; in_review is read-only ("View submission"); completed states
// get a quiet ghost re-entry — the positive "Done / Approved" signal is carried
// by the emerald badge, never a disabled grey button.
const CTA: Record<StepCardState, CtaSpec> = {
  not_started: { label: "Start", variant: "default" },
  draft: { label: "Continue", variant: "default" },
  in_progress: { label: "Continue", variant: "default" },
  in_review: { label: "View submission", variant: "outline" },
  returned: { label: "Make changes", variant: "default" },
  done: { label: "View", variant: "ghost" },
  approved: { label: "View", variant: "ghost" },
};

/** ONE card, reused for all five hub steps. Presentation is fully derived from
 *  `state`; the hub supplies the per-state destination via `href`. The `lg`
 *  button keeps the tap target ≥44px on mobile. */
export function StepCard({
  label,
  blurb,
  state,
  href,
}: {
  label: string;
  blurb: string;
  state: StepCardState;
  href: string;
}) {
  const cta = CTA[state];
  const needsAction = state === "returned";
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 transition-colors",
        needsAction && "border-orange-300 ring-1 ring-orange-200"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold tracking-tight">
              {label}
            </h3>
            <StepStatusBadge state={state} />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
            {blurb}
          </p>
        </div>
        <Button asChild size="lg" variant={cta.variant} className="sm:shrink-0">
          <Link href={href}>{cta.label}</Link>
        </Button>
      </div>
    </div>
  );
}
