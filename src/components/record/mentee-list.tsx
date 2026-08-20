"use client";

// MENTEE LIST — the mentor's mentees, as PersonRows.
//
// WAS A TABLE (mentee-table.tsx, Figma MO-4.1 2004:27273: Name/Status/Joined/
// Chat with column headers and a per-row status control). Replaced: a four-row
// list of people doesn't need a grid, and the columns were carrying weight they
// hadn't earned — "Joined" is a fact you consult on the teen's record, not one
// you scan a caseload by, and the per-row status dropdown put a mutation on the
// wrong page (a teen's standing changes on the TEEN's record).
//
// Sort/search chrome is threshold-gated: below 9 mentees no controls render at
// all. A list you can hold in one glance doesn't need to be searched.
//
// ROW ANATOMY (two affordances, one row):
//   avatar · name (+ video chip) · secondary: relationship length + direction-
//   aware recency  ·  "View chat" link + chevron
// The row press opens the mentee; the link opens the conversation. PersonRow's
// own pressable variants wrap the whole row in a <button>/<a>, which would make
// the nested link invalid HTML and swallow its clicks — so the row press is a
// full-bleed overlay BEHIND the content, and only the link takes pointer events
// above it. Both are independently focusable and ≥44px.
//
// NO ATTENTION CHIP (product decision, this pass). The derivation survives in
// mentees-demo (menteeRecency / recencyChip) and recencyLine still drops its
// recency clause when a chip is passed, so re-wiring is a prop away.
//
// Vocabulary law: "mentees" for the people, "caseload" for the capacity concept.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { PersonRow } from "@/components/record/person-row";
// relJoined is deliberately NOT imported: the Joined column is gone, and a teen's
// join date is a fact for their own record.
import {
  pastMenteesFor,
  teensForMentor,
  type DemoTeen,
} from "@/lib/record/people-demo";
import {
  menteeRecency,
  recencyLine,
  relLength,
  teenAsMentee,
} from "@/lib/record/mentees-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { chatHrefFor } from "@/lib/record/chat";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

const H2 =
  "font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]";
const CARD =
  "rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-1.5 shadow-[var(--shadow-card)]";
const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Below this many mentees, sort/search chrome doesn't render. */
const CONTROLS_THRESHOLD = 9;

export function MenteeList({
  mentorId,
  mentorName,
  capacityTotal,
}: {
  mentorId: string;
  mentorName: string;
  /** Caseload total — drives "N active · M slots open" in the header. */
  capacityTotal: number;
}) {
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [pastOpen, setPastOpen] = useState(false);

  const menteeActive = useOnboardingStore((s) => s.menteeActive);
  const isActive = (t: DemoTeen) => menteeActive[t.id] ?? t.active;

  const mentorFirst = mentorName.trim().split(/\s+/)[0] || mentorName;

  // An ended match never appears in the active list, and never counts.
  const active = useMemo(
    () => teensForMentor(mentorId).filter(isActive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, menteeActive]
  );
  const past = useMemo(() => pastMenteesFor(mentorId), [mentorId]);

  const showControls = active.length >= CONTROLS_THRESHOLD;
  const q = query.trim().toLowerCase();
  const rows = showControls && q
    ? active.filter((t) => t.name.toLowerCase().includes(q))
    : active;

  const slotsOpen = Math.max(0, capacityTotal - active.length);

  return (
    <section aria-label="Mentees" data-record-section="mentees">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={H2}>Mentees</h2>
        {/* Header right slot — the load, stated once. */}
        <p
          className="text-[var(--text-secondary)] tabular-nums"
          style={{ font: "var(--type-row-label)" }}
        >
          {active.length} active · {slotsOpen}{" "}
          {slotsOpen === 1 ? "slot" : "slots"} open
        </p>
      </div>

      {/* Threshold-gated: a short list needs no controls. */}
      {showControls && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-1.5 text-sm text-[var(--text-secondary)]">
            <Search className="size-4" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search mentees by name"
              className="w-28 bg-transparent text-foreground outline-none placeholder:text-[var(--text-secondary)]"
            />
          </span>
        </div>
      )}

      <div className={`mt-3 ${CARD}`}>
        {rows.length === 0 ? (
          // TODO-COPY
          <p
            className="py-2 text-[var(--text-secondary)]"
            style={{ font: "var(--type-row-label)" }}
          >
            {q ? "No mentees match that name." : "No mentees matched yet."}
          </p>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
            {rows.map((t) => {
              const m = teenAsMentee(t, now);
              const r = menteeRecency(m, now);
              const display = t.goesBy ?? t.name;
              return (
                <li key={t.id} className="relative">
                  {/* Row press — a full-bleed overlay BEHIND the content, so the
                      link above it stays clickable and the markup stays valid
                      (no interactive element nested in a button). */}
                  <button
                    type="button"
                    onClick={() => router.push(recordHrefFor(t.id))}
                    aria-label={`${display} — open`}
                    className={cn(
                      "absolute -inset-x-3 inset-y-0 rounded-[10px] transition-colors",
                      "hover:bg-[var(--surface-s1)] focus-visible:bg-[var(--surface-s1)]",
                      RING
                    )}
                  />
                  <PersonRow
                    name={display}
                    // Length + direction-aware recency, one line, one mood.
                    secondary={`${relLength(m.matchedAt, now)} · ${recencyLine(
                      r,
                      display,
                      mentorFirst
                    )}`}
                    videoCount={m.videoCount30d}
                    className="pointer-events-none relative"
                    trailing={
                      <>
                        <Link
                          href={chatHrefFor(t.id)}
                          aria-label={`View chat with ${display}`}
                          // pointer-events-auto re-enables just this target; the
                          // ::after lifts it to 44px without changing the visual.
                          className={cn(
                            "pointer-events-auto relative inline-flex min-h-6 items-center rounded-sm",
                            "text-[13px] font-medium text-[var(--text-secondary)] underline underline-offset-2",
                            "after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-['']",
                            "hover:text-[var(--text-primary)]",
                            RING
                          )}
                        >
                          View chat
                        </Link>
                        <ChevronRight
                          className="size-3.5 shrink-0 text-[var(--text-muted)]"
                          aria-hidden
                        />
                      </>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Past mentees ─────────────────────────────────────────────────
            Renders only when ended matches exist. Outcome is NOT recorded in
            the data (no graduated/ended/rematched distinction), so the copy
            stays neutral — see pastMenteesFor's gap note. */}
        {past.length > 0 && (
          <div className="border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setPastOpen((o) => !o)}
              aria-expanded={pastOpen}
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left",
                RING
              )}
            >
              <span
                className="text-[var(--text-secondary)]"
                style={{ font: "var(--type-row-label)" }}
              >
                Past mentees ({past.length})
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-[var(--text-muted)] transition-transform",
                  pastOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {pastOpen && (
              <ul className="[&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
                {past.map(({ teen, endedLabel }) => {
                  const m = teenAsMentee(teen, now);
                  const display = teen.goesBy ?? teen.name;
                  return (
                    <li key={teen.id}>
                      <PersonRow
                        name={display}
                        // TODO-COPY. Neutral "ended" until an outcome field
                        // exists — naming a graduation and a rematch the same
                        // way is the lesser wrong versus inventing one.
                        secondary={
                          endedLabel
                            ? `together ${relLength(m.matchedAt, now)} · ended in ${endedLabel}`
                            : `together ${relLength(m.matchedAt, now)} · ended`
                        }
                        href={recordHrefFor(teen.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
