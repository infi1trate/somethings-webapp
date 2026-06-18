// Stand-in for the real backend. A production build would replace these with
// calls to account-creation, profile-persistence, and the clinical review queue.
// Everything resolves with a small delay so the UI exercises loading states.

import type { MentorDraft } from "@/lib/types";

function delay<T>(value: T, ms = 700): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface InviteInfo {
  valid: boolean;
  email: string;
  inviterName: string;
}

// In a real app the token would be looked up server-side. Here any non-empty
// token is treated as valid.
export async function validateInvite(token: string): Promise<InviteInfo> {
  const valid = Boolean(token && token.trim().length >= 4);
  return delay({
    valid,
    email: "",
    inviterName: "the Somethings team",
  });
}

// The "basics" we already hold for an invited mentor (from their application /
// referral). Prefills the Confirm screen. A real backend would look these up by
// the invite token; here we return believable demo data.
export interface InvitedProfile {
  firstName: string;
  lastName: string;
  email: string;
  dob: string; // YYYY-MM-DD
  phone: string;
  sex: string;
  genderIdentity: string;
  pronouns: string[];
  races: string[];
}

export async function getInvitedProfile(
  _token: string
): Promise<InvitedProfile> {
  return delay({
    firstName: "Jordan",
    lastName: "Rivera",
    email: "jordan.rivera@gmail.com",
    dob: "1999-04-12",
    phone: "(415) 555-0188",
    sex: "female",
    genderIdentity: "woman",
    pronouns: ["she/her"],
    races: ["Hispanic or Latino"],
  });
}

export interface SubmitResult {
  ok: boolean;
  reviewId: string;
}

export async function submitForReview(
  draft: MentorDraft
): Promise<SubmitResult> {
  // A real call would POST the draft and enqueue it for clinical recruitment.
  const handle = draft.email.split("@")[0] || "demo";
  return delay({ ok: true, reviewId: `rev_${handle}` }, 1100);
}

export type ReviewOutcome =
  | { decision: "approved" }
  | { decision: "rejected"; note: string };

// Used only by the dev-only reviewer simulator on the "submitted" screen.
export async function simulateReview(
  outcome: ReviewOutcome
): Promise<ReviewOutcome> {
  return delay(outcome, 600);
}
