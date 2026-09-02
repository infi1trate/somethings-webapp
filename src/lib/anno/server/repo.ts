// THE SERVER-SIDE DATA OPERATIONS.
//
// Everything that decides what a stored comment looks like lives here, so the
// route handler stays a thin HTTP shell and the rules are testable without one.
//
// ═══ WHAT THE SERVER OWNS, AND WHY ═══
//
// `id`, `number`, `createdAt`, `updatedAt`, `deletedAt`, `status`, `replies` and
// `authorIpHint` are all assigned here and are absent from `NewComment`. A client
// cannot originate any of them. That is not defensiveness for its own sake — it
// is what makes `number` trustworthy enough to say out loud. If a client could
// choose its own number, "comment 7" would be a claim rather than a fact.

import { randomUUID } from "node:crypto";
import { kv } from "@/lib/anno/server/kv";
import {
  BODY_MAX,
  type Comment,
  type NewComment,
  type Reviewer,
} from "@/lib/anno/types";

/** ═══ THE WORKSPACE ═══
 *
 *  Numbering is "per-workspace sequential" (Appendix A). This prototype has ONE
 *  workspace, so the constant is a single literal — but it is a named constant
 *  and part of every key, so introducing a second workspace is a parameter change
 *  rather than a migration of every key in the store. */
const WORKSPACE = "default";

const COMMENT_PREFIX = `anno:${WORKSPACE}:comment:`;
const REVIEWER_PREFIX = `anno:${WORKSPACE}:reviewer:`;
const COUNTER_KEY = `anno:${WORKSPACE}:counter`;

const commentKey = (id: string) => `${COMMENT_PREFIX}${id}`;
const reviewerKey = (clientId: string) => `${REVIEWER_PREFIX}${clientId}`;

/** Thrown inside the repo, mapped to a status by the route. Kept local so the
 *  repo has no opinion about HTTP. */
export class RepoError extends Error {
  constructor(
    readonly kind: "not-found" | "invalid",
    message: string
  ) {
    super(message);
    this.name = "RepoError";
  }
}

/** ═══ VALIDATION IS SERVER-SIDE TOO ═══
 *
 *  `validateBody` runs in the client adapter as well, and that is not
 *  duplication worth removing: the client copy is for a fast, typo-level
 *  response, and this one is the rule. A client check alone is a suggestion.
 *
 *  Anchor and context are checked structurally rather than deeply — the point is
 *  to reject a malformed payload, not to re-implement the type system at
 *  runtime. */
function assertDraft(draft: unknown): asserts draft is NewComment {
  if (!draft || typeof draft !== "object") {
    throw new RepoError("invalid", "Expected a comment payload.");
  }
  const d = draft as Partial<NewComment>;
  if (typeof d.authorClientId !== "string" || d.authorClientId.length === 0) {
    throw new RepoError("invalid", "authorClientId is required.");
  }
  if (typeof d.body !== "string" || d.body.trim().length === 0) {
    throw new RepoError("invalid", "A comment needs something in it.");
  }
  if (d.body.length > BODY_MAX) {
    throw new RepoError("invalid", `A comment can be at most ${BODY_MAX} characters.`);
  }
  if (!d.anchor || typeof d.anchor !== "object") {
    throw new RepoError("invalid", "anchor is required.");
  }
  if (!d.context || typeof d.context !== "object") {
    throw new RepoError("invalid", "context is required.");
  }
}

/** ═══ THE IP HINT — TAKEN HERE, USED NOWHERE ═══
 *
 *  Appendix A wants a hint; R9 forbids it becoming identity. It is derived from
 *  the forwarding header, stored, and then never read by any query in this file:
 *  nothing filters, groups or matches on it. The only reason it exists is human
 *  recall in a forensic case, and it stays `null` when there is no header rather
 *  than inventing "unknown".
 *
 *  Truncated to /24 (or the first two v6 groups) before storage. A full address
 *  is more precision than a "hint" needs, and a prototype behind a shared demo
 *  password should not be accumulating exact addresses of the people reviewing
 *  it. */
export function ipHintFrom(headers: Headers): string | null {
  const raw =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip")?.trim() ??
    "";
  if (!raw) return null;
  if (raw.includes(":")) {
    const groups = raw.split(":").filter(Boolean);
    return groups.length >= 2 ? `${groups[0]}:${groups[1]}::/32` : null;
  }
  const octets = raw.split(".");
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0/24` : null;
}

export async function listComments(): Promise<Comment[]> {
  const all = await kv().scan<Comment>(COMMENT_PREFIX);
  /* Sorted by `number`, ascending, ALWAYS. A key scan has no defined order, so
     without this the list arrives differently on each call and "comment 7" would
     be in a different place every time — which is the one thing numbering exists
     to prevent. Soft-deleted comments are INCLUDED: `restore` has to be able to
     find them, and hiding is the reader's job, not the store's. */
  return all.sort((a, b) => a.number - b.number);
}

export async function createComment(
  draft: unknown,
  ipHint: string | null
): Promise<Comment> {
  assertDraft(draft);

  /* ═══ THE NUMBER COMES FIRST, AND IT COMES FROM `incr` ═══
     Not from `list().length + 1`. A count is a read-modify-write across two
     awaits, so two concurrent creates both read 6 and both write 7 — and soft
     deletes make a count wrong even single-threaded. `incr` is atomic in both
     drivers (Redis natively; a serialised queue in the file driver), so the
     number is allocated exactly once and never reused. */
  const number = await kv().incr(COUNTER_KEY);
  const now = new Date().toISOString();

  const comment: Comment = {
    id: randomUUID(),
    number,
    authorClientId: draft.authorClientId,
    authorIpHint: ipHint,
    body: draft.body,
    status: "open",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    anchor: draft.anchor,
    context: draft.context,
    replies: [],
  };

  await kv().set(commentKey(comment.id), comment);
  return comment;
}

/** ═══ THE PATCHABLE SURFACE IS NARROW, ON PURPOSE ═══
 *
 *  `Partial<Comment>` in the adapter signature would, taken literally, let a
 *  caller rewrite `number`, `createdAt` or `authorClientId`. It does not: only
 *  the fields a reviewer can actually change are read off the patch, and
 *  everything else is ignored rather than rejected — a client sending back a
 *  whole comment object (the obvious thing to do) should not get a 400 for
 *  including fields it did not touch. */
export async function updateComment(
  id: string,
  patch: Partial<Comment>
): Promise<Comment> {
  const existing = await kv().get<Comment>(commentKey(id));
  if (!existing) throw new RepoError("not-found", `No comment ${id}.`);

  if (patch.body !== undefined) {
    if (typeof patch.body !== "string" || patch.body.trim().length === 0) {
      throw new RepoError("invalid", "A comment needs something in it.");
    }
    if (patch.body.length > BODY_MAX) {
      throw new RepoError("invalid", `A comment can be at most ${BODY_MAX} characters.`);
    }
  }
  if (patch.status !== undefined && patch.status !== "open" && patch.status !== "resolved") {
    throw new RepoError("invalid", "status must be 'open' or 'resolved'.");
  }

  const next: Comment = {
    ...existing,
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
    ...(patch.replies !== undefined ? { replies: patch.replies } : {}),
    updatedAt: new Date().toISOString(),
  };

  await kv().set(commentKey(id), next);
  return next;
}

/** Soft delete. Sets `deletedAt` and leaves everything else — including the
 *  number, which is never reissued, so restoring cannot collide with a comment
 *  created in the meantime. */
export async function softDeleteComment(id: string): Promise<Comment> {
  const existing = await kv().get<Comment>(commentKey(id));
  if (!existing) throw new RepoError("not-found", `No comment ${id}.`);
  const now = new Date().toISOString();
  const next: Comment = { ...existing, deletedAt: now, updatedAt: now };
  await kv().set(commentKey(id), next);
  return next;
}

export async function restoreComment(id: string): Promise<Comment> {
  const existing = await kv().get<Comment>(commentKey(id));
  if (!existing) throw new RepoError("not-found", `No comment ${id}.`);
  const now = new Date().toISOString();
  const next: Comment = { ...existing, deletedAt: null, updatedAt: now };
  await kv().set(commentKey(id), next);
  return next;
}

export async function listReviewers(): Promise<Reviewer[]> {
  const all = await kv().scan<Reviewer>(REVIEWER_PREFIX);
  return all.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** ═══ UPSERT, AND WHY A RENAME NEEDS NO MIGRATION ═══
 *
 *  Keyed by `clientId`, so writing a reviewer with a new `displayName` replaces
 *  the record in place. Not one comment is touched, because no comment carries a
 *  name — and every render resolves through this record. That is R9 working as
 *  designed: retroactive by construction rather than by a backfill job. */
export async function upsertReviewer(input: unknown): Promise<Reviewer> {
  if (!input || typeof input !== "object") {
    throw new RepoError("invalid", "Expected a reviewer payload.");
  }
  const r = input as Partial<Reviewer>;
  if (typeof r.clientId !== "string" || r.clientId.length === 0) {
    throw new RepoError("invalid", "clientId is required.");
  }
  if (typeof r.displayName !== "string" || r.displayName.trim().length === 0) {
    throw new RepoError("invalid", "displayName is required.");
  }
  const reviewer: Reviewer = {
    clientId: r.clientId,
    displayName: r.displayName.trim(),
    colorChip: typeof r.colorChip === "string" ? r.colorChip : "#7b5bd6",
    lastSeenAt: new Date().toISOString(),
  };
  await kv().set(reviewerKey(reviewer.clientId), reviewer);
  return reviewer;
}
