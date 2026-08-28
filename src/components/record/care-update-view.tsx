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
// THE STRUCTURE IS BACK, AND IT IS ENFORCED. An earlier pass made the three
// Figma prompts optional and rendered a supervisor's prose free-form, because two
// of three labels over empty text implied a structure nobody chose. The care
// update is now a structured CLINICAL FORM whose three fields are all required,
// so the read view labels all three — the labels describe fields that are
// guaranteed to have content, which is what the earlier version could not assume.
//
// THE ASSESSMENT IS A CHIP, NOT A SENTENCE. It is a structured value chosen from
// three, and a bare word under a heading reads as a truncated paragraph.
//
// NEUTRAL TONE ON THAT CHIP, DELIBERATELY. Colour-coding by direction would put a
// red "Escalated" on the record, and a red chip grades the teen's period rather
// than reporting it. The word already carries the meaning; the colour would only
// add a judgement. Defaults whisper.

import {
  ASSESSMENT_LABEL,
  CARE_UPDATE_ASSESSMENT_LABEL,
  CARE_UPDATE_SECTIONS,
  type CareUpdateRecord,
} from "@/lib/record/care-demo";
import { clinicalDate } from "@/components/record/care-presentation";
import { RecordAvatar } from "@/components/record/record-avatar";

const LABEL_STYLE = {
  font: "var(--type-field-label)",
  letterSpacing: "var(--type-field-label-tracking)",
} as const;

export function CareUpdateBodyView({
  update,
  compact = false,
}: {
  update: CareUpdateRecord;
  compact?: boolean;
}) {
  // Empty fields are not possible on a new update — the form requires all three —
  // but a fixture or a legacy record could still carry a blank, and a label over
  // nothing is worse than a missing label.
  const filled = CARE_UPDATE_SECTIONS.filter((s) => update.body[s.id]?.trim());

  /** TIGHTENED FROM 15px/1.5 TO 14px/1.55. Two prose fields plus a chip is more
   *  on the page than one narrative was, and the extra line-height keeps a dense
   *  clinical paragraph readable at the smaller size. */
  const prose = compact
    ? "mt-1 max-w-prose whitespace-pre-line text-[13px] leading-[19px] text-[var(--text-primary)]"
    : "mt-1 max-w-prose whitespace-pre-line text-[14px] leading-[1.55] text-[var(--text-primary)]";

  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      {filled.map((s) => (
        <div key={s.id}>
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {s.label}
          </p>
          <p className={prose}>{update.body[s.id].trim()}</p>
        </div>
      ))}

      {update.body.assessment && (
        <div>
          <p className="text-[var(--text-muted)]" style={LABEL_STYLE}>
            {CARE_UPDATE_ASSESSMENT_LABEL}
          </p>
          <AssessmentChip value={update.body.assessment} />
        </div>
      )}
    </div>
  );
}

/** The structured value, as a chip. `--status-neutral-*` is the design system's
 *  own paired couple (5.70:1 light, 5.27:1 dark) — the fill's own foreground
 *  rather than a generic text token, which is the mistake that produced the
 *  contrast defects in gap rows 276, 286 and 294. */
export function AssessmentChip({
  value,
}: {
  value: NonNullable<CareUpdateRecord["body"]["assessment"]>;
}) {
  return (
    <span className="mt-1.5 inline-flex items-center rounded-full bg-[var(--status-neutral-bg)] px-2.5 py-0.5 text-[12.5px] font-medium leading-[18px] text-[var(--status-neutral-fg)]">
      {ASSESSMENT_LABEL[value]}
    </span>
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
