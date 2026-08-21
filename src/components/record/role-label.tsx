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

/** TODO-COPY. "Mentee" is the RELATIONSHIP word and the Bloom spec's label for
 *  this row; see the note in people-demo on why the person-domain type stays
 *  `DemoTeen`. */
export const ROLE_LABEL: Record<PersonRole, string> = {
  teen: "Mentee",
  mentor: "Mentor",
  "lead-mentor": "Lead Mentor",
  supervisor: "Supervisor",
  admin: "Admin",
};

const TONE: Record<PersonRole, string> = {
  teen: "border border-[color:var(--role-mentee-border)] bg-[var(--role-mentee-bg)] text-[var(--role-mentee-fg)]",
  mentor: "bg-[var(--role-mentor-bg)] text-[var(--role-mentor-fg)]",
  "lead-mentor": "bg-[var(--role-lead-bg)] text-[var(--role-lead-fg)]",
  supervisor: "bg-[var(--role-supervisor-bg)] text-[var(--role-supervisor-fg)]",
  admin: "bg-[var(--role-admin-bg)] text-[var(--role-admin-fg)]",
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
        TONE[role],
        className
      )}
      style={{ font: "var(--type-label-sm)" }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
