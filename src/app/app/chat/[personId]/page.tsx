"use client";

// /app/chat/[personId] — ONE CONVERSATION.
//
// ═══ WHY THIS IS A ROUTE AND NOT A PIECE OF STATE ═══
//
// The thread used to be a `useState<"list" | "thread">` toggle on the list route.
// Everything that makes a detail view feel native came from the URL, and with no
// URL none of it existed: no browser back, no Android back gesture, no iOS
// swipe-back, no scroll restoration, nothing to bookmark, and no signal the app
// shell could read to hide the bottom bar — so the bar appeared and vanished
// with no navigation to account for it.
//
// A segment gives all of that for free, and it is the same list-vs-detail shape
// the record surfaces use, so it is the platform's drill-in vocabulary rather
// than a chat-only trick.
//
// ═══ THE SEGMENT IS A PERSON ID, WHICH IS ALSO THE THREAD ID ═══
//
// See `lib/chat/types.ts`: a thread IS a person, so there is no thread entity to
// name and no second id to map. `?with=<id>` carried exactly this value, which is
// why the old deep links redirect cleanly onto it.
//
// ═══ STANDING NEXT-16 RULES ═══
//
// No page-root `<Suspense>`. `use(params)` as a PROP rather than `useParams`.
// Every store read sits behind `useMounted`, inside `ChatPage`.

import { use } from "react";
import { AppChrome } from "@/components/app-shell/app-chrome";
import { ChatPage } from "@/components/chat/chat-page";
import { NAV } from "@/components/settings/nav-items";

export default function ChatThreadRoute({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = use(params);

  return (
    <AppChrome active={NAV.chat.id}>
      {/* AN UNKNOWN ID IS NOT A 404. `ChatPage` falls back to the first thread
          and the list is still beside it at `md` and up — a person whose link
          has gone stale should land somewhere usable rather than on an error
          page for a conversation that simply moved. */}
      <ChatPage personId={decodeURIComponent(personId)} />
    </AppChrome>
  );
}
