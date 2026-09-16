// ═══ THE FIELD CONTRACT, ASSERTED (arch-G, G3) ═══
//
// G3's gate asks for before/after proof that an extraction lost no field. There
// was nothing to extract — the recon found a read-only audit display and no form
// — so the gate this substitutes is a contract test: every field the record's
// History expansion renders is a field this module collects, under the same
// name, with the same option set, and with the same required-ness (none).
//
// THE NAMES MATTER, not just the count: the note's field names ARE
// `CareFlagRecord.escalationDetail`'s, so a submitted note maps onto the audit
// display with no translation layer to disagree with.

import { describe, expect, it } from "vitest";
import {
  askedFields,
  EMPTY_NOTE,
  ESCALATION_TYPE,
  CRISIS_TYPE_REVEALS_ON,
  noteCompleteness,
  type EscalationNoteBody,
} from "@/lib/record/escalation-note";
import { CRISIS_TYPE, REFERRAL_TYPE } from "@/lib/record/people-demo";

/** Every field the record's expansion renders, by the name it renders it from.
 *  Transcribed from `care-timeline.tsx` + `people-demo.ts` — deliberately by
 *  hand, so this test is an independent statement of the contract rather than a
 *  restatement of the module's own type. */
const DISPLAY_CONTRACT = [
  "suicideRisk",
  "emergencyContact",
  "reasonDetail",
  "mentorInformation",
  "contactConversations",
  "nextSteps",
  "safetyPlan",
] as const;

describe("the escalation note's field contract", () => {
  it("collects every field the record displays, under the same name", () => {
    for (const field of DISPLAY_CONTRACT) {
      expect(EMPTY_NOTE, field).toHaveProperty(field);
    }
  });

  it("adds the two option-set fields the display carries as a chip and a closure", () => {
    /* `type` is the expansion's chip; `wasReferral` + `referralType` are the
       legacy "Was this a referral?" pair, which the record models as the
       PRESENCE of `referral`. */
    expect(EMPTY_NOTE).toHaveProperty("type");
    expect(EMPTY_NOTE).toHaveProperty("crisisType");
    expect(EMPTY_NOTE).toHaveProperty("wasReferral");
    expect(EMPTY_NOTE).toHaveProperty("referralType");
  });

  it("preserves the option sets exactly", () => {
    expect(CRISIS_TYPE.map((c) => c.label)).toEqual([
      "Self-harm",
      "Suicidal ideation",
      "Suicide attempt",
      "Homicidal ideation",
      "Other",
    ]);
    expect(REFERRAL_TYPE.map((r) => r.label)).toEqual([
      "Mental health professional",
      "Medical provider",
      "Emergency services",
      "Crisis hotline",
      "School counsellor",
      "Family services",
      "Substance abuse treatment",
      "Other",
    ]);
    /* THE ONE DEVIATION FROM CODE, pinned so it cannot drift silently: the
       display contract types `type` as a free string and this offers three
       values, because the Crisis Type conditional cannot hang off a free
       string. Reported in G3's own report. */
    expect(ESCALATION_TYPE.map((t) => t.label)).toEqual(["Escalation", "Crisis", "Other"]);
  });

  it("requires nothing, because the record's absences are information", () => {
    /* `people-demo.ts`: "this is an audit surface: 'nobody recorded a safety
       plan' is information". So an empty note is submittable and the action row
       states completeness rather than refusing. */
    const c = noteCompleteness(EMPTY_NOTE);
    /* NOTHING recorded on an empty note — `wasReferral`'s third state (null,
       "unanswered") counts as unrecorded, which is what makes the tri-state
       worth having: an unchecked box would have counted as an answer. */
    expect(c.recorded).toBe(0);
    expect(c.empty.length).toBeGreaterThan(5);
  });

  it("asks for a conditional field only while its condition holds", () => {
    const base: EscalationNoteBody = { ...EMPTY_NOTE };
    expect(askedFields(base)).not.toContain("crisisType");
    expect(askedFields({ ...base, type: CRISIS_TYPE_REVEALS_ON })).toContain("crisisType");
    expect(askedFields(base)).not.toContain("referralType");
    expect(askedFields({ ...base, wasReferral: true })).toContain("referralType");
    /* AND "NO" DOES NOT ASK FOR A TYPE — which is the whole reason the boolean
       is tri-state rather than the presence of a referral object. */
    expect(askedFields({ ...base, wasReferral: false })).not.toContain("referralType");
  });

  it("counts a recorded boolean as recorded, and an unanswered one as not", () => {
    expect(noteCompleteness({ ...EMPTY_NOTE, wasReferral: false }).empty).not.toContain("wasReferral");
    expect(noteCompleteness(EMPTY_NOTE).empty).toContain("wasReferral");
  });
});
