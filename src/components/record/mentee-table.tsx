"use client";

// MENTEES — the mentor's matched teens. Name (+ exception chip) · Matched · chat
// · overflow. Built on the shared RelationshipTable, same as the supervisor's
// Mentors table.
//
// THE STATUS COLUMN AND ITS INLINE DROPDOWN ARE GONE. They were the bug: a
// person's platform status rendered inside a relationship's table, with a
// one-click mutation on it, so a user intending to end a pairing could instead
// change someone's account. And the control could never have ended a pairing —
// `menteeStatus` is keyed by TEEN ID, not by match, so "deactivate" only hid the
// row while mutating the teen's account.
//
// PRESENCE IN THE LIST MEANS MATCHED. That is what the list is for, so no column
// restates it. A non-active PLATFORM state surfaces as a read-only exception
// chip beside the name — describing the person, sitting with the person, and
// impossible to actuate. Active mentees carry no chip: defaults whisper.
//
// MATCHED, not "Joined". The old column read `joinedDaysAgo` — the person's
// platform join date — inside a table of relationships. It now reads the
// relationship's own start date.
//
// PAST MENTEES keeps both histories: the fixtures' own past matches AND the
// unmatches staff performed in-session, which carry a real timestamp.

import { useMemo, useRef, useState } from "react";
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
import { PersonRow } from "@/components/record/person-row";
import {
  DEMO_TEENS,
  defaultMenteeStatus,
  pastMenteesFor,
  relJoined,
  type DemoTeen,
} from "@/lib/record/people-demo";
import { relLength, teenAsMentee } from "@/lib/record/mentees-demo";
import {
  currentMenteesOf,
  endedMatchesFor,
  matchedDaysAgo,
  type RelationshipSlice,
} from "@/lib/record/relationships";
import { recordHrefFor } from "@/lib/record/subject";
import { isSupervisorTier } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function MenteeTable({
  mentorId,
  mentorName,
}: {
  mentorId: string;
  mentorName: string;
}) {
  const [now] = useState(() => Date.now());
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const menteeStatus = useOnboardingStore((s) => s.menteeStatus);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
  const endRelationship = useOnboardingStore((s) => s.endRelationship);

  const slice: RelationshipSlice = { events: relationshipEvents };
  // A mentor manages their own pairings; staff above them can too.
  const canAct =
    isSupervisorTier(persona) ||
    persona === "lead-mentor" ||
    persona === "mentor";

  const [pastOpen, setPastOpen] = useState(false);
  const [unmatching, setUnmatching] = useState<RelationshipRow | null>(null);
  const [picking, setPicking] = useState(false);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const statusOf = (t: DemoTeen) => menteeStatus[t.id] ?? defaultMenteeStatus(t);

  // CURRENT matches only — replayed over the event log, so an unmatch actually
  // removes the pairing instead of hiding a row.
  const live = useMemo(
    () => currentMenteesOf(mentorId, slice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, relationshipEvents]
  );

  const rows: RelationshipRow[] = live.map((t) => ({
    id: t.id,
    name: t.name,
    goesBy: t.goesBy,
    sinceDays: matchedDaysAgo(t),
    // The chip is the PERSON's platform state. Null for active.
    exception: exceptionFor(statusOf(t)),
  }));

  // Two histories, one section: the fixtures' recorded past matches, plus the
  // unmatches performed in-session (which carry a true timestamp).
  const fixturePast = useMemo(
    () => pastMenteesFor(mentorId, () => false),
    [mentorId]
  );
  const endedPast = useMemo(
    () => endedMatchesFor(mentorId, slice),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mentorId, relationshipEvents]
  );
  const pastCount = fixturePast.length + endedPast.length;

  const actorName =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") || mentorName;

  return (
    <>
      <RelationshipTable
        variant="mentees"
        /* TODO-COPY */
        title="Mentees"
        rows={rows}
        /* The RELATIONSHIP fact. */
        sinceLabel="Matched"
        addLabel={canAct ? "Add mentee" : undefined}
        onAdd={canAct ? () => setPicking(true) : undefined}
        onEndRelationship={
          canAct
            ? (row, trigger) => {
                // The table hands up the ⋯ control; activeElement here would be
                // the menu item, which unmounts a moment later.
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

      {pastCount > 0 && (
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
                Past mentees ({pastCount})
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
                {/* In-session unmatches first — newest history at the top. */}
                {endedPast.map((e) => (
                  <li key={`${e.teen.id}-${e.endedAt}`}>
                    <PersonRow
                      name={e.teen.goesBy ?? e.teen.name}
                      /* TODO-COPY — elapsed-time standard, and it names who
                         ended it. */
                      secondary={`unmatched ${relJoined(
                        Math.round((now - e.endedAt) / 86_400_000)
                      ).toLowerCase()} by ${e.actor}`}
                      href={recordHrefFor(e.teen.id)}
                    />
                  </li>
                ))}
                {fixturePast.map(({ teen, endedLabel }) => {
                  const m = teenAsMentee(teen, now);
                  return (
                    <li key={teen.id}>
                      <PersonRow
                        name={teen.goesBy ?? teen.name}
                        // TODO-COPY. Neutral "ended" — no outcome is recorded, so
                        // a graduation and a rematch can't be told apart.
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
        </section>
      )}

      {/* UNMATCH — names what happens AND what doesn't. The second sentence is
          the point: this is the action that used to change an account. */}
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
