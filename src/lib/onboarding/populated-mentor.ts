// ═══════════════════════════════════════════════════════════════════════════
// THE POPULATED MENTOR — the prototype's default mentor
//
// ═══ THE RULE (answered 2026-10-26) ═══ "The default Mentor state accessed
// from the dev footer should be a populated mentor user. This state should
// ONLY be reset if the user clicks the 'reset as new mentor' button."
//
// So an onboarded, published mentor with a filled profile is what you get:
//   · on a FRESH browser (nothing stored) — the store's `merge`
//   · after `reset()` — the front page's entries, and every "start over"
//   · from the dev footer's Mentor button, when the mentor is still untouched
//     and was not deliberately reset as new
//   · once, by migration, for a stored session sitting blank
// The ONE way back to a blank, invited mentor is `resetAsNewMentor()` — the
// dev footer's Reset (and the front page's "Start as a new mentor", which is
// the same request). It sets `mentorStartedNew`, so a deliberately new mentor
// is never re-populated behind the user's back.
//
// ═══ CONTENT ═══ The account identity is the mock invite's (`mock-api.ts`'s
// `getInvitedProfile`), so the invite flow and the populated mentor name the
// same person. The profile text is written in the voice of the fixture
// mentors' (people-demo `MENTOR_PROFILES`). TODO-DATA, all of it.
//
// ═══ ASSETS ═══ No asset is invented (people-demo's rule). The match-card
// photo and chat avatar stay EMPTY: the repo's only standalone photo (the
// onboarding "good photo" example) is a different person from this he/him
// mentor, and a mismatched face would mislead more than an empty slot — the
// wizard's photo step is optional. TODO-DATA: a real photo of this mentor.
// The story reuses the illustrated fixture panels under /public/stories; the
// vibe board and the audio intro stay empty (no real asset, and an object URL
// would not survive a reload anyway).

import type { HubStepKey, HubStepStatus, MentorDraft } from "@/lib/types";
import { STEP_ORDER } from "@/lib/onboarding/steps";

/* TODO-DATA — every value. */
export function populatedMentorDraft(): MentorDraft {
  return {
    password: "",
    firstName: "Brandon",
    lastName: "Forant",
    email: "brandon@somethings.com",
    dob: "1999-04-12",
    phone: "(415) 555-0188",
    matchCardPhoto: null,
    accountPhoto: null,
    displayName: "Brandon",
    sex: "male",
    genderIdentity: "man",
    pronouns: ["he/him"],
    races: ["White"],
    languages: ["English", "Spanish"],
    bio: "I work in design, I run badly but often, and I cook way too much food on Sundays. I started mentoring because a couple of people were patient with me when I was fifteen and it mattered more than they knew. I'm a good listener and I don't rattle easily.",
    /* Empty on purpose: the step is optional, and a made-up track URL would
       be a dead link (people-demo's note on `spotifyTrack`). */
    spotifyUrl: "",
    media: { kind: null, name: null, url: null, durationSec: null },
    vibe: [],
    interests: [
      { name: "Cooking", photo: null },
      { name: "Music", photo: null },
      { name: "Hiking & outdoors", photo: null },
      { name: "Photography", photo: null },
    ],
    firstMessages: {
      online: [
        { id: "fm-on-1", text: "Hey, I'm Brandon — really glad you're here. No pressure to say anything big, I'm around." },
        { id: "fm-on-2", text: "Tell me one thing that went okay this week. Small counts." },
      ],
      offline: [{ id: "fm-off-1", text: "Just saw your message — I'm away from my phone but I'll write back tonight." }],
    },
    stories: [
      {
        id: "live-first-moment",
        type: "first-moment",
        slides: [1, 2, 3].map((n) => ({ id: `live-slide-${n}`, photo: `/stories/m3-${n}.svg` })),
      },
    ],
  };
}

const HUB_DONE: Record<HubStepKey, HubStepStatus> = { story: "done", training: "done", scheduling: "done", away: "done" };

/** The store fields that make the live mentor onboarded and published. The
 *  snapshot is a clone of the draft, exactly as `capturePublishedSnapshot`
 *  takes it (no password, no media object URL). */
export function populatedMentorFields() {
  const draft = populatedMentorDraft();
  return {
    draft,
    status: "published" as const,
    completed: STEP_ORDER.map((s) => s.slug),
    rejectionNote: null,
    changeRequests: [],
    publishedSnapshot: JSON.parse(JSON.stringify({ ...draft, password: "", media: { ...draft.media, url: null } })) as MentorDraft,
    hubSteps: { ...HUB_DONE },
    hubWelcomeSeen: true,
    profileUpdate: null,
    enteredHome: true,
  };
}

/** Untouched: the store's blank starting mentor — nothing typed, never
 *  submitted, never published. Only an untouched mentor is ever populated
 *  automatically; one the user has started on is theirs. */
export function isPristineMentor(s: { draft?: Partial<MentorDraft>; status?: string; publishedSnapshot?: unknown }): boolean {
  return !s.draft?.firstName && (s.status === undefined || s.status === "invited") && !s.publishedSnapshot;
}
