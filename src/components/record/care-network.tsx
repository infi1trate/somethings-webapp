"use client";

// TEAM — who holds this mentor up. A paired-card grid under the section heading.
//
// WAS a full-width horizontal band of two inline chips. The band read as one
// object containing two names; these are two PEOPLE, each with their own record,
// so each gets its own card and its own target. The heading stays, which keeps
// the heading+card rhythm matching "Mentees" below it.
//
// Two equal columns from lg up, ONE column below — the same
// `grid-cols-1 … lg:grid-cols-2` collapse every other two-column surface in the
// app uses, so narrow widths behave the way the rest of the product does.
//
// STRUCTURAL FUTURE-PROOFING ONLY: the grid maps the team array, so a third
// member yields a third tile and wraps to a second row. No UI for adding or
// removing members — that isn't a thing this page does.
//
// Tokens: card tone + --border-contour + --radius-surface (16px, standing in for
// the specced 15px rather than minting a token for a 1px difference), name on
// --type-row-value (an exact 15px match), caption on --type-row-label (13px,
// standing in for 12.5px). Hover/focus reuse PersonRow's tokens — --surface-s1
// tint and --focus-ring — though not its inset-span geometry: that exists to
// inset a row from its card's padding, and a standalone card has none.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { avatarTintFor } from "@/components/record/person-row";
import { recordHrefFor } from "@/lib/record/subject";
import { cn } from "@/lib/utils";

export interface NetworkPerson {
  id: string;
  name: string;
  roleLabel: string;
  /** False when no record exists — the card renders flat, without a chevron. */
  hasRecord?: boolean;
}

/** First + last initial — a 40px avatar has room for both, and it matches the
 *  record header's own avatar treatment. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const CARD =
  "flex items-center gap-[13px] rounded-[var(--radius-surface)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-4";

function TeamCard({ person }: { person: NetworkPerson }) {
  const tint = avatarTintFor(person.name);
  const body = (
    <>
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        {initials(person.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[var(--text-primary)]"
          style={{ font: "var(--type-row-value)" }}
        >
          {person.name}
        </span>
        <span
          className="mt-px block truncate text-[var(--text-muted)]"
          style={{ font: "var(--type-row-label)" }}
        >
          {person.roleLabel}
        </span>
      </span>
    </>
  );

  if (person.hasRecord === false) {
    return <div className={CARD}>{body}</div>;
  }

  return (
    <Link
      href={recordHrefFor(person.id)}
      aria-label={`${person.name} — open`}
      className={cn(
        CARD,
        // The whole card is the target. Hover/focus tint the card itself rather
        // than an inset span — same tokens as the pressable rows, applied to the
        // surface that IS the row here.
        "transition-colors hover:bg-[var(--surface-s1)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
      )}
    >
      {body}
      <ChevronRight
        className="size-3.5 shrink-0 self-center text-[var(--text-muted)]"
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
      <div className="mt-3 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {team.map((p) => (
          <TeamCard key={p.id} person={p} />
        ))}
      </div>
    </section>
  );
}
