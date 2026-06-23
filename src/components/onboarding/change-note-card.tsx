"use client";

import type { ChangeRequest, MentorDraft } from "@/lib/types";
import { addressedStateOf } from "@/lib/onboarding/change-requests";
import { ChangeStateBadge } from "@/components/onboarding/change-row";

/** The reviewer's FULL note for a step, shown in the left editing panel of the
 *  affected step only (never the preview). Layout-resilient to arbitrary free
 *  text — the container grows and long unbroken strings wrap; readable contrast
 *  (dark text on the card). Reflects the item's addressed state inline. */
export function ChangeNoteCard({
  req,
  draft,
}: {
  req: ChangeRequest;
  draft: MentorDraft;
}) {
  const state = addressedStateOf(req, draft);
  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          From the review team
        </p>
        <ChangeStateBadge state={state} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {req.note}
      </p>
    </div>
  );
}
