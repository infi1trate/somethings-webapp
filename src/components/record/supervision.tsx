"use client";

// Supervision — the subject-conditional PRACTICE surface for a SUPERVISOR
// subject (the counterpart to Mentorship for a mentor). Would list the mentors
// / staff this supervisor supervises, as PersonRows.
//
// DATA GAP (reported): the prototype has no supervisor→supervisees reverse
// lookup — no `supervisorId` on any person, no reverse index. Per the plan we
// omit-and-report rather than stub, so this renders a designed empty state
// until that data exists. It is reachable today only via the dev-only
// ?subjectRole=supervisor preview param (no real supervisor record exists).
//
// TODO-COPY: the tab may be renamed "Team"; this empty-state copy is a
// placeholder pending the voice pass.

import { Users } from "lucide-react";

export function Supervision() {
  return (
    <section aria-label="Supervision" data-record-section="supervision">
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-6 py-14 text-center shadow-[var(--shadow-card)]">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-[var(--surface-s1)] text-[var(--text-muted)]"
        >
          <Users className="size-5" />
        </span>
        <p className="text-[15px] font-semibold leading-[20px] text-[var(--text-primary)]">
          Supervision assignments will appear here
        </p>
        <p className="max-w-xs text-[13px] leading-[18px] text-[var(--text-secondary)]">
          The mentors and staff this supervisor supports will list here once
          supervision assignments are connected.
        </p>
      </div>
    </section>
  );
}
