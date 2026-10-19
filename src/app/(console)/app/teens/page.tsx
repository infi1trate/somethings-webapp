// LEGACY REDIRECT — /app/teens → /app/mentees.
//
// The segment was renamed with the wording. This file exists so links that
// predate the rename still land: without it they fall through to the
// /app/[section] catch-all, which resolves a section by sidebar id, finds
// nothing (no item carries "teens" any more) and calls notFound(). A bookmark
// or a shared link would 404 rather than arrive.
//
// A server-side redirect, not a client one, so nothing renders first.

import { redirect } from "next/navigation";

export default function RetiredTeensRoute() {
  redirect("/app/mentees");
}
