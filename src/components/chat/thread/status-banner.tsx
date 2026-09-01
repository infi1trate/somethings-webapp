"use client";

// A PINNED FACT ABOUT THE WHOLE CONVERSATION.
//
// ═══ NOT ESCALATION-SHAPED, THOUGH ESCALATION IS ITS FIRST TENANT ═══
//
// The API is tone, title, meta and actions. Nothing about it knows what an
// escalation is — because "a thread-level state that stays visible until somebody
// resolves it" is a general shape, and the next one (a pause, a re-match in
// progress, a consent withdrawal) should not need a second component that starts
// identical.
//
// ═══ IT IS PINNED, NOT STICKY, AND THAT IS THE POINT ═══
//
// It sits in the thread's grid as its own row, above the transcript. A sticky
// banner scrolls with the conversation and can be scrolled away from; this one
// cannot be, because the state it reports does not stop being true when a mentor
// scrolls. An escalation a mentor has scrolled past is an escalation they have
// forgotten.
//
// ═══ THE META LINE IS A TIMESTAMPED FACT, NOT A TOAST ═══
//
// "Supervisor notified 4:12 PM". A toast tells a mentor once, at the moment they
// are least able to take it in, and then removes the evidence. The mentor who
// raised this needs to be able to check — an hour later, after a navigation, in
// the middle of a phone call — that somebody knows. So it is on the banner, with
// the time, for as long as the state lasts.

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type BannerTone = "critical" | "attention" | "neutral";

/** ═══ TONES FROM EXISTING SEMANTIC TOKENS ═══
 *
 *  `critical` is `--alert-critical-*`, which is the loudest pair in the system and
 *  is reserved for exactly this: a live state that needs somebody to act. Note that
 *  the escalation EVENT CHIP uses `--band-clay-*` instead — history should not
 *  shout, and the difference between "this is happening" and "this happened" is
 *  worth a whole step of loudness.
 *
 *  Each tone carries a border as well as a fill, because a banner distinguished
 *  only by a pale tint is a banner that disappears against the card it sits on. */
const TONE: Record<BannerTone, string> = {
  critical:
    "border-[color:var(--alert-critical-border)] bg-[var(--alert-critical-bg)] text-[var(--alert-critical-fg)]",
  attention:
    "border-[color:var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-fg)]",
  neutral:
    "border-[color:var(--border-subtle)] bg-[var(--surface-s1)] text-[var(--text-secondary)]",
};

const ACCENT: Record<BannerTone, string> = {
  critical: "text-[var(--alert-critical-accent)]",
  attention: "text-[var(--alert-warning-accent)]",
  neutral: "text-[var(--text-muted)]",
};

/** ═══ THE PRIMARY BUTTON'S FILL, PER TONE, AS EXPLICIT TOKENS ═══
 *
 *  The first version used `bg-current text-[var(--surface-card)]`, reasoning that
 *  `currentColor` inside the banner would be the banner's foreground. It is not:
 *  `text-*` on the SAME element changes `color` first, so `currentColor` resolved
 *  to the button's own text colour and the button rendered as a white box with
 *  white text — invisible, and the primary action on an escalation banner.
 *  MEASURED FROM A SCREENSHOT, where it was a blank pill.
 *
 *  Explicit pairs instead. `--alert-*-accent` is the saturated step of each family
 *  and `--text-inverse` flips with the theme, so the pair holds in both modes
 *  without a second rule. */
const PRIMARY: Record<BannerTone, string> = {
  critical: "bg-[var(--alert-critical-accent)] text-[var(--text-inverse)]",
  attention: "bg-[var(--alert-warning-accent)] text-[var(--text-inverse)]",
  neutral: "bg-[var(--text-primary)] text-[var(--text-inverse)]",
};

export function StatusBanner({
  tone,
  glyph: Glyph,
  title,
  /** The timestamped fact — see the module note. */
  meta,
  /** Buttons, in the order a reader should consider them. The FIRST is the primary
   *  and the component does not restyle it: what "primary" means differs per state,
   *  and a banner that decided would be wrong for the second tenant. */
  children,
}: {
  tone: BannerTone;
  glyph: LucideIcon;
  title: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="status-banner"
      data-tone={tone}
      /* `role="status"`, NOT `role="alert"`. An alert interrupts a screen reader
         mid-sentence, which is right for something that just happened and wrong
         for a persistent state — this banner is present on every render of the
         thread, and an alert would re-interrupt on each one. The moment it appears
         is announced by the action that created it. */
      role="status"
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5",
        TONE[tone]
      )}
    >
      <Glyph className={cn("size-4 shrink-0", ACCENT[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p style={{ font: "var(--type-card-title)" }}>{title}</p>
        {meta && (
          <p className="mt-0.5 opacity-90" style={{ font: "var(--type-field-label)" }}>
            {meta}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div>
      )}
    </div>
  );
}

/** ═══ THE BANNER'S OWN BUTTON ═══
 *
 *  Inside a tinted banner, a button has to read against the tint rather than
 *  against the card — so it borrows the banner's own foreground for its border and
 *  its text, and the primary fills with it. Using the app's default button here
 *  produced a near-black pill on a pale red field, which read as a foreign object
 *  dropped onto the banner. */
export function BannerButton({
  tone,
  primary,
  onClick,
  children,
  ...rest
}: {
  /** Needed for the primary's fill — see `PRIMARY` on why it cannot be derived
   *  from `currentColor`. */
  tone: BannerTone;
  primary?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "children">) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 transition-opacity",
        primary
          ? cn(PRIMARY[tone], "hover:opacity-90")
          : // A SECONDARY CAN use `current`, because it does not also set `color` —
            // it inherits the banner's foreground, which is what the border and the
            // hover wash are derived from.
            "border border-current/30 hover:bg-current/10",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      )}
      style={{ font: "var(--type-body)" }}
      {...rest}
    >
      {children}
    </button>
  );
}
