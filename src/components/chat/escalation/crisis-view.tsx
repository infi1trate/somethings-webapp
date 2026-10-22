"use client";

// THE CRISIS VIEW — everything needed to get help to a teenager, in one place.
//
// ═══ A TAB NOW, NOT A DIALOG (pack v3.0, Supersession 5) ═══ It was a modal
// the banner and an in-panel red button both opened. The banner's "Emergency
// info" chip is the one entry now, and it opens the Care panel on its
// Emergency info tab, which renders `EmergencyInfoPanel` — this surface, with
// the same 911 primary first. Everything below still holds.
//
// ═══ THIS IS THE SURFACE THAT HAS TO WORK BADLY-LIT AND ONE-HANDED ═══
//
// It gets opened by a twenty-three-year-old who has just read something frightening
// and is deciding whether to call emergency services. Every decision here follows
// from that:
//
//  · CALL 911 IS THE PRIMARY, and it is a real `tel:` link rather than a button
//    that opens a confirmation. A confirmation on the one action that saves a life
//    is a step in the wrong place.
//  · EVERY NUMBER IS TAPPABLE, because a mentor reading digits off a screen and
//    typing them into a phone gets one wrong.
//  · NOTHING SCROLLS THAT DOES NOT HAVE TO. The address, the guardian and the 911
//    button are above any fold this dialog can produce.
//  · NO CONFIRMATION ON ANYTHING, and no destructive styling anywhere. There is
//    nothing here to undo.
//
// ═══ THE UNAVAILABLE STATES ARE DESIGNED, NOT ACCIDENTAL ═══
//
// `EmergencyInfo`'s fields are all nullable ON PURPOSE (see the type), because thin
// data is exactly what a crisis view meets — a teen four days into intake has a
// phone number and nothing else. So every row has a written absent state that says
// what to do instead, and the fresh-match scenario exists to keep those states in
// front of whoever reviews this.
//
// A row that renders "—" here would be a row that costs a mentor ten seconds
// working out whether the data is missing or the app is broken.

import { AlertTriangle, MapPin, Phone, Shield, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EmergencyInfo } from "@/lib/chat/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-DATA. The emergency number is hardcoded to the US, which is where this
 *  product operates today — and it is a constant rather than a literal so the day
 *  it has to vary by region there is one line to change. Logged as gap row 358. */
const EMERGENCY_NUMBER = "911";

/** A row of the crisis view: either a tappable value or a written absence. */
function InfoRow({
  glyph: Glyph,
  label,
  value,
  /** Present → the value becomes a link. */
  href,
  /** What to do when the value is missing. REQUIRED, not optional: a row with no
   *  absent copy is a row that renders a dash. */
  absent,
}: {
  glyph: LucideIcon;
  label: string;
  value: string | null;
  href?: string | null;
  absent: string;
}) {
  const has = !!value;
  return (
    <div className="flex items-start gap-3 border-b border-[color:var(--border-subtle)] py-3 last:border-b-0">
      <Glyph
        className={cn(
          "mt-0.5 size-4 shrink-0",
          has ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-[var(--text-muted)]"
          style={{
            font: "var(--type-field-label)",
            letterSpacing: "var(--type-field-label-tracking)",
          }}
        >
          {label}
        </p>
        {has ? (
          href ? (
            <a
              href={href}
              className={cn(
                "mt-0.5 inline-block rounded-sm text-[var(--text-primary)] underline decoration-[color:var(--border-contour)] underline-offset-2",
                "hover:decoration-[color:var(--text-primary)]",
                RING
              )}
              style={{ font: "var(--type-message)" }}
            >
              {value}
            </a>
          ) : (
            <p
              className="mt-0.5 text-[var(--text-primary)]"
              style={{ font: "var(--type-message)" }}
            >
              {value}
            </p>
          )
        ) : (
          /* ═══ THE WRITTEN ABSENCE ═══
             Says what to do instead. A dash would cost a mentor ten seconds working
             out whether the data is missing or the app is broken — ten seconds they
             do not have. */
          <p
            className="mt-0.5 text-[var(--text-secondary)]"
            style={{ font: "var(--type-body)" }}
          >
            {absent}
          </p>
        )}
      </div>
    </div>
  );
}

/** ═══ THE ROWS, ON THEIR OWN ═══ Also the Care tab's "Emergency info"
 *  sub-section, so the two cannot disagree about what is on file — and both
 *  show the same designed unavailable states, never a bare dash. */
function EmergencyInfoList({ info, theirName }: { info: EmergencyInfo; theirName: string }) {
  const i = info;
  return (
    <div data-emergency-info>
            <InfoRow
              glyph={Phone}
              /* TODO-COPY */
              label={`${theirName}'s phone`}
              value={i.teenPhone}
              href={i.teenPhone ? `tel:${i.teenPhone}` : null}
              absent="Not on file. Reach them in the conversation, and tell your supervisor."
            />
            <InfoRow
              glyph={User}
              label="Emergency contact"
              value={
                i.contact ? `${i.contact.name} · ${i.contact.relation}` : null
              }
              absent="Not on file yet — intake may not have finished. Your supervisor can reach the guardian."
            />
            {i.contact && (
              <InfoRow
                glyph={Phone}
                label={`${i.contact.name}'s phone`}
                value={i.contact.phone}
                href={`tel:${i.contact.phone}`}
                absent="Not on file."
              />
            )}
            <InfoRow
              glyph={MapPin}
              label="Address"
              value={i.address}
              absent="Not on file. Emergency services can trace the number; say so when you call."
            />
            <InfoRow
              glyph={Shield}
              /* TODO-COPY. "Last shared location", not "Live location" — the word
                 "live" would claim it is current, and it is a timestamped share
                 from whenever the teen last sent one. */
              label="Last shared location"
              value={i.liveLocation?.label ?? null}
              absent="Nothing shared. Ask where they are."
            />
              </div>
  );
}

/** ═══ THE EMERGENCY INFO TAB ═══ 911 first, the permission not to be
 *  certain, then what to read to the operator. A blocked constant: 911 is the
 *  primary here, in every tier, both lenses. */
export function EmergencyInfoPanel({ info, theirName }: { info: EmergencyInfo; theirName: string }) {
  return (
    <div data-slot="crisis-view" className="space-y-4">
      {/* ═══ 911 FIRST, AND IT IS A LINK ═══
          The primary action of the surface, at the top, before anything a
          mentor has to read. A `tel:` link rather than a button with a
          confirmation: a confirmation step on the one action that saves a life
          is a step in the wrong place, and on a phone this opens the dialer
          with the number already in it. */}
      <a
        href={`tel:${EMERGENCY_NUMBER}`}
        data-slot="call-emergency"
        className={cn(
          "flex min-h-12 w-full items-center justify-center gap-2 rounded-full",
          "bg-[var(--alert-critical-accent)] text-[var(--text-inverse)]",
          "transition-opacity hover:opacity-90",
          RING
        )}
        style={{ font: "var(--type-button)" }}
      >
        <Phone className="size-4 shrink-0" aria-hidden />
        {/* TODO-COPY. The number IS the label — "Get help" would make a mentor
            work out what happens when they press it. */}
        Call {EMERGENCY_NUMBER}
      </a>

      <p
        className="flex items-start gap-2 rounded-[var(--radius-inset)] bg-[var(--alert-critical-bg)] px-3 py-2.5 text-[var(--alert-critical-fg)]"
        style={{ font: "var(--type-body)" }}
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {/* TODO-COPY. REMOVES THE DECISION a mentor should not be making alone.
            The most common failure in a moment like this is a young mentor
            waiting to be sure enough, and this sentence is the permission not
            to be. */}
        <span>
          If you think they are in danger, call now. You do not need to be
          certain, and you will not be in trouble for calling.
        </span>
      </p>

      {/* ═══ "READ THIS TO THE OPERATOR" (Tiering & Escalation pack) ═══
          The rows below are what a 911 call asks for, in the order it asks;
          the heading says what they are FOR. */}
      <div>
        <h3 className="mb-1 text-[var(--text-muted)]" style={{ font: "var(--type-field-label)" }}>
          {/* TODO-COPY */}
          Read this to the operator · {theirName}
        </h3>
        <EmergencyInfoList info={info} theirName={theirName} />
      </div>
    </div>
  );
}
