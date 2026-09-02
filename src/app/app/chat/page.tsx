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
import { redirect } from "next/navigation";
import { chatThreadHref } from "@/lib/record/chat";
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

  /* ═══ `?with=` IS HONOURED BY REDIRECT, NOT BY RENDERING ═══
   *
   *  The thread moved to `/app/chat/[personId]`, and `chatHrefFor` moved with
   *  it — but links produced before that are in browser histories, bookmarks and
   *  anything already rendered. Rendering the thread here instead would keep
   *  them working and quietly re-create the defect: two URLs for one view, only
   *  one of which the shell can recognise as a detail route.
   *
   *  So this redirects rather than serves. `redirect()` throws, so nothing below
   *  it runs, and the resulting entry REPLACES the query URL in history — a back
   *  press from the thread returns to wherever the reader came from rather than
   *  bouncing through the redirect again. */
  if (withId) redirect(chatThreadHref(withId));

  return (
    <MentorShell
      active={NAV.chat.id}
      /* ═══ THE LIST RUNS UNDER THE BAR, SO IT RESERVES ITS OWN ROOM ═══
       *
       *  The panel's default `padding-bottom: var(--nav-reserve)` ended this
       *  route's content exactly at the bar's top edge — measured at 390×844:
       *  scroller bottom 700, bar top 700. A list that stops dead at a solid
       *  band reads as the end of the list, and it spends a full row's height
       *  on a gap. Handing the reservation to the list's own scroller lets the
       *  rows scroll *beneath* the translucent bar while the last one still
       *  clears it. See `conversation-list.tsx`, which is where both halves of
       *  the reservation now live. */
      bottomInset="surface"
    >
      {/* `null` — this route IS the list. Below `md` that is the only pane on
          screen; at `md` and up the thread pane still renders beside it, showing
          the scenario's focus conversation until a row is chosen. */}
      <ChatPage personId={null} />
    </MentorShell>
  );
}
