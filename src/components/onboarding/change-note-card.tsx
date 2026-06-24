"use client";

import type { ChangeRequest, MentorDraft } from "@/lib/types";
import { addressedStateOf } from "@/lib/onboarding/change-requests";
import { ChangeStateBadge } from "@/components/onboarding/change-row";

/** The reviewer's FULL note for a step, shown in the left editing panel of the
 *  affected step only (never the preview). Layout-resilient to arbitrary free
 *  text — the container grows and long unbroken strings wrap.
 *
 *  Treatment: a warm tonal fill + a left accent rule, both pulled from the SAME
 *  Tailwind orange scale as the "Needs changes" status pill (orange-100/800), so
 *  the callout and the pill read as one feedback system. Meaning is carried by
 *  the tint + the accent rule + the text label (NOT colour alone — WCAG 1.4.1).
 *  No drop shadow: this is a passive, high-priority message, not an interactive/
 *  elevated surface. Body text stays at full reading contrast on the tint. */
export function ChangeNoteCard({
  req,
  draft,
}: {
  req: ChangeRequest;
  draft: MentorDraft;
}) {
  const state = addressedStateOf(req, draft);
  return (
    <div className="rounded-xl border border-orange-200 border-l-4 border-l-orange-600 bg-orange-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
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
