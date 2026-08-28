"use client";

// SETTINGS › DEV — the way back from a hidden dev bar.
//
// This section only exists while the bar is hidden (see the registry), so it has
// exactly one job and says so. It is not a second home for prototype controls:
// everything else lives on the bar itself, and duplicating any of it here would
// mean two places to keep in step.
//
// PROTOTYPE CHROME, MARKED AS SUCH. The dashed border is the convention this
// codebase already uses for the harness, so a screenshot of this panel is not
// mistaken for a product setting.

import { Eye } from "lucide-react";
import { PillButton } from "@/components/settings/pill-button";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";

export function DevSection() {
  const mounted = useMounted();
  const hidden = useOnboardingStore((s) => s.devBarHidden);
  const setDevBarHidden = useOnboardingStore((s) => s.setDevBarHidden);

  // Standing rule 3: no store read reaches the first paint. The section is only
  // reachable when hidden is true, so pre-mount there is nothing worth drawing.
  if (!mounted) return <div className="min-h-24" />;

  return (
    <div className="rounded-[var(--radius-surface)] border border-dashed border-[color:var(--border-contour)] px-4 py-4">
      <p className="text-[14px] leading-[20px] text-[var(--text-primary)]">
        {/* TODO-COPY */}
        {hidden
          ? "The dev bar is hidden. It carries role switching, record scenarios and starting over."
          : "The dev bar is showing at the bottom of every screen."}
      </p>
      <div className="mt-3.5">
        <PillButton onClick={() => setDevBarHidden(false)}>
          <Eye className="size-4" aria-hidden />
          {/* TODO-COPY */}
          Show the dev bar
        </PillButton>
      </div>
      <p className="mt-3 text-[12.5px] leading-[17px] text-[var(--text-muted)]">
        {/* TODO-COPY — names where the Hide control is, so the round trip is
            learnable rather than something to rediscover each time. */}
        Hide it again from the bar itself, at its right-hand end.
      </p>
    </div>
  );
}
