// RETIRED — the supervisor "Users" surface is gone.
//
// It was a second directory of the same people Team already lists: the mentors
// segment duplicated Team's staff table, and the teens segment duplicated
// /app/mentees (which is already supervisor-aware). Team became a table so it
// covers what this page did.
//
// Kept as a REDIRECT rather than deleted — the URL is bookmarked, and a 404 on
// a route that worked yesterday is worse than a hop. `?segment=teens` keeps its
// meaning and lands on Teens; anything else goes to Team.

import { redirect } from "next/navigation";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  // Accepts the retired "teens" segment as well as "mentees": this route only
  // exists to catch old links, so it must not start rejecting the exact spelling
  // those links carry.
  const toMentees = query.segment === "mentees" || query.segment === "teens";
  redirect(toMentees ? "/app/mentees" : "/app/team");
}
