// ═══════════════════════════════════════════════════════════════════════════
// THE MENTOR LENS'S TWO DOORS (2026-10-29)
//
// The dev bar's Mentor button no longer flips the lens in place: it opens
// `/start/mentor`, the front door's anatomy with two cards — sign in as the
// existing mentor, or reset and start over as a new one. Asked with a
// screenshot of the landing page ("they should first be brought to a page
// like this").
//
// The two doors, and what each keeps:
//   EXISTING  keeps the session — escalations, chats and tier writes survive,
//             so a cross-role demo (supervisor confirms, then the mentor sees
//             it) still works. An untouched mentor becomes the populated one;
//             a mentor mid-onboarding or published is kept as is.
//   NEW       the one blank reset (`resetAsNewMentor`), into the demo invite.
//
// Lifted from `dev-bar.tsx`, where `mentorDest` and `resetToNewMentor` lived,
// so the bar and the page share one copy of each rule.

import { useOnboardingStore } from "@/lib/onboarding/store";
import { isPristineMentor } from "@/lib/onboarding/populated-mentor";

export const MENTOR_START_PATH = "/start/mentor";

/** Mentor's landing screen, computed from the mentor's CURRENT state so the
 *  lens mirrors where they would actually be. */
export function mentorDest(): string {
  const s = useOnboardingStore.getState();
  if (s.publishedSnapshot === null) {
    if (s.status === "in_review" || s.status === "rejected") return "/onboarding/submitted";
    return "/hub";
  }
  if (s.profileUpdate !== null) return "/app/profile";
  if (!s.enteredHome) return "/onboarding/submitted";
  return "/app";
}

/** A same-origin path, never the start page itself. A path only, never a
 *  full URL: this is what keeps `?from=` from being an open redirect. */
export function safeFrom(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith(MENTOR_START_PATH)) return null;
  return raw;
}

/** Routes where switching the lens keeps the page (the record, and chat):
 *  every role shares one layout there, so the mentor goes back to it. */
const holdsTheLens = (path: string) => path.startsWith("/admin/person/") || path.startsWith("/app/chat");

/** The chooser, remembering where the reader was. */
export function mentorStartHref(from: string): string {
  const f = safeFrom(from);
  return f ? `${MENTOR_START_PATH}?from=${encodeURIComponent(f)}` : MENTOR_START_PATH;
}

/** ═══ SIGN IN AS THE EXISTING MENTOR ═══ Keeps the session's data. */
export function enterAsExistingMentor(from: string | null) {
  const s = useOnboardingStore.getState();
  /* An untouched mentor (or one reset as new and never started) becomes the
     populated default; `populateMentor` also clears `mentorStartedNew`. A
     mentor someone has started on, or published, is theirs. */
  if (isPristineMentor(s)) s.populateMentor();
  s.setPersona("mentor");
  const back = safeFrom(from);
  /* A hard navigation, as the bar always did: the lens is read at mount. */
  window.location.assign(back && holdsTheLens(back) ? back : mentorDest());
}

/** ═══ START AS A NEW MENTOR — THE ONE BLANK RESET ═══ Every other path
 *  leaves the populated mentor; this is the only one that starts over. */
export function resetToNewMentor() {
  const s = useOnboardingStore.getState();
  s.resetAsNewMentor();
  s.setPersona("new-mentor");
  /* A wiped store must rehydrate from scratch. */
  window.location.assign("/invite/demo-invite-token");
}
