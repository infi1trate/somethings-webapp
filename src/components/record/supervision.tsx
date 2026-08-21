"use client";

// SUPERVISION — the practice surface for a lead mentor or supervisor.
//
// ONE TABLE, "Mentors" (Figma 2058:55884). This used to render leads and their
// mentors as SEPARATE grouped card lists — two tables on a lead's record, three
// on some supervisors' — which asked a reader to hold a hierarchy in their head
// to answer "who am I accountable for". They are all people whose standing this
// person answers for, so they are one roster.
//
// STATUS COLUMN IS KEPT HERE, unlike the mentees table. A supervisor IS
// accountable for their mentors' standing and "In training" is legitimately
// their business. What changed is that selecting a status no longer commits: it
// opens a confirm naming the consequences. Pattern (b) from the brief — a
// supervisor changing standing from their own list is a real workflow, and the
// confirm is what makes it deliberate rather than casual.
//
// UNASSIGN, never "remove". Staff are ASSIGNED / UNASSIGNED to a supervisor;
// teens are MATCHED / UNMATCHED to a mentor. The two vocabularies never cross,
// and neither one borrows the account words (deactivate/delete) — because
// neither action touches an account.
//
// PAST ASSIGNMENTS are collapsed at the foot, from the append-only event log.
// Ending an assignment appends; it never removes a row from history.

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  RelationshipTable,
  type RelationshipRow,
} from "@/components/record/relationship-table";
import { ConfirmDialog } from "@/components/record/confirm-dialog";
import { PersonRow } from "@/components/record/person-row";
import {
  assignedDaysAgo,
  currentSupervisorId,
  currentSuperviseesOf,
  endedAssignmentsFor,
  type RelationshipSlice,
} from "@/lib/record/relationships";
import { relJoined } from "@/lib/record/people-demo";
import { recordHrefFor } from "@/lib/record/subject";
import { statusRank } from "@/lib/record/mentor-status";
import { STATUS_LABELS } from "@/lib/record/mentor-status";
import { isSupervisorTier, staffActorFor } from "@/lib/record/permission-map";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { MentorLifecycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export function Supervision({ subjectId }: { subjectId: string }) {
  // Pinned at mount: reading the clock during render makes every elapsed label
  // shift on an unrelated re-render.
  const [now] = useState(() => Date.now());
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const mentorStatuses = useOnboardingStore((s) => s.mentorStatuses);
  const setMentorStatus = useOnboardingStore((s) => s.setMentorStatus);
  const relationshipEvents = useOnboardingStore((s) => s.relationshipEvents);
  const endRelationship = useOnboardingStore((s) => s.endRelationship);

  const slice: RelationshipSlice = { events: relationshipEvents };
  // Only the supervisor tier acts. A lead viewing someone else's record reads.
  const canAct = isSupervisorTier(persona) || persona === "lead-mentor";

  const [pastOpen, setPastOpen] = useState(false);
  // The pairing being ended, WITH the counterpart it actually belongs to — see
  // the note where it is set.
  const [ending, setEnding] = useState<{
    row: RelationshipRow;
    counterpartId: string;
    counterpartName: string;
  } | null>(null);
  const [statusChange, setStatusChange] = useState<{
    row: RelationshipRow;
    next: MentorLifecycleStatus;
  } | null>(null);
  // The table hands up the control that opened the menu. Reading activeElement
  // here would capture the MENU ITEM instead, which unmounts a moment later.
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const people = currentSuperviseesOf(subjectId, slice);
  const past = endedAssignmentsFor(subjectId, slice);
  const actor =
    [draft.firstName, draft.lastName].filter(Boolean).join(" ") ||
    staffActorFor(persona);

  const rows: RelationshipRow[] = people.map((p) => ({
    id: p.id,
    name: p.name,
    goesBy: p.goesBy,
    sinceDays: assignedDaysAgo(p),
    status: (mentorStatuses[p.id] as MentorLifecycleStatus) ?? p.status,
  }));

  return (
    <div className="space-y-7">
      <RelationshipTable
        variant="mentors"
        /* TODO-COPY */
        title="Mentors"
        rows={rows}
        /* The RELATIONSHIP fact, not a platform join date. */
        sinceLabel="Assigned"
        addLabel={canAct ? "Add mentor" : undefined}
        onAdd={
          canAct
            ? () => toast("Assigning a mentor isn’t part of this prototype yet.")
            : undefined
        }
        statusRank={statusRank}
        onStatusSelect={
          canAct
            ? (row, next, trigger) => {
                returnFocusTo.current = trigger;
                setStatusChange({ row, next });
              }
            : undefined
        }
        onEndRelationship={
          canAct
            ? (row, trigger) => {
                returnFocusTo.current = trigger;
                // THE COUNTERPART IS THE PERSON'S ACTUAL SUPERVISOR, not the
                // record being viewed. A supervisor's roster includes mentors
                // reached THROUGH a lead — Maria is assigned to Brandy, who
                // reports to Stephen — so an event keyed to the viewed record
                // matched no edge and silently did nothing (measured: the row
                // stayed). Naming the real counterpart makes the action work AND
                // makes the dialog true.
                const p = people.find((x) => x.id === row.id);
                const cid = p ? currentSupervisorId(p, slice) : null;
                if (!p || !cid) return;
                setEnding({
                  row,
                  counterpartId: cid,
                  counterpartName:
                    people.find((x) => x.id === cid)?.name ??
                    (cid === subjectId ? "this supervisor" : cid),
                });
              }
            : undefined
        }
        /* TODO-COPY — the ellipsis says a confirm follows. */
        endLabel="Unassign…"
        /* TODO-COPY */
        emptyLabel="No mentors assigned yet."
      />

      {/* PAST ASSIGNMENTS — the append-only history, rendered. */}
      {past.length > 0 && (
        <section aria-label="Past assignments" data-record-section="past-assignments">
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
                Past assignments ({past.length})
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
                {past.map((e) => (
                  <li key={`${e.person.id}-${e.endedAt}`}>
                    <PersonRow
                      name={e.person.name}
                      /* TODO-COPY — elapsed-time standard, and it names WHO
                         ended it, because an append-only record should. */
                      secondary={`unassigned ${relJoined(
                        Math.round((now - e.endedAt) / 86_400_000)
                      ).toLowerCase()} by ${e.actor}`}
                      href={recordHrefFor(e.person.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* UNASSIGN — names what happens and what doesn't. */}
      <ConfirmDialog
        open={!!ending}
        onOpenChange={(o) => !o && setEnding(null)}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY — names WHO they are assigned to, which on a supervisor's
           roster is often one of their leads rather than the supervisor. */
        title={`Unassign ${ending?.row.goesBy ?? ending?.row.name} from ${ending?.counterpartName}?`}
        description={
          /* TODO-COPY — the second sentence is the one that matters. */
          `This ends the supervision assignment. ${
            ending?.row.goesBy ?? ending?.row.name
          }'s account and status aren't changed.`
        }
        confirmLabel="Unassign"
        onConfirm={() => {
          if (!ending) return;
          endRelationship({
            id: `re-${ending.row.id}-${Date.now()}`,
            kind: "assignment",
            personId: ending.row.id,
            counterpartId: ending.counterpartId,
            endedAt: Date.now(),
            actor,
            actorRole: staffActorFor(persona),
          });
          setEnding(null);
          // TODO-COPY
          toast("Unassigned. The assignment history keeps the record.");
        }}
      />

      {/* STATUS CHANGE — pattern (b): selection requests, confirm commits. */}
      <ConfirmDialog
        open={!!statusChange}
        onOpenChange={(o) => !o && setStatusChange(null)}
        returnFocusTo={returnFocusTo}
        /* TODO-COPY */
        title={`Set ${statusChange?.row.goesBy ?? statusChange?.row.name} to ${
          statusChange ? STATUS_LABELS[statusChange.next] : ""
        }?`}
        description={
          /* TODO-COPY — names the object being changed, explicitly, because the
             adjacent action on this row changes a DIFFERENT object. */
          `This changes their standing on Somethings, not their assignment to this supervisor. They stay on this list.`
        }
        confirmLabel="Change status"
        onConfirm={() => {
          if (!statusChange) return;
          setMentorStatus(statusChange.row.id, statusChange.next);
          setStatusChange(null);
          // TODO-COPY
          toast(
            `${statusChange.row.goesBy ?? statusChange.row.name} is now ${STATUS_LABELS[
              statusChange.next
            ].toLowerCase()}.`
          );
        }}
      />
    </div>
  );
}
