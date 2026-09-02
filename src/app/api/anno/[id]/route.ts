// THE ANNOTATION API — single-comment endpoints.
//
// PATCH updates. DELETE soft-deletes. POST restores.
//
// ═══ WHY RESTORE IS A POST AND NOT A `PATCH { deletedAt: null }` ═══
//
// `deletedAt` is not in the patchable surface (see `repo.ts`) — a client cannot
// set or clear it directly, because "delete" and "undelete" are operations with
// their own meaning, not field writes. Making restore its own verb means the
// store can never be put into a half-deleted state by a patch that happens to
// include a stale timestamp.

import { NextResponse, type NextRequest } from "next/server";
import {
  RepoError,
  restoreComment,
  softDeleteComment,
  updateComment,
} from "@/lib/anno/server/repo";

export const dynamic = "force-dynamic";

function fail(e: unknown): NextResponse {
  if (e instanceof RepoError) {
    return NextResponse.json(
      { error: e.kind, message: e.message },
      { status: e.kind === "not-found" ? 404 : 400 }
    );
  }
  console.error("[anno] unhandled", e);
  return NextResponse.json({ error: "server", message: "Store error." }, { status: 500 });
}

/** Next 16 hands route params as a promise — see the App Router guide. Awaited
 *  rather than destructured, which the previous major allowed and this one does
 *  not. */
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const patch = await req.json().catch(() => null);
    if (!patch || typeof patch !== "object") {
      return NextResponse.json(
        { error: "invalid", message: "Expected a patch object." },
        { status: 400 }
      );
    }
    return NextResponse.json({ comment: await updateComment(id, patch) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    /* Returns the soft-deleted comment rather than 204. The client's optimistic
       cache needs the new `deletedAt`/`updatedAt` to reconcile, and a bare 204
       would force an immediate re-list to get them. */
    return NextResponse.json({ comment: await softDeleteComment(id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ comment: await restoreComment(id) });
  } catch (e) {
    return fail(e);
  }
}
