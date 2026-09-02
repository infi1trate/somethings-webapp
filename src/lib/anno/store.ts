// THE STORE CONTRACT — one interface, two implementations, chosen by config.
//
// ═══ THE CONTRACT IS EXACTLY THE ONE IN THE BRIEF ═══
//
// `AnnotationStore` below is transcribed from the brief with no signature
// changes. Two things are added ALONGSIDE it rather than to it, and both are
// flagged for approval at the gate:
//
//   • `AnnotationStoreExtras` — `subscribe`, `pending`, `retry`, `discard`.
//     Optimistic echo is unobservable without them: `create()` resolves only
//     after the round trip, so a UI awaiting it cannot render anything sooner,
//     and "the draft survives a failed save" needs somewhere for the draft to
//     survive. Both implementations satisfy the extras, so a consumer can rely
//     on them uniformly.
//
//   • Failures REJECT with `AnnoError` rather than resolving a `Result`. See
//     `errors.ts` for why, and change it here if that was not the intent.
//
// ═══ `kind` IS AN HONESTY MECHANISM, NOT A FEATURE FLAG ═══
//
// The PRD's R10 risk is that device-local comments look identical to shared ones
// in a screenshot. `kind` exists so the UI can never accidentally present one as
// the other, and it is READONLY and set by the constructor — a local store
// cannot be talked into reporting `'shared'`.

import type { Comment, NewComment, Reviewer } from "@/lib/anno/types";
import type { AnnoError } from "@/lib/anno/errors";

/** THE CONTRACT — verbatim from the brief. */
export interface AnnotationStore {
  list(): Promise<Comment[]>;
  create(draft: NewComment): Promise<Comment>;
  update(id: string, patch: Partial<Comment>): Promise<Comment>;
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<Comment>;
  reviewers(): Promise<Reviewer[]>;
  upsertReviewer(r: Reviewer): Promise<Reviewer>;
  readonly kind: "shared" | "local";
  readonly reachable: boolean;
}

/** ═══ A COMMENT THAT HAS NOT LANDED YET ═══
 *
 *  The optimistic echo. It is a real `Comment` so the UI renders it with no
 *  special case, plus the two things a pending item needs: which local id it is
 *  keyed by, and — if the save failed — why, so the reader is told rather than
 *  left with a note that silently is not there.
 *
 *  `number` on a pending comment is a PLACEHOLDER (0) until the server allocates
 *  the real one. Rendering "comment 0" would be a lie, so the UI shows pending
 *  items without a number; the reconciliation swaps in the allocated value. */
export type PendingComment = {
  localId: string;
  comment: Comment;
  state: "saving" | "failed";
  error: AnnoError | null;
};

export interface AnnotationStoreExtras {
  /** The current set WITHOUT a request. What a `subscribe` handler should read:
   *  reacting to a change by calling `list()` is how anno-04 produced an
   *  unbounded fetch loop. */
  snapshot(): Comment[];
  /** Fires whenever the cache changes — an optimistic insert, a reconciliation,
   *  a failure. Returns its own unsubscribe. */
  subscribe(fn: () => void): () => void;
  /** Everything not yet confirmed by the store, including failed saves whose
   *  text is still intact. */
  pending(): PendingComment[];
  /** Re-attempt a failed save. */
  retry(localId: string): Promise<Comment>;
  /** Abandon a failed save and drop its draft. */
  discard(localId: string): void;
}

export type FullAnnotationStore = AnnotationStore & AnnotationStoreExtras;

/** ═══ CONFIG ═══
 *
 *  `NEXT_PUBLIC_ANNO_STORE` — `"shared"` (default) or `"local"`. Public because
 *  the choice is made in the browser, and it is not a secret: which store is in
 *  use is something the UI is required to display anyway.
 *
 *  Defaulting to `shared` is deliberate. If the variable is missing or
 *  misspelled, the failure is a store that cannot be reached and says so —
 *  loudly, via `reachable: false`. Defaulting to `local` would fail the other
 *  way: everything appears to work while every comment silently goes nowhere but
 *  the reviewer's own laptop, which is the precise failure R10 is about. */
export type StoreKind = "shared" | "local";

export function configuredStoreKind(): StoreKind {
  return process.env.NEXT_PUBLIC_ANNO_STORE === "local" ? "local" : "shared";
}
