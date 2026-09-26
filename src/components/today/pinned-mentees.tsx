"use client";

// ═══════════════════════════════════════════════════════════════════════════
// PINNED MENTEES ON TODAY (Phase F)
//
// ═══ FOUR FIELDS, AND THE ABSENCE OF A FIFTH IS THE DESIGN ═══
//
// Name · last activity recency · ONE open obligation and its destination ·
// assigned mentor. F: "Counts invite comparison and ranking of named people."
// So there is no per-person flag count, no escalation count, no conversation
// count, no score, no sparkline, no streak and no trend — and `PinnedRow` has
// no field any of them could be rendered from.
//
// ═══ SCOPED AND WITHHELD: THE CONVERSATION PREVIEW ═══
//
// A recent-message excerpt was scoped for this row and is NOT BUILT. It is
// clinical content on an orienting surface and carries a different privacy
// posture than a status line — PENDING DR. NISSAN, not approved. Recorded here
// rather than left unmentioned so the next person knows it was considered and
// withheld rather than forgotten. The row has no field for it either.
//
// ═══ THE MIRROR RULE ═══
//
// Both affordances navigate. The row opens the mentee's record; the secondary
// opens the MENTOR's record. Neither opens a composer, a message field or a
// send action — F is explicit that the mentor affordance is navigation and not
// a hand-off, and Today contains no work anywhere.
//
// ═══ WHY EVERY ROW SAYS "Nothing open" TODAY ═══
//
// Not a bug in this component. MEASURED: the record side has 26 teens and the
// task/monitoring fixtures have 32, sharing zero ids — so no pinned mentee can
// match a flag, an escalation or a review. `obligationFor` reads the real
// destinations rather than the record's own `careFlags`, because naming a
// destination from record-side data would print a link that lands on nothing.
// See `lib/home/pinned-rows.ts`, and gap 432.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { discFor } from "@/lib/tasks/avatar";
import { LABEL } from "@/lib/home/today";
import {
  activityLabel,
  obligationFor,
  pinnedInOrder,
  type ObligationInput,
} from "@/lib/home/pinned-rows";
import { DEMO_PEOPLE, DEMO_TEENS } from "@/lib/record/people-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

const recordHref = (id: string) => `/admin/person/${encodeURIComponent(id)}`;

export function PinnedMentees({ input }: { input: ObligationInput }) {
  const pinned = useOnboardingStore((s) => s.pinnedMentees);

  /* ═══ ORDER BY PIN TIME, ASCENDING — AND BY NOTHING ELSE ═══
     Not by recency, not by open count, not by anything that ranks people.
     `pinnedInOrder` is a named function so the ordering is a thing a test can
     point at rather than an implicit property of the array. */
  const rows = pinnedInOrder(pinned)
    .map((p) => {
      const teen = DEMO_TEENS.find((t) => t.id === p.id);
      if (!teen) return null;
      const mentor = DEMO_PEOPLE.find((m) => m.id === teen.mentorId);
      return {
        pin: p,
        teen,
        mentorName: mentor?.name ?? null,
        mentorHref: mentor ? recordHref(mentor.id) : null,
        activity: activityLabel(
          teen.menteeLastSentDaysAgo,
          teen.mentorLastSentDaysAgo
        ),
        obligation: obligationFor(teen.id, input),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  return (
    <section
      data-anno-ref="today-pinned"
      /* NEEDS-COPY-NICOLE. "Mentees" matches the rail, per E.10's instruction
         to hold that vocabulary until Nicole rules. */
      aria-label="Pinned mentees"
      className="shrink-0"
    >
      <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
        {/* NEEDS-COPY-NICOLE */}
        Pinned mentees
      </p>

      {rows.length === 0 ? (
        /* ═══ ONE LINE, NO ILLUSTRATION, NO CTA (F.1) ═══
           It explains what pinning is and WHERE to do it — and deliberately
           does not link there, because F rules out "a CTA that implies an
           action available on Today". Pinning happens on a mentee's record;
           saying so is the whole of the empty state. */
        /* ═══ IT SITS IN A CONTAINER NOW (Phase H.5) ═══
           MEASURED before: a bare `<p>` with no surface, no border and no
           padding, directly on the page ground between two bordered cards. It
           read as a rendering fault rather than as a state — which is H.5's
           own diagnosis and is visible in the 1900px capture.
           SAME REGISTER AS EVERY OTHER MODULE: `--surface-card`,
           `--border-contour`, `--radius-elevated`, `p-4`. Copy is unchanged
           and still one line (F.1), still with no CTA — the fix is the
           container, not the words. */
        <div
          data-anno-ref="today-pinned-empty"
          className="mt-1.5 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4"
        >
          <p className="text-[13px] leading-[19px] text-[var(--text-secondary)]">
            {/* NEEDS-COPY-NICOLE */}
            Pin a mentee from their record to keep them here for the week.
          </p>
        </div>
      ) : (
        <ul className="mt-1.5 overflow-hidden rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)]">
          {rows.map((r, i) => {
            const disc = discFor(r.teen.id);
            return (
              <li
                key={r.teen.id}
                data-anno-ref={`pinned-row:${r.teen.id}`}
                className={cn(
                  "relative flex items-center gap-3 px-4",
                  i > 0 && "border-t border-[color:var(--border-subtle)]"
                )}
              >
                {/* ═══ THE ROW IS THE LINK, AND THE SECONDARY IS A SIBLING ═══
                    A stretched overlay rather than wrapping the whole row in an
                    anchor: an anchor cannot contain another anchor, and F
                    requires a second navigation target inside the row. */}
                <Link
                  href={recordHref(r.teen.id)}
                  className={cn("min-h-14 flex-1 py-2.5", RING)}
                >
                  <span className="absolute inset-0 z-0" aria-hidden />
                  <span className="relative z-10 flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                      style={{ backgroundColor: disc.bg, color: disc.fg }}
                    >
                      {r.teen.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-[14px] leading-[20px] text-[var(--text-primary)]">
                        {r.teen.name}
                      </span>
                      {/* THE THREE REMAINING CONTRACT FIELDS, ONE LINE.
                          NEEDS-COPY-NICOLE on every separator and phrase. */}
                      <span className="block truncate text-[12px] leading-[16px] text-[var(--text-secondary)]">
                        {[
                          r.activity,
                          r.obligation
                            ? /* NEEDS-COPY-NICOLE: {n} open in {destination} */
                              `${r.obligation.count} open in ${LABEL[r.obligation.destination]}`
                            : /* NEEDS-COPY-NICOLE */ "Nothing open",
                          r.mentorName
                            ? /* NEEDS-COPY-NICOLE: with {mentor} */
                              `with ${r.mentorName}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                </Link>

                {/* ═══ THE ONE SECONDARY AFFORDANCE — A ROUTE (F.5) ═══
                    The MENTOR's record. Navigation, not a hand-off: no
                    composer, no message field, no send. `z-10` so it sits above
                    the row's stretched overlay and is separately clickable. */}
                {r.mentorHref && r.mentorName && (
                  <Link
                    href={r.mentorHref}
                    data-anno-ref={`pinned-mentor:${r.teen.id}`}
                    /* NEEDS-COPY-NICOLE */
                    aria-label={`Open ${r.mentorName}'s record`}
                    className={cn(
                      "relative z-10 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2.5",
                      "text-[12px] leading-[16px] text-[var(--text-secondary)]",
                      "transition-colors hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
                      RING
                    )}
                  >
                    {/* NEEDS-COPY-NICOLE */}
                    Mentor
                    <ChevronRight aria-hidden className="size-3 shrink-0" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
