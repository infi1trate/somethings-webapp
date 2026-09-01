"use client";

// /app/chat — THE MENTOR CHAT.
//
// ═══ THIS ROUTE CLAIMS A URL THAT WAS ALREADY IN USE ═══
//
// `chatHrefFor(personId)` in `lib/record/chat.ts` has produced
// `/app/chat?with=<personId>` since the record tables grew a Chat action, and until
// now it landed on the `/app/[section]` placeholder, which named the person and
// said messaging was not built yet.
//
// A STATIC SEGMENT BEATS A DYNAMIC ONE in Next's matcher, which is exactly how
// `/app/profile` already takes precedence over the same catch-all. So this file
// takes over the URL and NO CALL SITE CHANGES — every Chat action in every table
// now deep-links into a real thread, and the placeholder keeps serving the other
// unbuilt sections.
//
// The `?with=` contract is honoured verbatim: the id it carries is a person id,
// which IS the thread id (see `lib/chat/types.ts` on why there is no thread
// entity).
//
// ═══ STANDING NEXT-16 RULES ═══
//
// No page-root `<Suspense>`. The `use(searchParams)` PROP pattern rather than
// `useSearchParams`. Every store read behind `useMounted` — which happens inside
// `ChatPage`, where the store is actually read.
//
// ═══ THE SHELL IS THE MENTOR'S ═══
//
// Chat is a mentor surface. Staff personas reach it too (the nav gives every
// persona a Chats destination), and they get the same conversation list — a
// supervisor's own Support threads are the leads they oversee. The shell is
// `MentorShell` rather than branching per persona, because unlike Home there is
// nothing persona-specific about the chrome here: `AdminShell` and `MentorShell`
// render the same rail from the same `nav-items.ts` source.

import { use } from "react";
import { MentorShell } from "@/components/mentor/mentor-shell";
import { ChatPage } from "@/components/chat/chat-page";
import { NAV } from "@/components/settings/nav-items";

export default function ChatRoute({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = use(searchParams);
  // A repeated `?with=` gives an array; take nothing rather than the first, since
  // two people in one deep link is a malformed link and guessing which one was
  // meant is worse than opening the default thread.
  const withId = typeof query.with === "string" ? query.with : null;

  return (
    <MentorShell active={NAV.chat.id}>
      <ChatPage withId={withId} />
    </MentorShell>
  );
}
