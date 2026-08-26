"use client";

// MENTEES — the mentor's matched teens. Name (+ chip) · Days in mentorship ·
// chat · overflow, on the shared RelationshipTable.
//
// THE STATUS COLUMN AND ITS INLINE DROPDOWN ARE GONE. They were the bug: a
// person's platform status rendered inside a relationship's table, with a
// one-click mutation on it, so a user intending to end a pairing could instead
// change someone's account.
//
// WHERE EACH STATE LIVES, per product decision:
//   active      — the list, no chip. Defaults whisper.
//   paused      — the list, in a collapsed group, with a "Paused" chip. Still
//                 matched, so still here; set apart because the reader's default
//                 question is "who am I working with this week".
//   deactivated — NOT here. Deactivation ends the pairing, so the row belongs in
//                 Past mentees. Sourced from `menteeStatus` (keyed by teen id)
//                 rather than from an ended-pairing event, because that is the
//                 only place the state is recorded — flagged: it means the
//                 account action still implies a relationship outcome, which is
//                 the coupling the relationship layer otherwise avoids.
//
// PAUSED DOES NOT OCCUPY A SLOT (product decision), so the capacity caption
// counts ACTIVE against the total.
//
// PAST MENTEES carries three sources: deactivated pairings, the fixtures' own
// past matches, and unmatches performed in-session. Outcome is DERIVED — a teen
// whose pairing here ended and who now has a different mentor was rematched.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RelationshipTable,
  exceptionFor,
  type RelationshipRow,
} from "@/components/record/relationship-table";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import { PersonRow, avatarTintFor } from "@/components/record/person-row";
import {
  DEMO_TEENS,
  defaultMenteeStatus,
  pastMenteesFor,
  personById,
  type DemoTeen,
} from "@/lib/record/people-demo";
import { relLength, teenAsMentee } from "@/lib/record/mentees-demo";
import {
  currentMentorId,
  currentMenteesOf,
  daysInMentorship,
  endedMatchesFor,
  type RelationshipSlice,
} from "@/lib/record/relationships";
import { recordHrefFor } from "@/lib/record/subject";
import { recordOrigin } from "@/lib/record/origins";
import { isSupervisorTier } from "@/lib/record/permission-map";
import {
  cadenceFor,
  pendingReviewFor,
  presentationFor,
  type CareStoreSlice,
} from "@/lib/record/care-demo";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const LINK =
  "rounded-sm font-medium text-[var(--text-primary)] underline underline-offset-2 hover:opacity-70";

export function MenteeTable({
  mentorId,
  mentorName,
  /** Total caseload slots, for the capacity caption. Omit to hide the caption. */
  capacity,
}: {
  mentorId: string;
  mentorName: string;
  capacity?: number;
}) {
  const [now] = useState(() => Date.now());
  const careReviews = useOnboardingStore((s) => s.careReviews);
  const careUpdates = useOnboardingStore((s) => s.careUpdates);
  const careFlagClosures = useOnboardingStore((s) => s.careFlagClosures);
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
  const endRelationship = useOnboardingStore((s) => s.endRelationship);

  const slice: RelationshipSlice = { events: relationshipEvents };
  const canAct =
    isSupervisorTier(persona) ||
    persona === "lead-mentor" ||
    persona === "mentor";

  const [pastOpen, setPastOpen] = useState(false);
  const [unmatching, setUnmatching] = useState<RelationshipRow | null>(null);
  const [picking, setPicking] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const statusOf = (t: DemoTeen) => menteeStatus[t.id] ?? defaultMenteeStatus(t);

  /** The store overlay the care derivations read, so an approval made in-session
   *  moves this column too. */
  const careSlice: CareStoreSlice = {
    decisions: Object.values(careReviews),
    updates: Object.values(careUpdates),
    closures: Object.values(careFlagClosures),
  };

  // CURRENT matches only — replayed over the event log, so an unmatch actually
  // removes the pairing instead of hiding a row.
  const live = useMemo(
    () => currentMenteesOf(mentorId, slice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, relationshipEvents]
  );

  // Deactivated pairings leave the card entirely.
  const inCard = live.filter((t) => statusOf(t) !== "deactivated");
  const deactivated = live.filter((t) => statusOf(t) === "deactivated");

  // ── THE PRESENTATION COLUMN — SUPERVISOR TIER AND ABOVE ONLY ─────────────
  //
  // AWAITING CONFIRMATION (flagged in the report). The reasoning is data
  // minimisation, not permission theatre: a mentor can already read a code on an
  // individual teen's Care tab, and that is fine — it is one teen, behind a
  // deliberate click, in clinical context. A COLUMN of codes across a whole
  // caseload is a materially different exposure. It is scannable, it is
  // screenshot-able, it invites comparison between named minors, and it turns a
  // clinical fact into a list attribute. Same data, different risk.
  //
  // If the product decides mentors should see it, this is the one line to change
  // — and `care` simply stops being computed for them, so nothing leaks through a
  // prop that is still populated.
  const showCare = isSupervisorTier(persona);

  const careFor = (t: DemoTeen): RelationshipRow["care"] | undefined => {
    if (!showCare) return undefined;
    const presentation = presentationFor(t.id, now, careSlice);
    const cadence = cadenceFor(t.id, now, careSlice);
    const due = cadence.nextReviewDue;
    // `nextReviewDue` is already null on a closed record and before the first
    // survey, so neither can produce a spurious "overdue".
    const overdueDays =
      due != null && now > due ? Math.floor((now - due) / 86_400_000) : 0;
    // DUE MEANS A REVIEW IS ACTUALLY PENDING, not merely scheduled. Reading it
    // off `nextReviewDue != null` would chip every teen with a cadence at all —
    // including one whose review is two months out — and a column where every row
    // says "Review due" says nothing. `pendingReviewFor` is the same source the
    // Overview roll-up uses, so the list and the record cannot disagree.
    const pending = pendingReviewFor(t.id, now, careSlice) !== null;
    return {
      code: presentation?.code ?? null,
      reviewDue: overdueDays > 0 ? "overdue" : pending ? "due" : "none",
      overdueDays,
    };
  };

  const rows: RelationshipRow[] = inCard.map((t) => ({
    id: t.id,
    name: t.name,
    goesBy: t.goesBy,
    sinceDays: daysInMentorship(t),
    exception: exceptionFor(statusOf(t)),
    paused: statusOf(t) === "paused",
    care: careFor(t),
  }));

  const activeCount = rows.filter((r) => !r.paused).length;
  const pausedCount = rows.length - activeCount;

  // TODO-COPY. PAUSED DOES NOT OCCUPY A SLOT, so open slots come off the ACTIVE
  // count. The paused clause still renders, because a caption that hid four
  // paused pairings while advertising four open slots would be true and useless.
  const caption =
    capacity === undefined
      ? undefined
      : [
          `${activeCount} active`,
          pausedCount > 0 ? `${pausedCount} paused` : null,
          `${Math.max(0, capacity - activeCount)} of ${capacity} slots open`,
        ]
          .filter(Boolean)
          .join(" · ");

  // ── Past mentees: three sources, one list ────────────────────────────────
  const fixturePast = useMemo(
    () => pastMenteesFor(mentorId, () => false),
    [mentorId]
  );
  const endedPast = useMemo(
    () => endedMatchesFor(mentorId, slice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, relationshipEvents]
  );

  /** OUTCOME IS DERIVED, not recorded. No outcome field exists on either
   *  `PastMatch` or `RelationshipEvent` (audited). But a teen's CURRENT mentor is
   *  reachable, and a teen whose pairing here ended and who now sits with a
   *  different mentor was rematched by definition.
   *
   *  The gap this leaves: it cannot tell "rematched" from "left, came back, got
   *  matched to someone else". Both read as rematched. Flagged — the fix is an
   *  outcome on the event, not more inference here. */
  const outcomeFor = (teen: DemoTeen) => {
    const current = currentMentorId(teen, slice);
    if (current && current !== mentorId) {
      const m = current === "live" ? null : personById(current);
      return {
        kind: "rematched" as const,
        mentorId: current,
        // "live" has no fixture row, so its name comes from the draft — same
        // "Jordan Rivera" fallback the other six surfaces use, rather than a
        // vague "their current mentor" that names nobody.
        mentorName:
          m?.name ??
          ([draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
            "Jordan Rivera"),
      };
    }
    return { kind: "ended" as const };
  };

  const pastEntries = [
    ...deactivated.map((teen) => ({
      key: `deact-${teen.id}`,
      teen,
      // TODO-COPY — the account state is why this pairing is over.
      tail: "ended · account deactivated",
    })),
    ...endedPast.map((e) => {
      const o = outcomeFor(e.teen);
      return {
        key: `${e.teen.id}-${e.endedAt}`,
        teen: e.teen,
        tail:
          o.kind === "rematched"
            ? { rematchedTo: o.mentorName, mentorId: o.mentorId }
            : // TODO-COPY
              "ended",
      };
    }),
    ...fixturePast.map(({ teen, endedLabel }) => {
      const o = outcomeFor(teen);
      return {
        key: `fix-${teen.id}`,
        teen,
        tail:
          o.kind === "rematched"
            ? { rematchedTo: o.mentorName, mentorId: o.mentorId }
            : // TODO-COPY
              endedLabel
              ? `ended ${endedLabel}`
              : "ended",
      };
    }),
  ];

  const actorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || mentorName;

  return (
    <>
      <RelationshipTable
        variant="mentees"
        /* TODO-COPY */
        title="Mentees"
        caption={caption}
        rows={rows}
        showCare={showCare}
        /* PHASE 3 — A NAMED PLATFORM METRIC, deliberately NOT the elapsed-time
           standard the rest of these surfaces use. "122 days", never "4 months":
           a named metric keeps its own unit so it stays comparable across records
           and against wherever else the platform reports it. The clock does NOT
           pause (no pause history exists — see formatDaysInMentorship). */
        // ORIGIN: a teen opened from here came from THIS MENTOR'S record, so the
        // teen's back link reads "Back to <mentor>" rather than guessing
        // "Mentees" — a list this reader may never have been on.
        origin={recordOrigin(mentorId)}
        sinceLabel="Days in mentorship"
        sinceFormat="metric"
        addLabel={canAct ? "Add mentee" : undefined}
        onAdd={canAct ? () => setPicking(true) : undefined}
        onEndRelationship={
          canAct
            ? (row, trigger) => {
                returnFocusTo.current = trigger;
                setUnmatching(row);
              }
            : undefined
        }
        /* TODO-COPY */
        endLabel="Unmatch…"
        /* TODO-COPY */
        emptyLabel="No mentees matched yet."
      />

      {pastEntries.length > 0 && (
        <section
          aria-label="Past mentees"
          data-record-section="past-mentees"
          className="mt-4"
        >
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-5">
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
                {/* TODO-COPY */}
                Past mentees ({pastEntries.length})
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
              <ul className="pb-1.5 [&>li+li]:border-t [&>li+li]:border-[var(--border-subtle)]">
                {pastEntries.map(({ key, teen, tail }) => (
                  <li key={key}>
                    <PastMenteeRow
                      teen={teen}
                      together={`together ${relLength(teenAsMentee(teen, now).matchedAt, now)}`}
                      tail={tail}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <ConfirmDialog
        open={!!unmatching}
        onOpenChange={(o) => !o && setUnmatching(null)}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY */
        title={`Unmatch ${unmatching?.goesBy ?? unmatching?.name} from ${mentorName}?`}
        description={
          /* TODO-COPY */
          `This ends the pairing and frees a slot. ${
            unmatching?.goesBy ?? unmatching?.name
          }'s account isn't changed.`
        }
        confirmLabel="Unmatch"
        onConfirm={() => {
          if (!unmatching) return;
          endRelationship({
            id: `re-${unmatching.id}-${Date.now()}`,
            kind: "match",
            personId: unmatching.id,
            counterpartId: mentorId,
            endedAt: Date.now(),
            actor: actorName,
            actorRole: "Mentor",
          });
          setUnmatching(null);
          // TODO-COPY
          toast("Unmatched. Past mentees keeps the record.");
        }}
      />

      <AddMenteePicker
        open={picking}
        onOpenChange={setPicking}
        mentorName={mentorName}
      />
    </>
  );
}

/** ONE PAST-MENTEE ROW.
 *
 *  Not PersonRow, because PersonRow wraps the whole row in a <Link> and the
 *  rematched form needs a SECOND link inside it (the current mentor's name).
 *  That nests <a> in <a> — invalid HTML, a hydration error, and the inner click
 *  also fires the outer navigation. Measured: React reported exactly that.
 *
 *  So the row's own link is a FULL-BLEED OVERLAY BEHIND the content: content is
 *  pointer-events-none, and the one genuinely interactive child opts back in
 *  with pointer-events-auto. This is the same pattern the mentee list uses for
 *  its two-affordance rows.
 *
 *  NO STATUS CHIPS here — these pairings are over, and the teen's current state
 *  lives on their own record. */
function PastMenteeRow({
  teen,
  together,
  tail,
}: {
  teen: DemoTeen;
  together: string;
  tail: string | { rematchedTo: string; mentorId: string };
}) {
  const display = teen.goesBy ?? teen.name;
  return (
    <div className="group relative flex min-h-11 items-center gap-3 py-1.5">
      {/* BEHIND the content, covering the row. */}
      <Link
        href={recordHrefFor(teen.id)}
        aria-label={`${display} — open record`}
        className={cn(
          "absolute -inset-x-3 inset-y-0 z-0 rounded-[10px] transition-colors",
          "group-hover:bg-[var(--surface-s1)]",
          "focus-visible:bg-[var(--surface-s1)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[color:var(--focus-ring)]"
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none relative z-10 flex size-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={{
          backgroundColor: avatarTintFor(display).bg,
          color: avatarTintFor(display).fg,
        }}
      >
        {display.charAt(0).toUpperCase()}
      </span>
      <span className="pointer-events-none relative z-10 min-w-0 flex-1">
        <span
          className="block truncate text-[var(--text-primary)]"
          style={{ font: "var(--type-row-value)" }}
        >
          {display}
        </span>
        <span
          className="block truncate text-[var(--text-secondary)]"
          style={{ font: "var(--type-row-label)" }}
        >
          {typeof tail === "string" ? (
            `${together} · ${tail}`
          ) : (
            <>
              {`${together} · rematched to `}
              {/* The one live target inside a pointer-events-none subtree. */}
              <Link
                href={recordHrefFor(tail.mentorId)}
                className={cn("pointer-events-auto", LINK, RING)}
              >
                {tail.rematchedTo}
              </Link>
            </>
          )}
        </span>
      </span>
    </div>
  );
}

/** Unmatched teens, as a picker. STUB: toasts, never writes — no match-creation
 *  flow exists (reported). */
function AddMenteePicker({
  open,
  onOpenChange,
  mentorName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mentorName: string;
}) {
  const unmatched = DEMO_TEENS.filter((t) => !t.mentorId);
  const pool = unmatched.length > 0 ? unmatched : DEMO_TEENS.slice(0, 4);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a mentee</DialogTitle>
          <DialogDescription>
            {`Matching isn't part of this prototype yet — picking someone shows what would happen.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto">
          {pool.map((t) => (
            <li key={t.id}>
              <PersonRow
                name={t.goesBy ?? t.name}
                secondary={t.group}
                onPress={() => {
                  toast(`${t.goesBy ?? t.name} would be matched with ${mentorName}.`);
                  onOpenChange(false);
                }}
              />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
