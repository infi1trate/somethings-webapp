// ROLE LABEL — Bloom "Role Label" (Figma 3466:10231).
//
// A warm neutral ramp that GAINS WEIGHT WITH AUTHORITY: Mentee is outlined on
// white, Mentor is barely-there cream, then Lead Mentor, Supervisor and Admin
// fill progressively darker. It replaces a single flat outlined pill that gave
// every role the same visual rank — which made a directory of mixed roles read
// as one undifferentiated list.
//
// Type is Bloom Label/Small/Web (500 12px/16px Lausanne, tracking 0), the same
// as the status label, so the two pills sit at the same optical weight in a row.
//
// COLOR IS NEVER THE SOLE SIGNAL (WCAG 1.4.1) — the word is always present.
// Every pairing is measured; three of Bloom's own values needed darkening to
// clear 4.5:1 at 12px and are documented in settings-tokens.css.

import type { PersonRole } from "@/lib/record/people-demo";
import { cn } from "@/lib/utils";

/** TODO-COPY. SENTENCE CASE — "Lead mentor", not "Lead Mentor". This diverges
 *  from the published Figma, which title-cases it; the product's own copy law
 *  wins, and a label that shouts one role louder than the rest is exactly the
 *  flatness the tint ramp is here to fix.
 *
 *  "Mentee" is the RELATIONSHIP word and the spec's label for this row; see the
 *  note in people-demo on why the person-domain type stays `DemoTeen`. */
export const ROLE_LABEL: Record<PersonRole, string> = {
  teen: "Mentee",
  mentor: "Mentor",
  "lead-mentor": "Lead mentor",
  supervisor: "Supervisor",
  admin: "Admin",
};

/** The tint per role, exported so the record HEADER badge and the directory
 *  cell pull from one map — a role that looked different in two places would
 *  defeat the point of a taxonomy. */
export const ROLE_BADGE_TONE: Record<PersonRole, string> = {
  teen: "border border-[color:var(--badge-role-mentee-border)] bg-[var(--badge-role-mentee-bg)] text-[var(--badge-role-mentee-fg)]",
  mentor: "bg-[var(--badge-role-mentor-bg)] text-[var(--badge-role-mentor-fg)]",
  "lead-mentor": "bg-[var(--badge-role-leadMentor-bg)] text-[var(--badge-role-leadMentor-fg)]",
  supervisor: "bg-[var(--badge-role-supervisor-bg)] text-[var(--badge-role-supervisor-fg)]",
  admin: "bg-[var(--badge-role-admin-bg)] text-[var(--badge-role-admin-fg)]",
};

export function RoleLabel({
  role,
  className,
}: {
  role: PersonRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1",
        ROLE_BADGE_TONE[role],
        className
      )}
      style={{ font: "var(--type-label-sm)" }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
