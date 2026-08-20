"use client";

// TEAM BAND — who holds this mentor up. A slim full-width strip of person chips
// above the mentee table.
//
// WAS A PAIRED CARD beside a "Practice" card (caseload · availability · mode).
// Practice is gone from this page by product decision — capacity config isn't
// something you reach for while reading a caseload — and with it the reason for
// two half-width columns. A two-person card holding half the width was mostly
// empty space; horizontal chips give the same facts a single quiet line and hand
// the full width to the mentees, which is the work.
//
// Chips route to the person's record, so each is a real target with a chevron.
// The whole band is ONE row at every breakpoint until it needs to wrap.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { recordHrefFor } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export interface NetworkPerson {
  id: string;
  name: string;
  roleLabel: string;
  /** False when no record exists — the chip renders flat, without a chevron. */
  hasRecord?: boolean;
}

function initial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

/** One person, as a chip: initial · name · role · chevron. */
function Chip({ person }: { person: NetworkPerson }) {
  const body = (
    <>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--status-neutral-bg)] text-[12px] font-semibold text-[var(--text-primary)]"
      >
        {initial(person.name)}
      </span>
      <span className="min-w-0 truncate text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
        {person.name}
      </span>
      <span
        className="shrink-0 text-[var(--text-secondary)]"
        style={{ font: "var(--type-row-label)" }}
      >
        {person.roleLabel}
      </span>
    </>
  );

  if (person.hasRecord === false) {
    return (
      <span className="flex min-h-11 items-center gap-2 pr-2">{body}</span>
    );
  }
  return (
    <Link
      href={recordHrefFor(person.id)}
      aria-label={`${person.name} — open`}
      className={cn(
        "-mx-2 flex min-h-11 items-center gap-2 rounded-full px-2 transition-colors",
        "hover:bg-[var(--tint-hover)]",
        RING
      )}
    >
      {body}
      <ChevronRight
        className="size-3.5 shrink-0 text-[var(--text-muted)]"
        aria-hidden
      />
    </Link>
  );
}

export function CareNetwork({ team }: { team: NetworkPerson[] }) {
  if (team.length === 0) return null;
  return (
    <section aria-label="Team" data-record-section="team">
      <h2 className="font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)]">
        Team
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-1 rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] bg-[var(--surface-card)] px-5 py-1.5">
        {team.map((p) => (
          <Chip key={p.id} person={p} />
        ))}
      </div>
    </section>
  );
}
