// ═══════════════════════════════════════════════════════════════════════════
// THE START-HERE PREVIEW (Today rebuild, Phase I)
//
// ═══ THE LINE THIS MODULE WALKS ═══
//
// Today may show a supervisor WHAT IS WAITING. It may not let them ACT on it.
// Everything here is selection and naming; there is no disposition, no status
// change and no control. Each item carries an `href` to its own record and
// that is the only thing a reader can do with it.
//
// ═══ FORK I-1: KEYED TO THE RATIONALE ═══
//
// The preview shows ONE task type — the one the rationale names. A mixed list
// of escalations, flags and care reviews has no honest single name, and mixing
// object classes reintroduces the ordering problem the destinations were
// flattened to remove. One recommendation, two parts.
//
// ═══ THE SELECTION RULE AND WHY IT CANNOT DISAGREE WITH THE RATIONALE ═══
//
// Oldest open first, ascending, capped at 4. The sets are the ones
// `open-counts.ts` exports, NOT re-derived here — `activeEscalations`,
// `openCareReviews`, and `events` (already open-only). That is the whole
// mechanism behind I.2.3: the rationale names a destination, this reads the
// same destination's same set, so "Care Reviews holds the oldest work at 3d"
// and the first preview row are the same item by construction rather than by
// agreement.
//
// I.2.4 IS NOT VIOLATED. The standing fixed-order rule governs the destination
// CARDS, which never reorder. These are ordered by one stated deterministic
// rule, which the rule's own text permits.
//
// ═══ WHAT A ROW MAY CARRY (I.4) — AND THE TWO OMISSIONS ═══
//
// Name (already initialised upstream), age, and the status word its
// destination owns "where one exists".
//
//  · NO PRESENTATION OR DIAGNOSIS CODES. The reference Figma has an ICD
//    column. On a surface that stays open for a whole shift that is the most
//    sensitive content on the page, and in an OLDEST-FIRST list it earns
//    nothing — the supervisor starts at the top rather than choosing among
//    four. Codes stay in the destination, where triage across the full queue
//    actually happens.
//  · AND RISK FLAGS GET NO STATUS WORD, for the same reason one level along. A
//    flag's status-shaped field is its CATEGORY — "Unsafe home environment" —
//    which is clinical content about a named teen, not a workflow state. I.4.3
//    says "where one exists"; for flags one does not, so the field is null and
//    the row is name plus age.

import { DESTINATION_ORDER, type DestinationId } from "@/lib/ia/destinations";
import { activeEscalations, openCareReviews } from "@/lib/ia/open-counts";
import { ackStateFor } from "@/lib/monitoring/escalation";
import { PROPOSAL_LABEL, proposalKindFor } from "@/lib/record/proposal-kind";
import type { TodayInput } from "@/lib/home/today";

/** HARD, NOT CONFIGURABLE (I.2.2). Exported so the test and the UI read one
 *  number, never so a caller can raise it. */
export const PREVIEW_CAP = 4;

export interface StartHereItem {
  id: string;
  /** Already initialised upstream — `teenDisplayName` and `teenName` are
   *  "Theo L." shaped before they reach here, so this module never truncates a
   *  surname and never has to know how. */
  name: string;
  /** The instant the ordering is derived from, which is why I.4.2 requires it
   *  to be visible: a list sorted by a fact it does not show is a list a reader
   *  has to take on trust. */
  at: number;
  /** NEEDS-COPY-NICOLE, where non-null. */
  status: string | null;
  /** The individual record, not the destination's list top (I.5.2). */
  href: string;
}

export interface StartHerePreview {
  destination: DestinationId;
  /** At most `PREVIEW_CAP`, oldest first. */
  items: StartHereItem[];
  /** The TRUE total open for the destination — the number the destination card
   *  also shows. I.3.4: the preview is never the only place a total appears. */
  total: number;
  /** `See all`, where it renders. */
  href: string;
}

/* ═══ THE DEEP LINKS (I.5.2, I.5.3) ═══
   Escalations already had one — `/app/escalations?escalation={id}` — and the
   other two did not. The param names follow it rather than inventing a
   convention, and both routes already carry a URL-driven focus prop
   (`focusEscalation`, `focusBand`), so this is the same plumbing one more
   time.
   IT IS NOT A CHANGE TO A FROZEN SURFACE. The Care Reviews detail pane and
   `PresentationReviewModule` render exactly what they render when a supervisor
   clicks the row; this selects the row, which is what selection already does.
   Nothing about the pane's output is touched. */
function itemHref(destination: DestinationId, id: string): string {
  const key =
    destination === "escalations"
      ? "escalation"
      : destination === "risk-flags"
        ? "flag"
        : "review";
  return `/app/${destination}?${key}=${encodeURIComponent(id)}`;
}

/** Oldest first, then id — a total order, so two items sharing an instant do
 *  not swap between renders and make a stable list look like a shuffling one. */
function oldestFirst(a: StartHereItem, b: StartHereItem): number {
  return a.at - b.at || a.id.localeCompare(b.id);
}

/** Every open item of one destination, as preview rows, oldest first. Exported
 *  for the test, which needs the pre-cap list to prove the cap is a slice of it
 *  rather than a different query. */
export function startHereCandidates(
  destination: DestinationId,
  input: TodayInput
): StartHereItem[] {
  const { items, events, escalations, now } = input;

  if (destination === "escalations") {
    return activeEscalations(escalations, now)
      .map((r) => ({
        id: r.id,
        name: r.teenName,
        at: r.triggeredAt,
        /* NEEDS-COPY-NICOLE: Response overdue / Awaiting response.
           A WORKFLOW STATE, NOT A CLINICAL ONE — whether this record has been
           acknowledged inside its own published SLA. */
        status:
          ackStateFor(r, now) === "breached" ? "Response overdue" : "Awaiting response",
        href: itemHref(destination, r.id),
      }))
      .sort(oldestFirst);
  }

  if (destination === "risk-flags") {
    return events
      .map((e) => ({
        id: e.id,
        name: e.teenName,
        at: e.at,
        /* NULL BY DECISION, NOT BY OMISSION — see the module note. */
        status: null,
        href: itemHref(destination, e.id),
      }))
      .sort(oldestFirst);
  }

  return openCareReviews(items)
    .map((i) => ({
      id: i.id,
      name: i.teenDisplayName,
      at: i.openedAt,
      /* The destination's own status word, and the same string its row shows —
         "Renewal proposed" / "Change proposed" / "Code proposed". It names the
         KIND of proposal and contains no code. */
      status:
        i.payload.kind === "billing"
          ? PROPOSAL_LABEL[
              proposalKindFor(
                i.payload.current?.code ?? null,
                i.payload.recommended.code
              )
            ]
          : null,
      href: itemHref(destination, i.id),
    }))
    .sort(oldestFirst);
}

/**
 * The preview for the destination the rationale names.
 *
 * NULL WHEN THERE IS NOTHING TO PREVIEW. I.6.2 says a rationale naming a type
 * with zero open items is impossible by construction; this returns null rather
 * than trusting that, because the alternative is a module rendering a heading
 * over an empty list if the rationale expression ever drifts.
 */
export function startHerePreview(
  destination: DestinationId | null | undefined,
  input: TodayInput
): StartHerePreview | null {
  if (destination == null || !DESTINATION_ORDER.includes(destination)) return null;
  const all = startHereCandidates(destination, input);
  if (all.length === 0) return null;
  return {
    destination,
    items: all.slice(0, PREVIEW_CAP),
    total: all.length,
    href: `/app/${destination}`,
  };
}
