// THE SHARED STORE — Path A. HTTP against `/api/anno`, with optimistic echo.
//
// ═══ WHAT "OPTIMISTIC WITH RECONCILIATION" MEANS HERE ═══
//
// `create()` does three things in order:
//
//   1. Puts a fully-formed `Comment` into the local cache IMMEDIATELY, under a
//      temporary local id, and emits. Anything subscribed renders it in the same
//      frame — the save feels instant because for display purposes it already
//      happened.
//   2. POSTs.
//   3. On success, REPLACES the echo with the server's version and emits again.
//      The server's version is authoritative, and it is the only place the real
//      `number` and `id` come from — which is why the echo carries `number: 0`
//      and the UI renders pending items unnumbered rather than showing a number
//      that is about to change.
//
// On failure the echo is NOT removed. It is marked `failed` with its `AnnoError`
// and stays in `pending()` with the reviewer's text intact, so the recovery is
// `retry(localId)` rather than "type it again". A note that vanishes because the
// network blinked is the outcome this structure exists to prevent.
//
// ═══ `reachable` IS OBSERVED, NOT ASSUMED ═══
//
// It starts optimistic and is updated by every round trip. So it reports what
// actually happened on the last call rather than what the config hoped.

import {
  AnnoError,
  codeForStatus,
  normalize,
} from "@/lib/anno/errors";
import type {
  AnnotationStore,
  AnnotationStoreExtras,
  PendingComment,
} from "@/lib/anno/store";
import { validateBody, type Comment, type NewComment, type Reviewer } from "@/lib/anno/types";

const ENDPOINT = "/api/anno";

type Listener = () => void;

export class SharedAnnotationStore implements AnnotationStore, AnnotationStoreExtras {
  readonly kind = "shared" as const;

  #reachable = true;
  #confirmed: Comment[] = [];
  #pending = new Map<string, PendingComment>();
  #listeners = new Set<Listener>();

  get reachable(): boolean {
    return this.#reachable;
  }

  /* ── subscription ─────────────────────────────────────────────────── */

  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit(): void {
    /* Copied before iterating: a listener that unsubscribes itself while being
       notified would otherwise mutate the set mid-iteration. */
    for (const fn of [...this.#listeners]) fn();
  }

  pending(): PendingComment[] {
    return [...this.#pending.values()];
  }

  discard(localId: string): void {
    if (this.#pending.delete(localId)) this.#emit();
  }

  /* ── transport ────────────────────────────────────────────────────── */

  /** THE ONLY PLACE `fetch` IS CALLED. Every failure mode is converted here, so
   *  no method below has to think about status codes, JSON parse failures, or
   *  the fact that `fetch` reports a dead network as a bare `TypeError`. */
  async #req<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        // The gate cookie rides along; without this a cross-origin embed drops it.
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (e) {
      this.#reachable = false;
      throw normalize(e, "unreachable");
    }

    if (!res.ok) {
      /* A 4xx means the store ANSWERED — it is reachable and disagreed. Only a
         transport failure or a 5xx marks it unreachable, which keeps the UI from
         showing "can't reach the store" when the truth is "that body was too
         long". */
      this.#reachable = res.status < 500;
      let detail: string | undefined;
      try {
        detail = ((await res.json()) as { message?: string }).message;
      } catch {
        /* no body, or not JSON — the status is enough */
      }
      throw new AnnoError(codeForStatus(res.status), detail);
    }

    this.#reachable = true;
    try {
      return (await res.json()) as T;
    } catch (e) {
      throw normalize(e, "server");
    }
  }

  /* ── reads ────────────────────────────────────────────────────────── */

  /** Confirmed comments plus optimistic echoes, in number order with pending
   *  items last — they have no number yet, so they cannot be interleaved
   *  meaningfully, and the newest-at-the-end position is where a reviewer expects
   *  the thing they just wrote. */
  async list(): Promise<Comment[]> {
    const { comments } = await this.#req<{ comments: Comment[] }>("");
    this.#confirmed = comments;
    /* ═══ NO `#emit()` HERE — A READ MUST NOT NOTIFY ═══
     *
     *  This used to emit, and anno-04 found what that costs: a subscriber whose
     *  natural reaction to "something changed" is to call `list()` closes a loop —
     *  list → emit → list → emit — with a network request per turn. It exhausted
     *  the browser's sockets inside a few seconds (`net::ERR_INSUFFICIENT_RESOURCES`
     *  on every request in the tab, including navigation), and it looked like an
     *  unreachable store rather than a runaway caller.
     *
     *  The emit was redundant anyway: `list()` RETURNS the data, so its caller
     *  already has it. Only WRITES change state behind a subscriber's back, and
     *  only writes emit. Subscribers that want the current set without a request
     *  use `snapshot()`. */
    return [...this.#confirmed, ...this.pending().map((p) => p.comment)];
  }

  /** The cache, with no network call. For a render that must not suspend. */
  snapshot(): Comment[] {
    return [...this.#confirmed, ...this.pending().map((p) => p.comment)];
  }

  async reviewers(): Promise<Reviewer[]> {
    const { reviewers } = await this.#req<{ reviewers: Reviewer[] }>("?reviewers=1");
    return reviewers;
  }

  /* ── writes ───────────────────────────────────────────────────────── */

  async create(draft: NewComment): Promise<Comment> {
    /* Validated BEFORE the echo. An over-long body would be rejected by the
       server anyway, and showing it as saved for one round trip before snatching
       it back is worse than refusing it up front. */
    const check = validateBody(draft.body);
    if (!check.ok) throw new AnnoError("invalid", check.reason);

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const echo: Comment = {
      id: localId,
      // PLACEHOLDER — the server allocates the real one. See the module note.
      number: 0,
      authorClientId: draft.authorClientId,
      // The client cannot know this, and must not invent it.
      authorIpHint: null,
      body: draft.body,
      status: "open",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      anchor: draft.anchor,
      context: draft.context,
      replies: [],
    };

    this.#pending.set(localId, { localId, comment: echo, state: "saving", error: null });
    this.#emit();

    return this.#flush(localId, draft);
  }

  async retry(localId: string): Promise<Comment> {
    const p = this.#pending.get(localId);
    if (!p) throw new AnnoError("not-found", "That draft is no longer pending.");
    this.#pending.set(localId, { ...p, state: "saving", error: null });
    this.#emit();
    return this.#flush(localId, {
      authorClientId: p.comment.authorClientId,
      body: p.comment.body,
      anchor: p.comment.anchor,
      context: p.comment.context,
    });
  }

  /** The POST plus reconciliation. Shared by `create` and `retry` so the two
   *  cannot drift in how they treat a failure. */
  async #flush(localId: string, draft: NewComment): Promise<Comment> {
    try {
      const { comment } = await this.#req<{ comment: Comment }>("", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      // RECONCILE: drop the echo, adopt the server's version.
      this.#pending.delete(localId);
      this.#confirmed = [...this.#confirmed, comment].sort((a, b) => a.number - b.number);
      this.#emit();
      return comment;
    } catch (e) {
      const err = normalize(e);
      const p = this.#pending.get(localId);
      // The draft STAYS. That is the recovery path.
      if (p) this.#pending.set(localId, { ...p, state: "failed", error: err });
      this.#emit();
      throw err;
    }
  }

  async update(id: string, patch: Partial<Comment>): Promise<Comment> {
    if (patch.body !== undefined) {
      const check = validateBody(patch.body);
      if (!check.ok) throw new AnnoError("invalid", check.reason);
    }
    const { comment } = await this.#req<{ comment: Comment }>(`/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    this.#replace(comment);
    return comment;
  }

  async softDelete(id: string): Promise<void> {
    const { comment } = await this.#req<{ comment: Comment }>(`/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    this.#replace(comment);
  }

  async restore(id: string): Promise<Comment> {
    const { comment } = await this.#req<{ comment: Comment }>(`/${encodeURIComponent(id)}`, {
      method: "POST",
    });
    this.#replace(comment);
    return comment;
  }

  async upsertReviewer(r: Reviewer): Promise<Reviewer> {
    const { reviewer } = await this.#req<{ reviewer: Reviewer }>("", {
      method: "POST",
      body: JSON.stringify({ reviewer: r }),
    });
    return reviewer;
  }

  #replace(next: Comment): void {
    const i = this.#confirmed.findIndex((c) => c.id === next.id);
    if (i >= 0) this.#confirmed[i] = next;
    else this.#confirmed = [...this.#confirmed, next].sort((a, b) => a.number - b.number);
    this.#emit();
  }
}
