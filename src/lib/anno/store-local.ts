// THE LOCAL STORE — Path B. `localStorage`, device-only.
//
// Built even though Path A was chosen, because the brief asks for two
// implementations selected by config: this is the fallback when the shared store
// cannot be reached, and the thing that keeps a reviewer's notes from being lost
// when it is.
//
// ═══ `kind = 'local'` IS THE POINT OF THIS FILE ═══
//
// R10's risk is that device-local comments are indistinguishable from shared
// ones. Everything here reports `'local'` and cannot be configured otherwise, so
// the UI is never able to present these as shared. When this store is in use the
// drawer must say, in the body and not a tooltip, that the comments are on this
// device only and that clearing browser data destroys them.
//
// ═══ NUMBERING IS LOCAL, AND THAT HAS A CONSEQUENCE WORTH SAYING ═══
//
// The counter lives in this browser. Two reviewers each writing three comments
// both produce 1, 2, 3 — so "comment 7" means different things to different
// people, and a verbal reference across a table is simply wrong. That is not a
// defect in this file; it is what device-local numbering IS. Logged in GAPS.md
// (anno-01) rather than left for someone to discover in a review.

import { AnnoError, normalize } from "@/lib/anno/errors";
import type {
  AnnotationStore,
  AnnotationStoreExtras,
  PendingComment,
} from "@/lib/anno/store";
import { validateBody, type Comment, type NewComment, type Reviewer } from "@/lib/anno/types";

/** Same convention as `somethings.review-draft.*` and the identity keys. */
const COMMENTS_KEY = "somethings.anno.comments";
const REVIEWERS_KEY = "somethings.anno.reviewers";
const COUNTER_KEY = "somethings.anno.counter";

export class LocalAnnotationStore implements AnnotationStore, AnnotationStoreExtras {
  readonly kind = "local" as const;

  #reachable = true;
  #listeners = new Set<() => void>();

  /** For a local store, "reachable" is "the browser is letting us write". Set
   *  false the first time storage refuses — Safari private mode, a full quota, a
   *  blocked-cookies setting — so the UI can say comments are not being kept
   *  rather than appearing to save into a void. */
  get reachable(): boolean {
    return this.#reachable;
  }

  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  #emit(): void {
    for (const fn of [...this.#listeners]) fn();
  }

  /** ═══ THERE ARE NO PENDING WRITES ON THIS PATH ═══
   *  A `localStorage` write either succeeds synchronously or throws. There is no
   *  in-flight window, so nothing can be optimistic and nothing can be awaiting
   *  reconciliation. Always empty, and `retry` is correspondingly unreachable. */
  pending(): PendingComment[] {
    return [];
  }

  retry(): Promise<Comment> {
    return Promise.reject(
      new AnnoError("not-found", "Local saves are immediate — there is nothing pending.")
    );
  }

  discard(): void {
    /* nothing pending to discard */
  }

  /* ── storage plumbing ─────────────────────────────────────────────── */

  /** ═══ TWO FAILURES THAT MUST NOT BE TREATED ALIKE ═══
   *
   *  This originally caught both and returned the fallback, and the anno-01
   *  verification caught what that costs: with storage revoked, `list()`
   *  resolved `[]` — reporting "no comments" when the truth was "this browser is
   *  blocking storage" — and the mutators then cascaded to `not-found`, because
   *  they looked into an empty array and did not find the comment. Three
   *  different lies from one `catch`.
   *
   *  So the two are separated:
   *
   *   • STORAGE REFUSED — private mode, blocked cookies, revoked permission.
   *     Throws. The caller cannot be allowed to mistake this for an empty store,
   *     because the reader is about to be told their comments do not exist.
   *
   *   • CORRUPT JSON — a half-written record from an earlier crash. Returns the
   *     fallback, deliberately. A reviewer with one bad record should lose that
   *     record, not the ability to open the drawer. */
  #read<T>(key: string, fallback: T): T {
    let raw: string | null;
    try {
      if (typeof localStorage === "undefined") {
        throw new AnnoError("storage-denied", "No localStorage in this context.");
      }
      raw = localStorage.getItem(key);
    } catch (e) {
      this.#reachable = false;
      throw normalize(e, "storage-denied");
    }
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  #write<T>(key: string, value: T): void {
    try {
      if (typeof localStorage === "undefined") {
        throw new AnnoError("storage-denied", "No localStorage in this context.");
      }
      localStorage.setItem(key, JSON.stringify(value));
      this.#reachable = true;
    } catch (e) {
      this.#reachable = false;
      throw normalize(e, "storage-denied");
    }
  }

  #all(): Comment[] {
    return this.#read<Comment[]>(COMMENTS_KEY, []);
  }

  /* ── the contract ─────────────────────────────────────────────────── */

  /** Synchronous already — `localStorage` is not a network. */
  snapshot(): Comment[] {
    try {
      return this.#all().sort((a, b) => a.number - b.number);
    } catch {
      return [];
    }
  }

  async list(): Promise<Comment[]> {
    try {
      return this.#all().sort((a, b) => a.number - b.number);
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }

  async create(draft: NewComment): Promise<Comment> {
    try {
      const check = validateBody(draft.body);
      if (!check.ok) throw new AnnoError("invalid", check.reason);

      /* Single-threaded and synchronous, so read-modify-write cannot interleave
         the way it can on the server — there is no `await` between the read and
         the write. Two `create` calls in the same millisecond therefore still get
         distinct numbers. */
      const next = this.#read<number>(COUNTER_KEY, 0) + 1;
      const now = new Date().toISOString();
      const comment: Comment = {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        number: next,
        authorClientId: draft.authorClientId,
        /* OMITTED ON THIS PATH — the brief is explicit that Path B should not
           store "a null column of theatre". The field exists in the Appendix A
           type, so it is present and null; nothing on this path ever populates
           it, and no code reads it. */
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

      this.#write(COUNTER_KEY, next);
      this.#write(COMMENTS_KEY, [...this.#all(), comment]);
      this.#emit();
      return comment;
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }

  async update(id: string, patch: Partial<Comment>): Promise<Comment> {
    try {
      if (patch.body !== undefined) {
        const check = validateBody(patch.body);
        if (!check.ok) throw new AnnoError("invalid", check.reason);
      }
      const all = this.#all();
      const i = all.findIndex((c) => c.id === id);
      if (i < 0) throw new AnnoError("not-found", `No comment ${id}.`);

      /* The same narrow surface the server enforces — `number`, `id`,
         `createdAt` and `authorClientId` are not patchable, so the two paths
         behave identically. */
      const next: Comment = {
        ...all[i],
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
        ...(patch.replies !== undefined ? { replies: patch.replies } : {}),
        updatedAt: new Date().toISOString(),
      };
      all[i] = next;
      this.#write(COMMENTS_KEY, all);
      this.#emit();
      return next;
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.#setDeletedAt(id, new Date().toISOString());
  }

  async restore(id: string): Promise<Comment> {
    return this.#setDeletedAt(id, null);
  }

  async #setDeletedAt(id: string, value: string | null): Promise<Comment> {
    try {
      const all = this.#all();
      const i = all.findIndex((c) => c.id === id);
      if (i < 0) throw new AnnoError("not-found", `No comment ${id}.`);
      const next: Comment = {
        ...all[i],
        deletedAt: value,
        updatedAt: new Date().toISOString(),
      };
      all[i] = next;
      this.#write(COMMENTS_KEY, all);
      this.#emit();
      return next;
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }

  async reviewers(): Promise<Reviewer[]> {
    try {
      return this.#read<Reviewer[]>(REVIEWERS_KEY, []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }

  async upsertReviewer(r: Reviewer): Promise<Reviewer> {
    try {
      if (!r.clientId) throw new AnnoError("invalid", "clientId is required.");
      if (!r.displayName?.trim()) throw new AnnoError("invalid", "displayName is required.");
      const next: Reviewer = { ...r, lastSeenAt: new Date().toISOString() };
      const all = this.#read<Reviewer[]>(REVIEWERS_KEY, []);
      const i = all.findIndex((x) => x.clientId === r.clientId);
      if (i >= 0) all[i] = next;
      else all.push(next);
      this.#write(REVIEWERS_KEY, all);
      this.#emit();
      return next;
    } catch (e) {
      throw normalize(e, "storage-denied");
    }
  }
}
