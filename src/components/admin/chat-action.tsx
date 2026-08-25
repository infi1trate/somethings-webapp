"use client";

// ChatAction — the row's chat affordance. One button, no menu.
//
// This replaced ContactCell, a dropdown that held Chat · Call · Email · Copy
// number · Copy email. That put a teen's phone number one click from a directory
// row and spent a whole column doing it. Chat is the only thing in a row that's
// an ACTION; phone and email are data ABOUT the person and now live on their
// record (components/record/contact-actions.tsx).
//
// Renders nothing when canChatWith says no, so narrowing that rule later needs
// no edits here or at any call site.

import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { canChatWith, chatHrefFor } from "@/lib/record/chat";
import type { PersonRole } from "@/lib/record/people-demo";

export function ChatAction({
  personId,
  name,
  subjectRole,
  viewerRole,
  label = "Chat",
}: {
  personId: string;
  /** For the accessible name — "Chat with Omar Haddad". */
  name: string;
  subjectRole?: PersonRole;
  viewerRole?: PersonRole;
  /** VISIBLE LABEL ONLY; the accessible name always names the person. Defaults
   *  to the compact "Chat" the three table consumers use — the care task cards
   *  pass "Open chat", because in a card body with no column header the verb has
   *  to carry itself. Added as a prop rather than forking the component: a
   *  second tertiary button would drift from this one within a release. */
  label?: string;
}) {
  const router = useRouter();
  if (!canChatWith(viewerRole, subjectRole)) return null;

  return (
    <button
      type="button"
      onClick={() => router.push(chatHrefFor(personId))}
      aria-label={`Chat with ${name}`}
      className={
        // The ::after extends the touch target to 44px without changing the
        // compact visual — carried over from the control this replaced.
        "relative inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium " +
        "text-[var(--text-secondary)] transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] " +
        "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] " +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      }
    >
      <MessageSquare className="size-4" aria-hidden />
      {label}
    </button>
  );
}
