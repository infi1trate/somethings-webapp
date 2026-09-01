"use client";

// THE ASSIST PANEL — one suggestion, its reason, and two ways out.
//
// ═══ IT IS NOT AN AI PANEL, AND NOTHING HERE IS ATTRIBUTED TO A MODEL ═══
//
// Every suggestion is derived from an observable fact — how long since the teen
// wrote, whether a sent set is unopened, whether a swap is waiting — and the reason
// line states that fact. See `lib/chat/assist.ts`.
//
// That is a deliberate difference from the surface this replaces, which put an
// AI-generated summary at the top of this panel and Documentation underneath it. The
// summary was unverifiable and the documentation was mis-homed; both are gone.
// Documentation lives in Timeline (Phase 5), and this panel says things a mentor can
// check.
//
// ═══ "NOT NOW" IS A REAL ANSWER ═══
//
// Dismissing is one press, needs no reason, and is not recorded anywhere a lead can
// see. A suggestion a mentor cannot decline is an instruction, and a panel of
// instructions on top of fourteen relationships is a panel that gets ignored.
//
// Dismissal is SESSION-LOCAL, deliberately. Persisting it would mean a mentor who
// dismissed "check in with Riley" three weeks ago never being told again — and the
// fact underneath it (nine days of silence, then thirty) has got worse, not better.
// A suggestion that comes back is the correct behaviour for a condition that is
// still true.

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { suggestFor, type AssistInput } from "@/lib/chat/assist";
import { PanelEmpty, PanelSection } from "@/components/chat/rail/rail-panel";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function AssistPanel({
  input,
  /** Support threads get no suggestions — the rules are all about a mentorship. */
  disabled,
  onOpenToolkit,
}: {
  input: AssistInput | null;
  disabled?: boolean;
  onOpenToolkit: () => void;
}) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  if (disabled || !input) {
    return (
      <PanelEmpty title="Where to start">
        {/* TODO-COPY. Says why it is empty rather than looking broken. */}
        Suggestions are about a mentorship. This is a colleague — you know what you
        need from them better than this panel does.
      </PanelEmpty>
    );
  }

  /* FIRST MATCH THAT HAS NOT BEEN DISMISSED. The ladder is in `assist.ts`; this
     only walks it. */
  const all = suggestFor(input);
  const suggestion = all.find((s) => !dismissed.includes(s.id)) ?? null;

  if (!suggestion) {
    return (
      <PanelEmpty title="Nothing else from me">
        {/* TODO-COPY. Reached by dismissing everything, which is a legitimate
            thing to do — so it reads as a normal state and not as an error. */}
        You have been through everything I had. It will have more to say when
        something changes.
      </PanelEmpty>
    );
  }

  return (
    <div data-slot="assist" className="space-y-4">
      <PanelSection>
        <h3
          className="text-[var(--text-primary)]"
          style={{ font: "var(--type-card-title)" }}
        >
          {suggestion.title}
        </h3>
        {/* ═══ THE REASON, ALWAYS, AND IT IS A FACT ═══
            "They last wrote 9 days ago", not "engagement is declining". A mentor
            has to be able to look at the reason and disagree with the conclusion —
            which is what makes this a suggestion rather than an instruction. */}
        <p
          className="mt-1.5 text-[var(--text-secondary)]"
          style={{ font: "var(--type-body)" }}
        >
          {suggestion.because}
        </p>
      </PanelSection>

      <div className="flex items-center gap-2">
        {suggestion.action ? (
          <button
            type="button"
            data-slot="assist-do"
            onClick={() => {
              onOpenToolkit();
              // Dismissed on use, so the panel moves on rather than repeating what
              // the mentor has just gone to do.
              setDismissed((d) => [...d, suggestion.id]);
            }}
            className={cn(
              "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full",
              "bg-[var(--text-primary)] text-[var(--text-inverse)] transition-opacity hover:opacity-90",
              RING
            )}
            style={{ font: "var(--type-button)" }}
          >
            {suggestion.action.label}
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : (
          /* ═══ NO ACTION MEANS THE ACTION IS TO SAY SOMETHING ═══
             Which only the mentor can do, so there is no button pretending
             otherwise — a "Do it" that just focused the composer would be a button
             that did nothing a mentor was not about to do anyway. The composer is
             right there. */
          <button
            type="button"
            data-slot="assist-do"
            onClick={() => setDismissed((d) => [...d, suggestion.id])}
            className={cn(
              "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full",
              "border border-[color:var(--border-contour)] text-[var(--text-primary)]",
              "transition-colors hover:bg-[var(--tint-hover)]",
              RING
            )}
            style={{ font: "var(--type-body)" }}
          >
            <Check className="size-3.5 shrink-0" aria-hidden />
            {/* TODO-COPY */}
            Done
          </button>
        )}
        <button
          type="button"
          data-slot="assist-dismiss"
          onClick={() => setDismissed((d) => [...d, suggestion.id])}
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-[var(--text-secondary)]",
            "transition-colors hover:text-[var(--text-primary)]",
            RING
          )}
          style={{ font: "var(--type-body)" }}
        >
          {/* TODO-COPY. "Not now", not "Dismiss" — the condition is probably still
              true and the panel will say so again. */}
          Not now
        </button>
      </div>

      {all.length > 1 && (
        <p
          className="text-[var(--text-muted)]"
          style={{ font: "var(--type-field-label)" }}
        >
          {/* ═══ THE COUNT IS SHOWN, THE LIST IS NOT ═══
              A mentor should know there is more without being handed a to-do list —
              the whole point of one-at-a-time is that this panel makes a
              recommendation rather than presenting options. TODO-COPY. */}
          {all.length - 1} more after this
        </p>
      )}
    </div>
  );
}
