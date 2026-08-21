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
