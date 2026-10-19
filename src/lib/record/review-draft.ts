"use client";

// THE REVIEW DRAFT — in-progress clinical text, and where it is allowed to live.
//
// ═══ WHY NOT THE STORE ═══
//
// `lib/onboarding/store.ts` is the app's persistence, and it is backed by
// localStorage (see its `createJSONStorage` adapter). localStorage survives the
// browser closing and is readable by every tab on the origin for as long as
// nobody clears it. That is the right trade for a theme or a wizard draft and the
// wrong one for a half-written diagnostic statement about a minor: it would
// outlive the authenticated session that justified writing it.
//
// So: sessionStorage, keyed to the record AND the review instance. It dies with
// the tab, which is the closest thing this prototype has to "the session ends".
//
// THIS IS NOT ENCRYPTION AND DOES NOT PRETEND TO BE. A draft is readable by
// anything running on the origin while the tab is open. The claim is narrower and
// worth stating exactly: it does not persist beyond the session, and it is not
// written to a shared or global scope where another record's page could read it.
//
// ═══ KEYED BY REVIEW, NOT JUST BY RECORD ═══
//
// A draft belongs to the decision it was written for. When the cadence rolls and
// a new review id appears, the old draft is about a review nobody can commit any
// more — restoring it into the new one would put last quarter's reasoning under
// this quarter's scores. Superseded drafts are cleared on open.

import type { FieldProvenanceState } from "@/lib/record/field-provenance";
import type { CareUpdateBody } from "@/lib/record/care-demo";

const PREFIX = "somethings.review-draft.";

/** The decision half of a draft. `null` while the supervisor has not chosen —
 *  which is the state the drawer opens in, and a real state to persist: it is the
 *  difference between "not decided yet" and "decided to confirm". */
export type ReviewDecision =
  | { kind: "confirm" }
  | { kind: "change"; code: string; statement: string };

export interface ReviewDraft {
  decision: ReviewDecision | null;
  /** ═══ WHETHER THE SUPERVISOR SAID `Save draft` (row-items §1.1) ═══
   *
   *  §1.1 asked whether an edit becomes a draft on any change or only on an
   *  explicit save, because "these produce visibly different lists". ANSWERED:
   *  only on explicit `Save draft`.
   *
   *  SO THERE ARE TWO THINGS HERE AND THERE USED TO BE ONE. The autosave buffer
   *  still exists and still writes on every keystroke — removing it would mean
   *  a supervisor who types a paragraph and clicks a row loses the paragraph,
   *  which §1.1 did not ask for and which no answer about a MARKER should
   *  cost. What the answer changes is what COUNTS as a draft: unsaved work is
   *  not a draft, so it gets no marker and the list stays honest about what has
   *  been committed to.
   *
   *  ABSENT MEANS NOT SAVED, which is also the right migration: every draft
   *  already in a session's storage was written by the old keystroke autosave,
   *  and none of those were explicit saves. They restore into the form exactly
   *  as before and simply stop claiming a marker. */
  saved?: boolean;
  body: CareUpdateBody;
  /** ═══ C3: PROVENANCE TRAVELS WITH THE TEXT ═══
   *
   *  A draft that restored the words without the state would silently launder
   *  provenance: a supervisor inserts a model draft, closes the card, comes
   *  back, and commits verbatim model prose recorded as `authored`. The whole
   *  point of the field is that it cannot be lost by a reload.
   *
   *  `insertedText` rides along too, because `ai_inserted` is a claim about the
   *  CURRENT content — without the baseline, a restored draft could not tell an
   *  unedited insertion from an edited one, and would have to guess.
   *
   *  Absent on drafts written before this field existed: they restore as
   *  `authored`, which is the same defensible default the committed record
   *  takes. See the known limitation on `field-provenance.ts`. */
  provenance?: {
    clinical: FieldProvenanceState;
    diagnostic: FieldProvenanceState;
  };
  /** When the draft was last written, for the restore notice. */
  savedAt: number;
}

function keyFor(teenId: string, reviewId: string) {
  return `${PREFIX}${teenId}.${reviewId}`;
}

/** Every storage call is wrapped: sessionStorage throws in private mode on some
 *  browsers, is absent during SSR, and can be over quota. A draft that cannot be
 *  saved must never take the drawer down with it — the supervisor's text is still
 *  on screen in component state, which is the copy that matters. */
function safe<T>(run: () => T, fallback: T): T {
  try {
    if (typeof sessionStorage === "undefined") return fallback;
    return run();
  } catch {
    return fallback;
  }
}

export function readReviewDraft(
  teenId: string,
  reviewId: string
): ReviewDraft | null {
  return safe(() => {
    const raw = sessionStorage.getItem(keyFor(teenId, reviewId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewDraft;
    // A stored shape from an older build is discarded rather than trusted into
    // the form — a draft is a convenience, and a malformed one is not worth a
    // crash on a clinical surface.
    if (!parsed || typeof parsed !== "object" || !parsed.body) return null;
    return parsed;
  }, null);
}

// ═══════════════════════════════════════════════════════════════════════════
// A SUBSCRIPTION, SO A LIST CAN FILTER ON DRAFT STATE (Refinement §6.3)
//
// Care Reviews' `Draft saved / not started` filter has to know, per row, whether
// a draft exists. `readReviewDraft` answers that — but a component cannot read
// `sessionStorage` during render: it is impure, the React Compiler in this repo
// rejects it, and it produces a hydration mismatch because the server has no
// session storage at all. The same two problems the theme toggle hit, and the
// same instrument fixes them: `useSyncExternalStore`.
//
// SO THIS MODULE BECOMES THE STORE. A monotonic version, bumped on every write
// and clear, is all a subscriber needs — the reader re-reads the keys it cares
// about when the version moves, and `getServerSnapshot` returns 0 so the server
// renders "no drafts" and the client corrects it on hydration.
//
// WHY A COUNTER AND NOT THE DRAFT SET. The set is per (teen, review) and only
// the caller knows which pairs it is asking about; a snapshot of all of them
// would have to be a new object every read, which is the one thing
// `useSyncExternalStore` forbids (it compares snapshots by identity and would
// loop). A number is stable by construction.

let draftVersion = 0;
const draftListeners = new Set<() => void>();

function announceDraftChange(): void {
  draftVersion += 1;
  for (const fn of draftListeners) fn();
}

export function subscribeReviewDrafts(onChange: () => void): () => void {
  draftListeners.add(onChange);
  return () => {
    draftListeners.delete(onChange);
  };
}

/** The client snapshot. Stable between changes — see the module note. */
export function reviewDraftsVersion(): number {
  return draftVersion;
}

/** The server snapshot: no session storage exists there, so no draft does. */
export function reviewDraftsVersionServer(): number {
  return 0;
}

export function writeReviewDraft(
  teenId: string,
  reviewId: string,
  draft: ReviewDraft
): void {
  safe(() => {
    sessionStorage.setItem(keyFor(teenId, reviewId), JSON.stringify(draft));
  }, undefined);
  /* ANNOUNCED EVEN IF THE WRITE FAILED. `safe` swallows a quota or private-mode
     throw, and a subscriber's job is to re-read — which will correctly find no
     draft. Announcing unconditionally keeps "the store changed" and "the store
     persisted" as two separate claims, and only the first one is this line's. */
  announceDraftChange();
}

/** ═══ PROMOTE THE AUTOSAVE BUFFER TO A SAVED DRAFT (§1.1) ═══
 *  Reads what the keystroke autosave already put down and flips one flag, so
 *  `Save draft` cannot disagree with the text on screen — there is no second
 *  serialisation to get out of step.
 *  A NO-OP IF NOTHING IS STORED. `Save draft` on an untouched form has nothing
 *  to promote, and writing an empty draft to create a marker would make the
 *  marker mean "somebody pressed a button" rather than "there is work here". */
export function markReviewDraftSaved(teenId: string, reviewId: string): void {
  const existing = readReviewDraft(teenId, reviewId);
  if (!existing) return;
  writeReviewDraft(teenId, reviewId, { ...existing, saved: true });
}

/** What the LIST tests. Separate from `readReviewDraft` because the form wants
 *  any buffered text and the row wants only a saved draft — one storage key,
 *  two questions, and conflating them is what made every keystroke a marker. */
export function hasSavedReviewDraft(teenId: string, reviewId: string): boolean {
  return readReviewDraft(teenId, reviewId)?.saved === true;
}

export function clearReviewDraft(teenId: string, reviewId: string): void {
  safe(() => {
    sessionStorage.removeItem(keyFor(teenId, reviewId));
  }, undefined);
  announceDraftChange();
}

/** ═══ SUPERSEDED DRAFTS ═══
 *
 *  Called when a review opens. Anything stored for this record under a DIFFERENT
 *  review id belongs to a cycle that has closed — the cadence moved, and the
 *  review that draft was written against can no longer be committed. Clearing it
 *  here rather than letting it sit means the storage for a record holds at most
 *  the draft for the review that is actually open.
 *
 *  Returns the ids it cleared so the caller can report them. */
export function clearSupersededDrafts(
  teenId: string,
  currentReviewId: string
): string[] {
  return safe(() => {
    const mine = `${PREFIX}${teenId}.`;
    const stale: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(mine)) continue;
      const reviewId = k.slice(mine.length);
      if (reviewId !== currentReviewId) stale.push(reviewId);
    }
    for (const id of stale) sessionStorage.removeItem(mine + id);
    return stale;
  }, []);
}

/** TODO-COPY. Coarse on purpose — a draft restored "2 minutes ago" and one
 *  restored "a moment ago" call for the same reaction, and a precise clock on a
 *  restore notice invites reading it as a saved-at timestamp on the record. */
export function draftAge(savedAt: number, now: number): string {
  const mins = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (mins < 1) return "a moment ago";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
