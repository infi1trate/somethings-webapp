// THE ANNOTATION API — collection endpoints.
//
// Thin. Every rule lives in `lib/anno/server/repo.ts`; this file is HTTP shape
// only: parse, delegate, map an error to a status.
//
// ═══ THIS ROUTE IS BEHIND THE DEMO GATE, AND THAT IS CORRECT ═══
//
// `middleware.ts`'s matcher excludes only `gate` and `api/gate`, so `/api/anno`
// requires the gate cookie in production. A browser sends it automatically, so
// nothing extra is needed client-side — and it means annotation is reachable by
// exactly the people who can already see the prototype. Note the ceiling
// honestly: the gate is ONE SHARED PASSWORD and explicitly "NOT authentication",
// so this is not per-person authorisation and `authorClientId` is not a
// credential. Anyone through the gate can write as anyone. Acceptable for a
// no-PHI prototype review; not acceptable for anything else.
//
// ═══ ALWAYS DYNAMIC ═══
//
// Comments change between requests by definition, so nothing here may be
// statically rendered or cached at the route level.

import { NextResponse, type NextRequest } from "next/server";
import {
  RepoError,
  createComment,
  ipHintFrom,
  listComments,
  listReviewers,
  upsertReviewer,
} from "@/lib/anno/server/repo";
import { driverKind } from "@/lib/anno/server/kv";

export const dynamic = "force-dynamic";

/** One place that turns a repo failure into a status + a renderable body. The
 *  client adapter maps the status back to an `AnnoErrorCode`, so the two ends
 *  agree without sharing a class across the network boundary. */
function fail(e: unknown): NextResponse {
  if (e instanceof RepoError) {
    return NextResponse.json(
      { error: e.kind, message: e.message },
      { status: e.kind === "not-found" ? 404 : 400 }
    );
  }
  // Never leak an internal message to the client; the server log keeps it.
  console.error("[anno] unhandled", e);
  return NextResponse.json({ error: "server", message: "Store error." }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    // `?reviewers=1` rather than a second route file — one collection, two
    // projections, and it keeps the client adapter to a single base URL.
    if (req.nextUrl.searchParams.get("reviewers") === "1") {
      return NextResponse.json({ reviewers: await listReviewers() });
    }
    return NextResponse.json({
      comments: await listComments(),
      /* Surfaced so the client's `reachable`/`kind` reporting is a FACT from the
         server rather than an assumption. `file` means single-server-only —
         see GAPS.md (anno-01). */
      driver: driverKind(),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    if (body && typeof body === "object" && "reviewer" in body) {
      return NextResponse.json(
        { reviewer: await upsertReviewer((body as { reviewer: unknown }).reviewer) },
        { status: 200 }
      );
    }

    /* THE IP HINT IS TAKEN HERE AND ONLY HERE. It is read off the request
       headers — a value the client cannot supply and cannot forge from the
       browser — and handed to the repo, which stores it and never queries it. */
    const comment = await createComment(body, ipHintFrom(req.headers));
    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
