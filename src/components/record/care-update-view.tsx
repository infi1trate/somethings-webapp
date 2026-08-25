"use client";

// CARE UPDATE — READ VIEW. Moved out of the deleted Care rail, which used to own
// these two components while the main column imported them across; care updates
// now have ONE home, the main column, so their read view lives beside it.
//
// AUTHORED CLINICAL DOCUMENTATION, and the typography ranks it accordingly: 15px
// body at 1.5 line-height on a reading measure, one step ABOVE the AI summary's
// 13px secondary. A human's clinical account outranks decision support on this
// page, and that ordering has to be visible without reading a word.
//
// THE THREE PROMPTS ARE NO LONGER ENFORCED STRUCTURE (Prompt C Phase 1). They
// were the read structure as well as the compose template; they are now
// placeholder guidance in the composer only. A supervisor who writes one
// paragraph gets one paragraph, not three labelled sections with two of them
// empty. Legacy updates that DO carry the sectioned shape still render with
// their labels, so nothing already written loses its structure.

import { CARE_UPDATE_SECTIONS, type CareUpdateRecord } from "@/lib/record/care-demo";
import { clinicalDate } from "@/components/record/care-presentation";
import { RecordAvatar } from "@/components/record/record-avatar";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

/** Does this update use the legacy three-section shape? An update written after
 *  the free-form change puts everything in `standing` and leaves the other two
 *  empty — rendering a lone "Where things stand" label over it would imply a
 *  structure the author never chose. */
function isSectioned(update: CareUpdateRecord): boolean {
  return (
    CARE_UPDATE_SECTIONS.filter((s) => update.body[s.id]?.trim()).length > 1
  );
}

export function CareUpdateBodyView({
  update,
  compact = false,
}: {
  update: CareUpdateRecord;
  compact?: boolean;
}) {
  const filled = CARE_UPDATE_SECTIONS.filter((s) => update.body[s.id]?.trim());

  // FREE-FORM: one block of prose, no labels invented over it.
  if (!isSectioned(update)) {
    const body = filled.map((s) => update.body[s.id].trim()).join("\n\n");
    return (
      <p
        className={
          compact
            ? "max-w-prose whitespace-pre-line text-[13px] leading-[19px] text-[var(--text-primary)]"
            : "max-w-prose whitespace-pre-line text-[15px] leading-[1.5] text-[var(--text-primary)]"
        }
      >
        {body}
      </p>
    );
  }

  // LEGACY SECTIONED: keep the labels the author wrote against.
  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      {filled.map((s) => (
        <div key={s.id}>
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {s.label}
          </p>
          <p
            className={
              compact
                ? "mt-1 max-w-prose whitespace-pre-line text-[13px] leading-[19px] text-[var(--text-primary)]"
                : "mt-1 max-w-prose whitespace-pre-line text-[15px] leading-[1.5] text-[var(--text-primary)]"
            }
          >
            {update.body[s.id].trim()}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Author + role + date. Amendments say what they amend, so a reader never has
 *  to work out which of two updates is current. */
export function CareUpdateByline({
  update,
  amendsDate,
}: {
  update: CareUpdateRecord;
  amendsDate?: number;
}) {
  return (
    // A 24px avatar on the signature line: a care update is AUTHORED clinical
    // documentation, and an author with a face reads as a person who wrote it
    // rather than a byline the system generated.
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-[17px] text-[var(--text-muted)]">
      <RecordAvatar name={update.author} size={24} />
      <span>
        {`${update.author} · ${update.authorRole} · ${clinicalDate(update.createdAt)}`}
        {amendsDate !== undefined && (
          <>
            {" · "}
            {/* TODO-COPY */}
            {`amends the ${clinicalDate(amendsDate)} update`}
          </>
        )}
      </span>
    </p>
  );
}
