// ═══════════════════════════════════════════════════════════════════════════
// WHAT TODAY OWES — the one badge on the orientation route
//
// ═══ OBLIGATION-ONLY, NEVER AN OPEN COUNT ═══
//
// The destinations hold everything: care reviews, the risk flags, the
// escalation obligations. Measured on the shipped fixtures, the open count runs
// 22 on a typical shift and past 100 on a heavy one, against a routine tier
// whose SLA is seven days — so an open count would never once be zero. A badge
// that is never zero is not read: it changes constantly, it means nothing
// specific, and within a week the reader stops resolving it because it has never
// been worth resolving. The merge makes that worse than it was on either
// surface, because there is no longer a second page whose badge might differ.
//
// AND THIS IS THE `Today` BADGE, which the target nav shows as 30 — the sum of
// its three children's badges. That number does three wrong things at once: it
// double-counts every child badge, it sums incommensurate units (obligations
// against a five-minute clock, flag volume with no deadline, and reviews with a
// real one), and it renders coverage work as a thirty-item inbox, which is the
// exact framing this restructure exists to escape. The badge counts the
// TIME-CRITICAL set and renders nothing when it is empty.
//
// So this counts DEBT: things a named person has already failed to do by a time
// that has already passed, plus the one thing that is urgent by existing at all.
// Every member goes to zero and stays there when the work is done, which is what
// makes a non-zero badge mean something when it appears.
//
// `monitoringObligations` IS THE ANCESTOR and this is not a copy of it: that
// function counted what ONE surface owed, and its exclusion list was reasoned
// about that surface's contents. This counts what the whole console owes, so
// billing breach joins it — on Monitoring that was somebody else's queue.
//
// ═══ WHAT IS DELIBERATELY EXCLUDED, so nobody adds it back as an oversight ═══
//
// · Open items at any queue. Volume, not debt. See above.
// · FLAG BREACH AT ANY TIER — and this is the one that looks like an omission.
//   `TaskItem.slaDeadline` is populated for all three flag types (24h / 48h /
//   7d), so a breach is trivially computable and would have been the largest
//   contributor here. It is excluded because `FLAG_REVIEW_SLA` is null and
//   blocked on Meg: arch-mon's finding was that those three numbers are this
//   system's invention rather than anything published, and a nav badge is the
//   most declarative place in the product to assert one. The moment Meg answers,
//   this is one named constant and one line.
// · Clinical and routine anything. Same reason, one step further down.

import { ESCALATION_ACK_SLA } from "@/lib/monitoring/constants";
import { isBreached, type TaskItem } from "@/lib/tasks/types";
import { DESTINATION_TYPES } from "@/lib/ia/destinations";

export interface HomeObligations {
  /** An escalation nobody has responded to yet. Urgent by existing, not by a
   *  clock — which is why it is counted whole rather than only past its five
   *  minutes: the five minutes are the ACKNOWLEDGEMENT window, and a live
   *  escalation inside it is still the most urgent thing on the surface. */
  activeEscalations: number;
  /** …of which the five-minute acknowledgement window has already passed. A
   *  subset of the above, reported for the digest and NOT added to the total —
   *  adding it would count one escalation twice. */
  ackOutstanding: number;
  /** An escalation note past its 24 hours from the escalation's close. */
  documentationOverdue: number;
  /** A billing review past its SLA. The one queue breach that is real: the
   *  constant is published, even if 48h-vs-72h is still unresolved. */
  billingOverdue: number;
  /** What the badge shows. Zero means nothing is owed, not that nothing is
   *  open — and on this surface those are wildly different numbers. */
  total: number;
}

export function homeObligations(items: TaskItem[], now: number): HomeObligations {
  let activeEscalations = 0;
  let ackOutstanding = 0;
  let documentationOverdue = 0;
  let billingOverdue = 0;

  for (const item of items) {
    // RESOLVED IS NOT OWED. `inProgress` still is: a review somebody opened and
    // did not finish is exactly the debt this counts.
    if (item.status === "resolved") continue;

    if (item.taskType === "activeEscalation") {
      activeEscalations += 1;
      if (now - item.openedAt > ESCALATION_ACK_SLA) ackOutstanding += 1;
      continue;
    }
    if (item.taskType === "escalationDocumentation") {
      // The clock started at the escalation's CLOSE, and `slaDeadline` already
      // carries that — see `deadlineFor` — so this cannot silently measure from
      // the task's creation instead.
      if (isBreached(item, now)) documentationOverdue += 1;
      continue;
    }
    /* ═══ RE-POINTED OFF THE TIER QUEUES (supervisor IA restructure) ═══
       This read `QUEUE_TYPES.billing` from the four-queue model, which the
       restructure retires — the first three of those queues were the fabricated
       severity taxonomy promoted to IA. `DESTINATION_TYPES` is the same idea
       against the three destinations that survive, so the set this asks about is
       unchanged and the thing it asks is no longer named after a tier. */
    if (DESTINATION_TYPES["care-reviews"].includes(item.taskType) && isBreached(item, now)) {
      billingOverdue += 1;
    }
  }

  return {
    activeEscalations,
    ackOutstanding,
    documentationOverdue,
    billingOverdue,
    total: activeEscalations + documentationOverdue + billingOverdue,
  };
}
