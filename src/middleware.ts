// THE DEMO GATE — a shared password in front of the deployed prototype.
//
// ═══ WHAT THIS IS, AND WHAT IT IS NOT ═══
//
// It keeps the deployed link from being opened by anyone who happens to have the
// URL. It is NOT authentication: there is one shared password, no accounts, no
// per-person audit, and no rate limiting, so a determined guesser is not stopped
// by it. That is an acceptable trade for a no-PHI prototype and would not be for
// anything else. Nothing behind this gate should ever hold real patient data —
// which is already the standing rule for this codebase.
//
// ═══ WHY MIDDLEWARE, NOT A CLIENT-SIDE CHECK ═══
//
// A React gate that hides the app until a password matches would ship the
// password inside the client bundle, where anyone can read it out of the JS —
// and the "locked" pages would already have been sent to the browser. Middleware
// runs before the response is produced, so the password stays on the server and
// the gated routes are never delivered at all.
//
// ═══ THE COOKIE NEVER HOLDS THE PASSWORD ═══
//
// It holds a SHA-256 of the password plus a fixed namespace, computed with Web
// Crypto (available in the edge runtime). Middleware derives the same digest
// from the environment and compares. So a stolen cookie is still worth exactly
// as much as the shared password everyone already has, and the plaintext is not
// sitting in a jar for a screen-share to expose.
//
// ═══ DEVELOPMENT IS UNGATED, DELIBERATELY ═══
//
// The gate is a property of the DEPLOYMENT, not of the code. Gating `next dev`
// would put a password in front of every local page load and break the
// responsive/axe harness in `scripts/responsive/`, which drives 600+ page loads
// with no way to answer a form. To exercise the gate locally, build and serve a
// production bundle: `npm run build && npm start`.

import { NextResponse, type NextRequest } from "next/server";

/** Set `SITE_PASSWORD` in the Vercel project to change this without a deploy of
 *  new code. The literal is the fallback so the deployment is gated the moment
 *  this ships, rather than silently open until someone remembers to configure
 *  it — an unset secret that fails OPEN is the worse default. */
const PASSWORD = process.env.SITE_PASSWORD ?? "spreadjoy";

export const GATE_COOKIE = "sw_gate";

/** Digest of the password, namespaced so the value is meaningless anywhere else. */
export async function gateToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`somethings-demo-gate:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const presented = req.cookies.get(GATE_COOKIE)?.value;
  if (presented && presented === (await gateToken(PASSWORD))) {
    return NextResponse.next();
  }

  // ═══ NO RETURN PATH — UNLOCKING ALWAYS LANDS ON THE FRONT DOOR ═══
  //
  // An earlier version carried the requested path through as `next` and returned
  // there after unlocking. That is the conventional behaviour for a login, and it
  // is wrong for this prototype: the landing page is not a welcome screen, it is
  // the thing that ESTABLISHES a coherent demo state. Each of its three starting
  // points resets the store and sets a persona.
  //
  // Arriving straight at a deep link skips that. Someone who followed a
  // bookmarked `/app/mentees` would land on a staff route carrying whatever the
  // store happened to hold — or, on a first visit, no persona at all — and read a
  // half-configured app as the product. Landing on `/` costs one click and
  // guarantees the app is entered from a known state.
  //
  // IT ALSO REMOVES THE OPEN-REDIRECT SURFACE ENTIRELY. With no `next` parameter
  // there is no attacker-supplied destination to sanitise, which is a better
  // outcome than sanitising one correctly.
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the gate itself, its form target, and the static assets a
  // gate page needs in order to render at all.
  matcher: [
    "/((?!gate|api/gate|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
