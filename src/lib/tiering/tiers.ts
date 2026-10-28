// ═══════════════════════════════════════════════════════════════════════════
// THE STEPPED-CARE TIERS — CANON (Tiering & Escalation pack v1.0)
//
// One file for every string and rule a tier carries, so the chat, the user
// record and the Monitoring page cannot say different things about the same
// teen. `lib/monitoring/tiers.ts` re-exports this; it was the first home.
//
// ═══ SUPERSEDES proto/monitoring-merge's version, in place ═══
//   · Tier 3 was "Monitoring". It collides with the supervisor Monitoring
//     surface, and the canon forbids it: Tier 3 is "Medium risk".
//   · `EXITS_TO` followed the Oct flow (T1 → T3, T2 → T3). The canon's rule
//     is asymmetric and stricter: T1 exits ONLY via a completed crisis note,
//     to Tier 2 by default — to Tier 3 only on a "no longer a threat"
//     outcome — and never straight to Tier 4.
//   · The cadences were placeholder copy; these are the canon's.
//
// ═══ BLOCKED CONSTANTS — named sign-off to change ═══
//   Tier names, dwell periods and exit-document requirements are clinical
//   policy (Meg / Dr. Nissan). Mentor direct placement is flag-only, by the
//   same policy. Changing any of them here without that sign-off is a defect.

export type Tier = 1 | 2 | 3 | 4;

export const TIERS: readonly Tier[] = [1, 2, 3, 4];

export const TIER_NAME: Record<Tier, string> = {
  1: "Active crisis",
  2: "High risk",
  3: "Medium risk",
  4: "General",
};

/** What the tier means for the teen, in a sentence a mentor can read aloud
 *  to themselves. TODO-COPY, all four; Tier 4's is the pack's own. */
export const TIER_DESCRIPTION: Record<Tier, string> = {
  1: "In crisis right now. A supervisor is responding with you.",
  2: "High risk. A supervisor coaches live and checks in every day.",
  3: "Medium risk. A weekly check-in note keeps an eye on things.",
  4: "No current concerns. Regular mentorship.",
};

/** ═══ THE CLINICAL CRITERIA — a supervisor's reading of each tier ═══
 *  BLOCKED CONSTANT. Pack v11.0 §5.2, verbatim (it replaced v10's
 *  comma-joined reading of the matrix; the Figma's misspelt "imminence",
 *  "substance abuse" and "mental health … high risk" are its errors, not
 *  the copy).
 *  SUPERVISORS ONLY (answered 2026-10-28: "that's only for supervisors") —
 *  a mentor raises from `RAISE_DESCRIPTION`'s plain language, reversing the
 *  pack's §1.3. Never paraphrase. */
export const TIER_CRITERIA: Record<Tier, string> = {
  1: "Specific suicide plan with means/timeframe, in-progress self-harm, rapid symptom escalation or active command hallucinations.",
  2: "Passive suicidal ideation, current abuse/neglect disclosures, active eating disorder/substance use without imminence.",
  3: "Low-level distress, historical mental-health issues with no active high-risk indicators.",
  4: "No issues that need supervisor intervention.",
};

/** The Monitoring group header's cadence line — the canon's rules, short.
 *  TODO-COPY. */
export const TIER_CADENCE: Record<Tier, string> = {
  1: "Respond in under 60s · exits only via crisis note · 1 day at a time",
  2: "Live supervisor coaching · daily check-in · 7-day minimum",
  3: "Weekly check-in note · steps down after 14 days unless renewed",
  4: "Passive registry · mentor-owned",
};

/** ═══ MOVEMENT IS ASYMMETRIC ═══ Up is one tap; down is one step at a time,
 *  gated on the tier's exit document, and only ever a supervisor event. */
export const EXITS_TO: Record<Exclude<Tier, 4>, Tier> = { 1: 2, 2: 3, 3: 4 };

/** The one exception to "one step down": a Tier 1 crisis note whose outcome
 *  is "no longer a threat" may exit to Tier 3. */
export const T1_NO_THREAT_EXIT: Tier = 3;

/** The document that has to exist before a tier can be left. */
export const EXIT_DOCUMENT: Record<Exclude<Tier, 4>, string> = {
  1: "Crisis note",
  2: "Exit document",
  3: "Weekly check-in note",
};

/** Minimum days before a tier can be left. */
export const TIER_MINIMUM_DAYS: Partial<Record<Tier, number>> = { 2: 7 };

/** Days after which a tier steps down by itself unless renewed. */
export const TIER_DWELL_DAYS: Partial<Record<Tier, number>> = { 3: 14 };

/** Tier 1 is held at most this long at a time. */
export const T1_MAX_DAYS = 1;

/** The response window a Tier 1 alert counts down from. */
export const T1_RESPONSE_SECONDS = 60;

/* ═══ THE SIGNIFIER, AND NOTHING ELSE ═══ Tier is a ring, a lozenge and a
   surface, together (WCAG 1.4.1). No coloured bars or left borders. Alert
   colour is spent on Tiers 1 and 2 only. */
export const TIER_RING: Record<Tier, string | null> = {
  1: "var(--t1)",
  2: "var(--t2)",
  3: "var(--text-secondary)",
  4: null,
};

/** Alert colour is for Tiers 1–2 alone — the one test every surface asks. */
export const isAlertTier = (t: Tier | RaiseTarget | null | undefined) => t === 1 || t === 2;

// ── RAISING ─────────────────────────────────────────────────────────────────

/** ═══ A PLATFORM CONCERN IS NOT A TIER (pack v3.0, Supersession 3) ═══
 *  Impersonation or account activity that is not right. It routes to
 *  supervisor review and never changes a teen's clinical tier. v1–v2 offered
 *  it as a fourth option in the tier picker; it is out of the taxonomy now —
 *  a quiet link below the tiers opens its own report flow. The escalation
 *  record still carries it, as a CATEGORY (`requested: "platform"`). */
export const PLATFORM = "platform" as const;
export type RaiseTarget = Exclude<Tier, 4> | typeof PLATFORM;

/** What a mentor can raise as a tier — strictly Tiers 1–3 (blocked
 *  constant). Tier 4 is never a raise target; a platform concern is not a
 *  tier at all. */
export const RAISE_TIERS: readonly Exclude<Tier, 4>[] = [1, 2, 3];

export const RAISE_LABEL: Record<RaiseTarget, string> = {
  1: "Tier 1 · Active crisis",
  2: "Tier 2 · High risk",
  3: "Tier 3 · Medium risk",
  platform: "Platform concern",
};

/** The picker's plain-language line per option, in FCP-2's voice with the
 *  casing fixed. `{name}` is the teen's first name. ═══ BLOCKED CONSTANT
 *  (pack v10.0) ═══ Tiers 1–3 are the pack's table verbatim; the mock it
 *  corrected had T1/T2 swapped and pasted emergency-contact copy into T3. */
export const RAISE_DESCRIPTION: Record<RaiseTarget, string> = {
  1: "{name} might hurt themselves or someone else, or is in danger right now.",
  2: "Something serious is going on and {name} needs closer support this week.",
  3: "You're worried and want a supervisor to know, but it isn't urgent.",
  platform: "Impersonation or account activity that doesn't look right. It won't change {name}'s tier.",
};

export const raiseDescription = (t: RaiseTarget, name: string) => RAISE_DESCRIPTION[t].replaceAll("{name}", name);

/** "Tier 2" — the short form a chip uses. */
export const tierShort = (t: Tier) => `Tier ${t}`;
