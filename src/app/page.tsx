"use client";

// THE PROTOTYPE'S FRONT DOOR.
//
// ═══ WHY THIS STOPPED BEING "MENTOR ONBOARDING" ═══
//
// It said "Mentor onboarding — prototype" and offered one link, because that was
// once the whole of it. It is now close to a full clone of the platform — the
// mentor app, the staff console, the teen record and its care documentation — so
// a title naming one flow told a first-time reader the wrong thing about what
// they were looking at, and offered no way into the two halves that are not
// onboarding.
//
// ═══ EVERY ENTRY RESETS THE DEMO STATE, DELIBERATELY ═══
//
// `reset()` wipes the store, restores the pending care reviews and reopens the
// closed flags — and returns the live mentor to the POPULATED default; only
// "Start as a new mentor" blanks it (`resetAsNewMentor`) — so each starting
// point begins from the same seeded position
// rather than from wherever the last session was abandoned. That is what makes
// these repeatable enough to demo from. It is stated on the page rather than
// left as a surprise.
//
// `persona` deliberately survives `reset()` ("a dev lens, not data" — see the
// store), so each scenario sets it explicitly afterwards.
//
// ═══ ONE HARD NAVIGATION PER ENTRY ═══
//
// `window.location.assign`, not the router: a wiped-and-rewritten store has to
// rehydrate from scratch, and a client-side push would race `persist` flushing
// the old state over the new. The dev bar's own reset does the same thing for
// the same reason, and Phases 4 and 6 measured that race.

// ═══ THE SCREEN IS SHARED (2026-10-29) ═══ The shell and the doors are
// `components/start/start-screen.tsx`, so the mentor chooser (`/start/mentor`)
// renders this same anatomy with its own two doors.

import { MailOpen, Stethoscope, UserRound, type LucideIcon } from "lucide-react";
import { StartScreen } from "@/components/start/start-screen";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { Persona } from "@/lib/types";

interface Entry {
  id: string;
  icon: LucideIcon;
  /** TODO-COPY */
  title: string;
  /** TODO-COPY — what you will actually be looking at, not a description of the
   *  role. A reader picking a door wants to know what is behind it. */
  blurb: string;
  persona: Persona;
  /** True for the new-mentor door: the ONE entry that blanks the mentor
   *  (`resetAsNewMentor`). Every other entry resets to the populated mentor. */
  asNew?: boolean;
  href: string;
}

const ENTRIES: Entry[] = [
  {
    id: "new-mentor",
    icon: MailOpen,
    title: "Start as a new mentor",
    blurb:
      "Open a demo invite and walk the whole setup flow, from the email link through review to a published profile.",
    persona: "new-mentor",
    asNew: true,
    href: "/invite/demo-invite-token",
  },
  {
    id: "supervisor",
    icon: Stethoscope,
    title: "Sign in as a supervisor",
    blurb:
      "The staff console — caseload, teen records, care documentation and the review queues. Opens on the mentee roster.",
    persona: "supervisor",
    // NOT `/app/home`: that route is still a placeholder and reads as an empty
    // product. The roster is populated and every other staff surface is one
    // click from it, so it is the honest front page for this scenario.
    href: "/app/mentees",
  },
  {
    id: "mentor",
    icon: UserRound,
    title: "Sign in as an existing mentor",
    blurb:
      "The mentor app as someone already onboarded sees it — their mentees, chats, tasks and their own profile.",
    persona: "mentor",
    href: "/app",
  },
];

const enter = (entry: Entry) => {
  // `getState()` rather than a subscription: nothing here reads store state
  // during render, so the page has no hydration surface at all.
  const s = useOnboardingStore.getState();
  /* `reset()` returns the populated mentor (2026-10-26); only the new-mentor
     door starts over as new. */
  if (entry.asNew) s.resetAsNewMentor();
  else s.reset();
  s.setPersona(entry.persona);
  window.location.assign(entry.href);
};

export default function Home() {
  return (
    <StartScreen
      /* TODO-COPY */
      title="The platform, cloned for demos"
      /* TODO-COPY — says what it IS and what it is not, in that order. */
      lead="A near-complete working copy of Somethings — the mentor app, the staff console, and the teen record with its care documentation. Every person, message and survey in it is fixture data."
      notice={
        /* ── INTERNAL ONLY ── Tonal, one line: a statement of scope, not an
           alarm. `--status-attention-*` is the design system's own pair:
           5.07:1 light, 10.39:1 dark, measured. */
        <p className="mx-auto mt-6 w-fit rounded-full bg-[var(--status-attention-bg)] px-3.5 py-1.5 text-center text-[13px] font-medium leading-[18px] text-[var(--status-attention-fg)]">
          {/* TODO-COPY */}
          Internal use only. No real people, and no PHI.
        </p>
      }
      /* TODO-COPY */
      label="Pick a starting point"
      entries={ENTRIES.map((e) => ({ id: e.id, icon: e.icon, title: e.title, blurb: e.blurb, enter: () => enter(e) }))}
      /* TODO-COPY — the state is wiped, and they are not locked into a door. */
      footnote="Each starting point resets the demo data. The DEV bar at the bottom of every screen switches role and scenario at any time."
    />
  );
}
