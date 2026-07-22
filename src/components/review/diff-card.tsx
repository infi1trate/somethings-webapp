// Shared Live→Proposed diff presentation for the post-publish review lane —
// extracted VERBATIM from /admin/profile-update (record-03) so the record's
// review hub and the full console render the SAME diff, forever. Pure
// presentation: no store access, no actions (the composer/verdicts stay in
// the console page).

import { summarizeFieldValue } from "@/lib/onboarding/profile-update";
import { cn } from "@/lib/utils";

const PHOTO_FIELDS = new Set(["accountPhoto", "matchCardPhoto"]);

/** One side of a diff row: photo fields render a thumbnail, the rest render
 *  the same compact summary the queue uses. */
export function DiffValue({
  fieldId,
  value,
  muted,
}: {
  fieldId: string;
  value: unknown;
  muted?: boolean;
}) {
  if (PHOTO_FIELDS.has(fieldId)) {
    return typeof value === "string" && value ? (
      // eslint-disable-next-line @next/next/no-img-element -- data-URL thumbs
      <img
        src={value}
        alt=""
        className={cn(
          "size-14 shrink-0 object-cover",
          fieldId === "accountPhoto" ? "rounded-full" : "rounded-lg",
          muted && "opacity-50"
        )}
      />
    ) : (
      <span
        className={cn(
          "text-sm",
          muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
        )}
      >
        No photo
      </span>
    );
  }
  return (
    <span
      className={cn(
        "line-clamp-2 text-sm leading-relaxed",
        muted ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"
      )}
    >
      {summarizeFieldValue(fieldId, value)}
    </span>
  );
}

/** The Live → Proposed rows (de-emphasized live value — gaps.md #45). */
export function LiveProposedGrid({
  fieldId,
  live,
  proposed,
}: {
  fieldId: string;
  live: unknown;
  proposed: unknown;
}) {
  return (
    <div className="mt-3 grid grid-cols-[76px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
        Live
      </span>
      <DiffValue fieldId={fieldId} value={live} muted />
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        Proposed
      </span>
      <DiffValue fieldId={fieldId} value={proposed} />
    </div>
  );
}
