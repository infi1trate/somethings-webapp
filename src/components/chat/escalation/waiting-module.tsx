"use client";

// ═══════════════════════════════════════════════════════════════════════════
// WHILE YOU'RE WITH THEM (pack v4.0, Workstream D) — the mentor's waiting node
//
// ═══ SUPERSEDES "the pack's line and nothing else" (v3.0, Workstream D) ═══
// While the supervisor has the escalation, the mentor's current node holds:
//   1  (pack v5.0: the Support door left for the hero's ghost button — the
//      one door in every state; the holder is this node's title)
//   2  the supervisor's echo — their latest Support message, quote-framed,
//      so coaching is visible without leaving the conversation
//   3  2–3 Ava nudges grounded in the thread (`lib/chat/stay-close.ts`):
//      each fills the message box, editable; never clinical, never sent,
//      never persisted. A used nudge settles and says so (make it magical 2).
//   4  a steadying line for the mentor, rotating
// The completed timeline stays below, as it always does.

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Quote } from "@/components/chat/escalation/quote";
import { STEADYING_EVERY_MS, STEADYING_LINES, stayCloseNudges } from "@/lib/chat/stay-close";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const BODY = { font: "var(--type-body)" } as const;
const LABEL = { font: "var(--type-field-label)" } as const;

export interface SupervisorEcho {
  text: string;
  at: number;
}

export function WaitingModule({
  name,
  supervisorName,
  echo,
  teenLines,
  onUseWording,
}: {
  name: string;
  supervisorName: string;
  echo?: SupervisorEcho;
  teenLines: string[];
  onUseWording: (text: string) => void;
}) {
  const nudges = stayCloseNudges(teenLines, name);
  /* "Used" is this component's state alone — never written anywhere. */
  const [used, setUsed] = useState<ReadonlySet<string>>(new Set());
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLine((i) => (i + 1) % STEADYING_LINES.length), STEADYING_EVERY_MS);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div data-waiting-module className="space-y-3">
      {echo && <Quote slot="supervisor-echo" text={echo.text} who={supervisorName} at={echo.at} />}
      <section data-nudges aria-labelledby="nudges-label" className="space-y-1.5">
        <p id="nudges-label" className="inline-flex items-center gap-1.5 text-[var(--text-muted)]" style={LABEL}>
          <Sparkles aria-hidden className="size-3.5" />
          {/* TODO-COPY */}
          Suggested by Ava
        </p>
        <ul className="space-y-1.5">
          {nudges.map((n) => {
            const isUsed = used.has(n.id);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  data-nudge={n.id}
                  data-nudge-used={isUsed || undefined}
                  onClick={() => {
                    onUseWording(n.text);
                    setUsed((u) => new Set(u).add(n.id));
                  }}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-[var(--radius-inset)] border px-3 py-2 text-left hover:bg-[var(--tint-hover)]",
                    isUsed ? "tier-settle border-transparent bg-[var(--surface-s1)] text-[var(--text-secondary)]" : "border-[color:var(--border-subtle)] text-[var(--text-primary)]",
                    RING
                  )}
                  style={BODY}
                >
                  <span className="min-w-0 flex-1 break-words">{n.text}</span>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[var(--text-muted)]" style={LABEL}>
                    {isUsed ? (
                      <>
                        <Check aria-hidden className="size-3.5" />
                        {/* TODO-COPY */}
                        In message box
                      </>
                    ) : (
                      /* TODO-COPY */
                      "Use"
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <p data-steadying className="text-[var(--text-secondary)]" style={LABEL}>
        {STEADYING_LINES[line]}
      </p>
    </div>
  );
}
