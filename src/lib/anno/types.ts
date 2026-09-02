// THE ANNOTATION DATA MODEL — PRD Appendix A, implemented verbatim.
//
// ═══ THIS FILE IS A TRANSCRIPTION, NOT A DESIGN ═══
//
// Every field on `Comment`, `Reply` and `Reviewer` below is from Appendix A, in
// its order, with its type. Nothing was added, renamed, widened or "improved".
// If a field looks wrong, the fix is to change Appendix A and re-transcribe —
// not to diverge here, because the whole point of an exact model is that the
// store, the API and the UI cannot disagree about what a comment is.
//
// Two things Appendix A states that the type system has to express carefully:
//
//  1. `authorDisplayName` IS DELIBERATELY ABSENT from `Comment`. It resolves from
//     the `Reviewer` record at render time so that a reviewer renaming themselves
//     applies RETROACTIVELY to everything they have already written (R9). Putting
//     it on the comment would freeze the name at write time, which is exactly the
//     bug R9 names. There is a resolver at the bottom of this file; there is no
//     field.
//
//  2. `resolutionTier` IS COMPUTED AT LOAD AND NEVER PERSISTED. So it cannot live
//     on `Comment` either — anything on `Comment` is what round-trips through the
//     store. It is expressed as a separate `Hydrated<T>` wrapper, below.

/** ═══ THE COMMENT — Appendix A, verbatim ═══ */
export type Comment = {
  id: string;
  /** Per-workspace sequential, for verbal reference ("comment 7"). Allocated by
   *  the store, never by the caller — see `AnnotationStore.create`. */
  number: number;
  /** Device-persistent, PRIMARY identity. See `identity.ts`. */
  authorClientId: string;
  /** Secondary hint only, NEVER identity. Never used for grouping-by-person and
   *  never for permissions — see the note in `identity.ts` on why this field is
   *  inert by construction rather than by convention. */
  authorIpHint: string | null;
  /** Max 1000 chars — enforced by `validateBody`, below. */
  body: string;
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
  /** Soft delete. A non-null value means "hidden", never "gone" — `restore` is
   *  in the store contract precisely because deletion here is reversible. */
  deletedAt: string | null;
  anchor: {
    elementRef: string;
    structuralPath: string | null;
    /** 0–1 fraction within the element box. */
    offsetX: number;
    offsetY: number;
    /** Absolute document coords. */
    fallbackX: number;
    fallbackY: number;
    scrollContainer: string | null;
  };
  context: {
    route: string;
    role: "mentor" | "lead_mentor" | "supervisor" | "admin";
    scenario: string;
    loadState: string;
    viewportWidth: number;
  };
  /** P1. Empty array in MVP. */
  replies: Reply[];
};

export type Reply = {
  id: string;
  authorClientId: string;
  body: string;
  createdAt: string;
};

export type Reviewer = {
  clientId: string;
  displayName: string;
  colorChip: string;
  lastSeenAt: string;
};

/** ═══ ROLE — NOTE THE SPELLING ═══
 *
 *  Appendix A says `lead_mentor` with an UNDERSCORE. The rest of this codebase
 *  spells the same persona `lead-mentor` with a hyphen (`src/lib/types.ts`, the
 *  dev bar's `PERSONAS`, `roleForPersona`). Both are correct in their own
 *  context and they must not be conflated silently, so the conversion is a named
 *  function rather than a cast at the call site. Logged in GAPS.md (anno-01).
 *
 *  `new-mentor` — the fifth persona, which the dev bar cannot select — has no
 *  Appendix A counterpart. It maps to `mentor`, which is what it is: a mentor
 *  who has not finished onboarding. */
export type AnnoRole = Comment["context"]["role"];

export function annoRoleFromPersona(
  persona: "new-mentor" | "mentor" | "lead-mentor" | "supervisor" | "admin"
): AnnoRole {
  switch (persona) {
    case "lead-mentor":
      return "lead_mentor";
    case "new-mentor":
      return "mentor";
    default:
      return persona;
  }
}

/** ═══ WHAT A CALLER SUPPLIES ═══
 *
 *  NOT a field addition to `Comment` — the opposite. It is the subset a caller is
 *  allowed to originate, which makes the store-owned fields (`id`, `number`,
 *  timestamps, `deletedAt`, `status`, `replies`) impossible to spoof from the
 *  client. `authorIpHint` is store-derived too: a client cannot see its own
 *  egress IP, and a client-supplied one would be a value the server has no reason
 *  to trust. */
export type NewComment = {
  authorClientId: string;
  body: string;
  anchor: Comment["anchor"];
  context: Comment["context"];
};

/** ═══ RESOLUTION TIER — IN MEMORY ONLY ═══
 *
 *  Appendix A: "computed at load, held in memory only, never persisted." So it
 *  is not on `Comment`, and this wrapper is how a loaded comment carries it
 *  without the field ever reaching the store.
 *
 *  1 = `elementRef` resolved · 2 = fell back to `structuralPath` · 3 = fell back
 *  to absolute coords. THE COMPUTATION LANDS IN anno-02 with anchoring — this
 *  phase defines the shape and deliberately does not guess the rules, because
 *  the tier is a statement about how a DOM lookup went and there is no DOM here. */
export type ResolutionTier = 1 | 2 | 3;

export type Hydrated<T> = T & { resolutionTier: ResolutionTier };

/** ═══ THE BODY LIMIT, IN ONE PLACE ═══ */
export const BODY_MAX = 1000;

/** Trimmed length, so 1000 spaces is not a valid comment. Returns the reason
 *  rather than a boolean — the UI has to say WHY, and a boolean would make it
 *  re-derive that. */
export function validateBody(body: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, reason: "A comment needs something in it." };
  if (body.length > BODY_MAX) {
    return {
      ok: false,
      reason: `A comment can be at most ${BODY_MAX} characters. This one is ${body.length}.`,
    };
  }
  return { ok: true };
}

/** ═══ R9: THE NAME IS RESOLVED, NEVER STORED ═══
 *
 *  Given the reviewer roster, what name does this comment show? Called at render,
 *  every render — which is what makes a rename retroactive with no migration and
 *  no write.
 *
 *  A reviewer who is not in the roster (their record has not synced yet, or was
 *  removed) falls back to a stable, non-accusatory placeholder. NOT "Anonymous"
 *  and NOT "User 3": the fallback names the situation, not the person. */
export function resolveDisplayName(
  authorClientId: string,
  reviewers: readonly Reviewer[]
): string {
  return (
    reviewers.find((r) => r.clientId === authorClientId)?.displayName ??
    "Unknown reviewer"
  );
}

export function resolveColorChip(
  authorClientId: string,
  reviewers: readonly Reviewer[]
): string | null {
  return reviewers.find((r) => r.clientId === authorClientId)?.colorChip ?? null;
}
