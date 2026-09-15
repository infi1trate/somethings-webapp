// ═══ WHAT A TASK IS, AS THE ROW SAYS IT ═══
//
// ═══ THE VERB MOVES ONTO THE ROW (arch-E) ═══
//
// Tasks grouped by task type, so the header said what the work was and the row
// said only a name and a deadline. That reads as a person rather than as work —
// and it collapses entirely the moment a second task type exists, because then
// every row has to state what it is and the header cannot do it for them.
//
// So the type becomes an ATTRIBUTE the row carries. This table is the one place
// a task type is named for a reader, which is the same arrangement `BAND_LABEL`
// has for tiers: a rename is one edit and cannot leave two surfaces disagreeing.
//
// ═══ THE NAMES ARE THE JOB, NOT THE OBJECT ═══
//
// "Billing code review" rather than "Intake" or "Monthly re-review". The old
// names were positions in a CADENCE — useful as a group header when the group was
// the cadence, useless on a row, because a supervisor reading one row does not
// need to know it is the monthly one; they need to know it is a code review and
// when it is due. The cadence survives where it is load-bearing: `isReReview` on
// the payload, and the stage the shared review module files it under.
//
// TODO-COPY ON EVERY NAME. All of these are new and need Nicole — and they are
// the strings a supervisor will read fifty times a shift, so they are the ones
// worth her time.

import {
  BadgeCheck,
  ClipboardCheck,
  FileText,
  Flag,
  Phone,
  type LucideIcon,
} from "lucide-react";
import type { TaskType } from "@/lib/tasks/types";

/** TODO-COPY, all seven. */
export const TASK_KIND_LABEL: Record<TaskType, string> = {
  /* BILLING — both types are the same JOB. A supervisor reviews a proposed code
     against survey evidence and documents it; whether it is the first one or the
     ninth is a cadence fact the row does not need. They keep separate task types
     because their SLAs and their ledger events differ. */
  intakeBillingReview: "Billing code review",
  monthlyReReview: "Billing code review",
  /* FLAGS name the tier, because on Monitoring the tier IS the job — an imminent
     flag and a routine one are different work at different speeds. These are here
     for completeness rather than use: Monitoring groups by tier and its rows do
     not state the type. */
  imminentFlagReview: "Imminent flag review",
  clinicalFlagReview: "Clinical flag review",
  routineFlagReview: "Routine flag review",
  activeEscalation: "Active escalation",
  escalationDocumentation: "Escalation write-up",
};

/** ═══ AN ICON PER TASK TYPE — AND THE TWO BILLING TYPES SHARE ONE ═══
 *
 *  Because they share a name and a job. Two glyphs for one label would imply a
 *  distinction the row is deliberately not making.
 *
 *  THE ICON IS A SECOND CARRIER, NEVER THE ONLY ONE. The label is always beside
 *  it (SC 1.4.1), and the well it sits in is a NEUTRAL tint rather than a
 *  per-type colour: this surface's alarm budget spends colour on breach and
 *  nothing else, and a type encoded in hue would compete with the one signal that
 *  matters. See the well's own note at the row. */
export const TASK_KIND_ICON: Record<TaskType, LucideIcon> = {
  intakeBillingReview: BadgeCheck,
  monthlyReReview: BadgeCheck,
  imminentFlagReview: Flag,
  clinicalFlagReview: Flag,
  routineFlagReview: ClipboardCheck,
  activeEscalation: Phone,
  escalationDocumentation: FileText,
};

/** ═══ THE FILTER'S VOCABULARY — COARSER THAN THE ROW'S ═══
 *
 *  A filter chip groups what a reader would filter BY, which is not one-per-task-
 *  type: nobody wants "Intake" separately from "Monthly re-review" when both are
 *  billing code reviews. So chips key on this, and the two billing types collapse
 *  to one chip.
 *
 *  KEYED ON THE LABEL rather than on a separate enum, so the collapse is a
 *  consequence of two types sharing a name rather than a second table that has to
 *  be kept in step with the first. A new task type gets a chip the moment it gets
 *  a label, and two types that share a label share a chip. */
export function taskKindKey(taskType: TaskType): string {
  return TASK_KIND_LABEL[taskType];
}
