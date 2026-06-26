"use client";

import type { ChangeRequest, MentorDraft } from "@/lib/types";
import { addressedStateOf } from "@/lib/onboarding/change-requests";
import { ChangeStateBadge } from "@/components/onboarding/change-row";

/** The reviewer's note for a step, shown as a full-width banner at the TOP of the
 *  affected step (and in the settings editor). Layout-resilient to arbitrary free
 *  text — the container grows and long unbroken strings wrap.
 *
 *  Treatment (Figma 327-2102): a light orange fill inside a full orange border,
 *  same family as the "Changes requested" status pill, so the callout and the
 *  pill read as one feedback system. Meaning is carried by the tint + the "From
 *  the review team" label (NOT colour alone — WCAG 1.4.1); body text stays at
 *  full reading contrast on the tint. No drop shadow: a passive message, not an
 *  elevated surface. */
export function ChangeNoteCard({
  req,
  draft,
}: {
  req: ChangeRequest;
  draft: MentorDraft;
}) {
  const state = addressedStateOf(req, draft);
  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50 px-5 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
          From the review team
        </p>
        <ChangeStateBadge state={state} />
      </div>
      <p className="mt-1 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
        {req.note}
      </p>
    </div>
  );
}
