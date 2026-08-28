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
// closed flags, so each starting point begins from the same seeded position
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

import { useState } from "react";
import { ArrowRight, MailOpen, Stethoscope, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DoodleScatter } from "@/components/doodles";
import { useOnboardingStore } from "@/lib/onboarding/store";
import type { Persona } from "@/lib/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

interface Entry {
  id: string;
  icon: typeof MailOpen;
  /** TODO-COPY */
  title: string;
  /** TODO-COPY — what you will actually be looking at, not a description of the
   *  role. A reader picking a door wants to know what is behind it. */
  blurb: string;
  persona: Persona;
  /** True for the mentor who is already onboarded: publish the profile so the
   *  app opens past the wizard and the hub. */
  published?: boolean;
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
    published: true,
    href: "/app",
  },
];

export default function Home() {
  /** Which entry is mid-navigation. The hard navigation takes a moment on a cold
   *  route, and a card that looks inert after a click invites a second one. */
  const [entering, setEntering] = useState<string | null>(null);

  const enter = (entry: Entry) => {
    setEntering(entry.id);
    // `getState()` rather than a subscription: nothing here reads store state
    // during render, so the page has no hydration surface at all.
    const s = useOnboardingStore.getState();
    s.reset();
    s.setPersona(entry.persona);
    if (entry.published) {
      s.setStatus("published");
      s.capturePublishedSnapshot();
    }
    window.location.assign(entry.href);
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#fff2ea] to-[#faf6ef] px-6 py-16">
      {/* ═══ ORNAMENT ONLY WHERE THERE IS A MARGIN TO ORNAMENT ═══
          MEASURED: every doodle in `SCATTER` is pinned to an edge (left 4-11%,
          right 5-10%), so they clear a centred 576px column only once the margins
          exceed their ~210px reach — about a 1024px viewport. Below that the
          column reaches into them, and `--text-secondary` over a doodle at 70%
          measures 3.09:1 on tangelo, 2.62:1 on purple: 5 of the 6 colours fail
          AA for the lead paragraph. The h1 survives everywhere (5.71 worst).

          So they are hidden below `lg` rather than dimmed. On a phone there is no
          margin to decorate, and reducing opacity would trade a legibility
          failure for a weaker one instead of removing it.

          NOT the `hidden lg:` anti-pattern Phase 4 removed six of — that was
          CONTENT disappearing at a breakpoint. This is `aria-hidden` decoration,
          and its absence costs a reader nothing. */}
      <DoodleScatter className="hidden opacity-70 lg:block" />

      <div className="relative w-full max-w-xl">
        <header className="flex flex-col items-center text-center">
          <Wordmark className="h-6" />
          <h1 className="mt-6 text-[26px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--text-primary)] sm:text-[30px]">
            {/* TODO-COPY */}
            The platform, cloned for demos
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-[1.55] text-[var(--text-secondary)]">
            {/* TODO-COPY — says what it IS and what it is not, in that order. The
                second half is the part a viewer needs before they click. */}
            A near-complete working copy of Somethings — the mentor app, the staff
            console, and the teen record with its care documentation. Every person,
            message and survey in it is fixture data.
          </p>
        </header>

        {/* ── INTERNAL ONLY ──────────────────────────────────────────────────
            Tonal, no left accent bar, no icon-plus-shout. This is a real
            constraint, so it speaks rather than whispers — but it is a statement
            of scope, not an alarm, so it gets the attention tone and one line.
            `--status-attention-*` is the design system's own pair: 5.07:1 light,
            10.39:1 dark, measured. */}
        <p className="mx-auto mt-6 w-fit rounded-full bg-[var(--status-attention-bg)] px-3.5 py-1.5 text-center text-[13px] font-medium leading-[18px] text-[var(--status-attention-fg)]">
          {/* TODO-COPY */}
          Internal use only. No real people, and no PHI.
        </p>

        {/* ── ENTRY SCENARIOS ────────────────────────────────────────────────
            THREE EQUAL DOORS, SO NONE IS FILLED. The house rule is one filled
            button per region; three filled cards would also be three primaries,
            which is the same mistake twice. Each is a card-weight surface with a
            chevron, and the hierarchy comes from order and from the label above
            them rather than from colour. */}
        <h2 className="mt-10 text-center text-[var(--text-muted)] [font:var(--type-field-label)] [letter-spacing:var(--type-field-label-tracking)]">
          {/* TODO-COPY */}
          Pick a starting point
        </h2>

        <ul className="mt-3 space-y-2.5">
          {ENTRIES.map((entry) => {
            const Icon = entry.icon;
            const busy = entering === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => enter(entry)}
                  disabled={entering !== null}
                  aria-busy={busy || undefined}
                  className={cn(
                    "group flex w-full items-start gap-3.5 rounded-[var(--radius-surface)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-4 py-4 text-left transition-colors",
                    "hover:bg-[var(--tint-hover)] disabled:cursor-default",
                    // Only the card being entered stays at full strength; the
                    // others recede so the click that landed is legible.
                    entering !== null && !busy && "opacity-55",
                    RING
                  )}
                >
                  <Icon
                    className="mt-0.5 size-[18px] shrink-0 text-[var(--text-muted)]"
                    aria-hidden
                    strokeWidth={2}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-[21px] text-[var(--text-primary)]">
                      {entry.title}
                    </span>
                    <span className="mt-1 block text-[13.5px] leading-[19px] text-[var(--text-secondary)]">
                      {entry.blurb}
                    </span>
                  </span>
                  <ArrowRight
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-[var(--text-muted)] transition-transform",
                      "group-hover:translate-x-0.5"
                    )}
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-7 text-center text-[12.5px] leading-[18px] text-[var(--text-muted)]">
          {/* TODO-COPY — two facts a first-time viewer needs and would otherwise
              discover by accident: the state is wiped, and they are not locked
              into the door they chose. */}
          Each starting point resets the demo data. The DEV bar at the bottom of
          every screen switches role and scenario at any time.
        </p>
      </div>
    </main>
  );
}
