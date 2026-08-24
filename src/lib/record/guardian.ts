// PARENT / GUARDIAN DETAILS — the consent record for a minor.
//
// This is the most consequential block on a teen's account page. Consent decides
// what the platform may send and to whom, so the UI treats a change to it as a
// decision rather than an edit: the field carries a caution line, and the state
// lives in its own store field rather than being folded into profile data.
//
// TODO-DATA: no guardian data exists upstream. Every field here is empty until
// staff enter it, which is honest — a placeholder parent name on a minor's
// consent record would be worse than a blank.

/** TODO-COPY. Sentence case, per the product's copy law — the Figma renders the
 *  label as "Parent Consent (EDIT WITH CARE)"; the shouted parenthetical becomes
 *  a caution line under the field instead, which is where a warning belongs and
 *  keeps the label readable. */
export const CONSENT_OPTIONS = [
  { value: "unknown", label: "Not recorded" },
  { value: "granted", label: "Consent given" },
  { value: "declined", label: "Consent declined" },
  { value: "withdrawn", label: "Consent withdrawn" },
] as const;

export type ConsentStatus = (typeof CONSENT_OPTIONS)[number]["value"];

export interface GuardianDetails {
  name: string;
  phone: string;
  email: string;
  consent: ConsentStatus;
  /** Free text. Only meaningful once consent is declined or withdrawn — the UI
   *  says so rather than accepting a reason for a consent that was given. */
  optOutReason: string;
}

export function emptyGuardian(): GuardianDetails {
  return {
    name: "",
    phone: "",
    email: "",
    consent: "unknown",
    optOutReason: "",
  };
}

/** TODO-COPY */
export const CONSENT_LABEL: Record<ConsentStatus, string> = Object.fromEntries(
  CONSENT_OPTIONS.map((o) => [o.value, o.label])
) as Record<ConsentStatus, string>;

/** An opt-out reason only makes sense against a refusal. Asking for one beside
 *  "Consent given" invites a staff member to write something that contradicts
 *  the field above it. */
export function optOutApplies(consent: ConsentStatus): boolean {
  return consent === "declined" || consent === "withdrawn";
}

// ─── ACCOUNT LOCK ───────────────────────────────────────────────────────────
//
// DEACTIVATION AND LOCKING ARE DIFFERENT THINGS, and the difference matters:
//
//   deactivated — not an active user on the platform. Reversible, and the
//     person can be brought back.
//   locked      — cannot sign up AGAIN. Their email and phone are blocked, so
//     this outlives the account itself.
//
// Locking therefore only makes sense once someone is deactivated: blocking the
// contact details of an active user would be incoherent. The UI enforces that
// ordering rather than explaining it.
//
// Unlock EXISTS. A lock is a block on a real person's ability to return, and
// blocking the wrong email with no remedy is a worse failure than the one
// locking prevents. Both directions are recorded.

export interface AccountLock {
  lockedAt: number;
  actor: string;
  actorRole: string;
  /** What was blocked, captured at lock time — the account may be gone later
   *  but the block has to keep naming what it covers. */
  blocked: { email?: string; phone?: string };
}

// ─── FIXTURES ───────────────────────────────────────────────────────────────
//
// EVERY TEEN HAS A GUARDIAN ON FILE. A minor doesn't reach this platform without
// a parent entering their details, so an empty Parent details card is not a state
// the product really has — it was only ever the state of a prototype with no
// fixture behind it. These fill it.
//
// The BASELINE, not an override: `guardianFor` is read as
// `store.guardians[id] ?? guardianFor(id)`, the same sparse-override shape
// `mentorStatuses`, `menteeStatus` and `personProfiles` use. Staff edits win;
// the fixture is what a record looks like before anyone touches it, and a dev
// reset returns to it rather than to blanks.
//
// TODO-DATA: invented. `@example.com` is the reserved documentation domain and
// the 555 exchange is the reserved fictional range — mock PII should be
// unmistakably mock, never a plausible real address or number.
//
// CONSENT VARIES ON PURPOSE. Most are granted, because that is the ordinary
// case. Three are not, so the states that change the UI stay reachable without
// anyone having to hand-edit the store:
//   t1  unknown   — joined yesterday; details entered, consent still pending
//   t6  declined  — with a reason, which is the only state where the reason
//                   field is editable
//   t16 withdrawn — a consent that existed and was taken back

const G = (
  name: string,
  phone: string,
  email: string,
  consent: ConsentStatus = "granted",
  optOutReason = ""
): GuardianDetails => ({ name, phone, email, consent, optOutReason });

const GUARDIANS: Record<string, GuardianDetails> = {
  t1: G("Gina Casparro", "+19845550118", "gina.casparro@example.com", "unknown"),
  t2: G("Denise Johnson", "+19085550241", "denise.johnson@example.com"),
  t3: G("Robert Hashing", "+19845550336", "robert.hashing@example.com"),
  t4: G("Susan Kneeland", "+12155550472", "susan.kneeland@example.com"),
  t5: G("Angela Lee", "+13125550519", "angela.lee@example.com"),
  t6: G(
    "Elena Ramos",
    "+19735550604",
    "elena.ramos@example.com",
    "declined",
    "Wants to see how the first few months go before agreeing to updates."
  ),
  t7: G("Grace Park", "+19845550788", "grace.park@example.com"),
  t8: G("Michael Bennett", "+19085550855", "michael.bennett@example.com"),
  t9: G("Katie Foster", "+19735550923", "katie.foster@example.com"),
  t10: G("Denise Mitchell", "+13125551047", "denise.mitchell@example.com"),
  t11: G("Carmen Diaz", "+19085551130", "carmen.diaz@example.com"),
  t12: G("Wei Chen", "+13125551286", "wei.chen@example.com"),
  t13: G("Marcia Tate", "+19845551344", "marcia.tate@example.com"),
  t14: G("Yusuf Karim", "+13125551408", "yusuf.karim@example.com"),
  t15: G("Dana Moss", "+19845551572", "dana.moss@example.com"),
  t16: G(
    "Irina Petrova",
    "+19735551639",
    "irina.petrova@example.com",
    "withdrawn",
    "Asked us to stop contacting her after the account was closed."
  ),
  t17: G("Alicia Reed", "+19845551703", "alicia.reed@example.com"),
  t18: G("Miguel Ortiz", "+19845551866", "miguel.ortiz@example.com"),
  t19: G("Fatou Ba", "+19845551942", "fatou.ba@example.com"),
  t20: G("Anna Lindqvist", "+19845552015", "anna.lindqvist@example.com"),
  t21: G("Yvonne Clarke", "+19845552183", "yvonne.clarke@example.com"),
  t22: G("Priya Menon", "+19845552264", "priya.menon@example.com"),
  t23: G("Rosa Duarte", "+19845552350", "rosa.duarte@example.com"),
  t24: G("Peter Whitfield", "+19845552477", "peter.whitfield@example.com"),
  t25: G("Haruko Tanaka", "+19845552519", "haruko.tanaka@example.com"),
  t26: G("Lucia Vega", "+19845552688", "lucia.vega@example.com"),
};

/** The guardian record on file for a teen, before any staff edit. Returns an
 *  empty record for anyone with no fixture — a brand-new teen still has to be
 *  renderable, and that path is what the empty state is for. */
export function guardianFor(teenId: string): GuardianDetails {
  return GUARDIANS[teenId] ?? emptyGuardian();
}
