// THE GATE'S FORM TARGET.
//
// A plain form POST, not fetch: the gate page ships no JavaScript, so unlocking
// works before hydration and in any browser. The response is a 303 redirect,
// which is what turns the POST into a GET so a refresh afterwards does not
// re-submit the password.
//
// THE PASSWORD IS NEVER LOGGED, and never echoed back into the redirect. A wrong
// attempt returns `?error=1` and nothing else — a URL carrying the attempted
// value would end up in browser history and in any proxy log.

import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/middleware";

const PASSWORD = process.env.SITE_PASSWORD ?? "spreadjoy";

/** Where the user asked to go, reduced to something safe to redirect to.
 *
 *  ONLY A PATH ON THIS ORIGIN. `//evil.example` and `https://evil.example` are
 *  both valid values of a `next` query param and both would make this an open
 *  redirect, which is the standard way a login form becomes a phishing tool. */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  return raw;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const submitted = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "") || null);

  if (submitted !== PASSWORD) {
    const back = new URL("/gate", req.url);
    back.searchParams.set("error", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(GATE_COOKIE, await gateToken(PASSWORD), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    // Long enough that a demo session is never interrupted mid-walkthrough, and
    // short enough that a borrowed laptop does not stay unlocked forever.
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
