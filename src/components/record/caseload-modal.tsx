"use client";

// CaseloadModal (caseload prompt) — opened from the lead's Mentors roster.
// PRIMARY content: the teens this mentor is mentoring. SECONDARY (subtle, below
// a divider): the shared CaseloadControls — the same Automatic/Custom + stepper
// the record's Mentorship tab uses, writing the same store key, so the two
// surfaces stay coherent. The people list is a generic prop: demo mentors pass
// their teens (people-demo), the store-backed live mentor passes the record's
// mentee set (mentees-demo) so counts match the record everywhere.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CaseloadControls,
  useCaseload,
} from "@/components/record/caseload-controls";

export interface CaseloadPerson {
  id: string;
  name: string;
  /** Muted context line — "joined 2 days ago" / "together 4 months". */
  secondary: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CaseloadModal({
  open,
  onOpenChange,
  mentorId,
  mentorName,
  defaultTotal,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorId: string;
  mentorName: string;
  defaultTotal: number;
  people: CaseloadPerson[];
}) {
  const caseload = useCaseload(mentorId, defaultTotal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mentorName}</DialogTitle>
          <DialogDescription className="tabular-nums">
            Mentees · {people.length} of {caseload.total}
          </DialogDescription>
        </DialogHeader>

        {people.length > 0 ? (
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex min-h-11 items-center gap-3 rounded-lg px-1 py-1.5"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  {initials(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--text-primary)]">
                  {p.name}
                </span>
                <span
                  className="shrink-0 text-[var(--text-secondary)] tabular-nums"
                  style={{ font: "var(--type-helper)" }}
                >
                  {p.secondary}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-[var(--text-secondary)]">
            No teens matched yet.
          </p>
        )}

        {/* Secondary, deliberately quiet: the caseload adjuster. */}
        <div className="border-t border-[color:var(--border-contour)] pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px] text-[var(--text-muted)]">
            Caseload
          </p>
          <CaseloadControls
            mentorId={mentorId}
            currentCount={people.length}
            defaultTotal={defaultTotal}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
