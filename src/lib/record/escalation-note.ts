// ═══ THE ESCALATION NOTE'S FIELD CONTRACT (arch-G, G3) ═══
//
// ═══ THERE WAS NOTHING TO EXTRACT ═══
//
// G3 asks for an extraction "with the same discipline as the
// PresentationReviewModule extraction". The recon found no escalation note form
// anywhere in this codebase: what exists is the same field set as a READ-ONLY
// AUDIT DISPLAY on the Care record's History expansion (`care-timeline.tsx`,
// off `CareFlagRecord.escalationDetail`), plus two option sets used by the flag
// review dialog. So this is the contract stated as a type, built from what the
// display renders, so the form and that display cannot describe different
// records.
//
// ═══ EVERY FIELD IS OPTIONAL, AND THAT IS A DECISION NOT AN OVERSIGHT ═══
//
// `people-demo.ts` records why: "this is an audit surface: 'nobody recorded a
// safety plan' is information, and omitting the row would hide it." The renderer
// prints the label with an em-dash for absences. So this module has NO required
// fields and cannot have a gate — see `noteCompleteness`, which counts what is
// recorded instead of refusing what is not. Reported as the one contract
// question this phase could not answer from code.
//
// ═══ ONE DEVIATION FROM THE CODE, TAKEN DELIBERATELY ═══
//
// `escalationDetail.type` is a free `string` in the display contract (fixtures
// say "Crisis", "Welfare concern"). The phase file names three values —
// Escalation / Crisis / Other — and the Crisis Type field is CONDITIONAL on it,
// which a free string cannot drive. So the form offers the three as a select and
// STORES A STRING, leaving the display contract untouched. Flagged in the report.

export const ESCALATION_TYPE = [
  /* NEEDS-COPY-NICOLE, all three. */
  { id: "escalation", label: "Escalation" },
  { id: "crisis", label: "Crisis" },
  { id: "other", label: "Other" },
] as const;
export type EscalationTypeId = (typeof ESCALATION_TYPE)[number]["id"];

/** The value that reveals Crisis Type. Named rather than compared inline so the
 *  conditional cannot drift from the option it depends on. */
export const CRISIS_TYPE_REVEALS_ON: EscalationTypeId = "crisis";

/** ═══ THE NOTE'S SHAPE — FIELD NAMES ARE THE DISPLAY CONTRACT'S ═══
 *  One-to-one with `CareFlagRecord.escalationDetail` plus the two option-set
 *  fields the flag review dialog already collects, so a submitted note maps onto
 *  the record's audit display without a translation layer to disagree with. */
export interface EscalationNoteBody {
  /** One of `ESCALATION_TYPE`'s ids, or "" for unrecorded. Stored as a string —
   *  see the module note. */
  type: string;
  /** Conditional on `type === "crisis"`. One of `CRISIS_TYPE`'s ids or "". */
  crisisType: string;
  /** The legacy "Was this a referral?" boolean, which the record models as the
   *  PRESENCE of `referral`. Kept explicit in the form because a tri-state
   *  (unanswered / no / yes) is what a supervisor actually reports, and absence
   *  cannot express "asked and no". */
  wasReferral: boolean | null;
  /** Conditional on `wasReferral === true`. One of `REFERRAL_TYPE`'s ids or "". */
  referralType: string;
  suicideRisk: string;
  reasonDetail: string;
  mentorInformation: string;
  contactConversations: string;
  nextSteps: string;
  safetyPlan: string;
  emergencyContact: string;
}

export const EMPTY_NOTE: EscalationNoteBody = {
  type: "",
  crisisType: "",
  wasReferral: null,
  referralType: "",
  suicideRisk: "",
  reasonDetail: "",
  mentorInformation: "",
  contactConversations: "",
  nextSteps: "",
  safetyPlan: "",
  emergencyContact: "",
};

/** ═══ WHICH FIELDS ARE BEING ASKED FOR RIGHT NOW ═══
 *  The two conditionals are only asked for when their condition holds, so a
 *  completeness figure that counted them always would tell a supervisor they had
 *  left something blank that nobody wanted. */
export function askedFields(body: EscalationNoteBody): (keyof EscalationNoteBody)[] {
  const base: (keyof EscalationNoteBody)[] = [
    "type",
    "suicideRisk",
    "reasonDetail",
    "mentorInformation",
    "contactConversations",
    "nextSteps",
    "safetyPlan",
    "emergencyContact",
    "wasReferral",
  ];
  const out = [...base];
  if (body.type === CRISIS_TYPE_REVEALS_ON) out.push("crisisType");
  if (body.wasReferral === true) out.push("referralType");
  return out;
}

export function isRecorded(body: EscalationNoteBody, field: keyof EscalationNoteBody): boolean {
  const v = body[field];
  if (typeof v === "boolean") return true;
  if (v === null) return false;
  return String(v).trim().length > 0;
}

/** ═══ COMPLETENESS, NOT VALIDATION ═══
 *
 *  Billing's action row states "{n} fields needed" because three fields are
 *  REQUIRED and the commit is gated on them. Nothing here is required, so the
 *  same sentence would be a lie in the same shape: it would say a supervisor
 *  cannot submit when they can, and marking complete would then have to refuse
 *  or the sentence would have to be ignored.
 *
 *  So the action row states what is EMPTY, and marking complete records the gaps
 *  rather than blocking on them — which is what an audit surface whose absences
 *  are information has to do. The one contract question this phase could not
 *  answer from code: if any of these fields is in fact required, this is the
 *  function that changes and the gate follows from it. */
export function noteCompleteness(body: EscalationNoteBody): {
  asked: number;
  recorded: number;
  empty: (keyof EscalationNoteBody)[];
} {
  const asked = askedFields(body);
  const empty = asked.filter((f) => !isRecorded(body, f));
  return { asked: asked.length, recorded: asked.length - empty.length, empty };
}
