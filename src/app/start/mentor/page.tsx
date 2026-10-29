"use client";

// ═══════════════════════════════════════════════════════════════════════════
// /start/mentor — THE MENTOR LENS'S FRONT DOOR (2026-10-29)
//
// Where the dev bar's Mentor button lands: the landing's anatomy
// (`StartScreen`) with two doors — sign in as the existing mentor, or reset
// and start over as a new one. The rules are `lib/dev/mentor-entry.ts`.
//
// EXISTING FIRST: it is the common move (a reviewer checking the mentor's
// side of what they just did as a supervisor), and it keeps the session.
// NEW SECOND: the one door that wipes, and it says so on the card.
//
// `?from=` is where the reader was — a same-origin path only (`safeFrom`). It
// is read in the click handler, never in render, so the page has no
// hydration surface and needs no Suspense boundary.

import { MailOpen, UserRound } from "lucide-react";
import { StartScreen } from "@/components/start/start-screen";
import { enterAsExistingMentor, resetToNewMentor, safeFrom } from "@/lib/dev/mentor-entry";

const from = () => (typeof window === "undefined" ? null : safeFrom(new URLSearchParams(window.location.search).get("from")));

export default function MentorStart() {
  return (
    <StartScreen
      /* TODO-COPY */
      title="Switch to the mentor app"
      /* TODO-COPY */
      lead="Sign in as the mentor who is already onboarded, or reset and walk the setup flow as a brand-new mentor."
      /* TODO-COPY */
      label="Pick a mentor"
      entries={[
        {
          id: "existing-mentor",
          icon: UserRound,
          /* TODO-COPY */
          title: "Sign in as an existing mentor",
          blurb: "The mentor app as someone already onboarded sees it — their mentees, chats, tasks and their own profile. Keeps this session's data.",
          enter: () => enterAsExistingMentor(from()),
        },
        {
          id: "new-mentor",
          icon: MailOpen,
          /* TODO-COPY */
          title: "Start as a new mentor",
          blurb: "Resets the demo data and opens a demo invite — the whole setup flow, from the email link through review to a published profile.",
          enter: resetToNewMentor,
        },
      ]}
      /* TODO-COPY — the one fact that differs between the doors. */
      footnote="Signing in as the existing mentor keeps this session's data. Starting as a new mentor resets it."
      after={
        <p className="mt-3 text-center">
          <button
            type="button"
            data-start-back
            onClick={() => {
              const back = from();
              if (back) window.location.assign(back);
              else window.history.back();
            }}
            className="inline-flex min-h-9 items-center rounded-full px-3 text-[13px] leading-[18px] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            {/* TODO-COPY */}← Back without switching
          </button>
        </p>
      }
    />
  );
}
