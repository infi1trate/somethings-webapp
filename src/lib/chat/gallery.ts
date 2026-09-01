// FIXTURES FOR /dev/components ONLY.
//
// ═══ WHY THEY ARE HERE AND NOT INLINE IN THE PAGE ═══
//
// The gallery renders the chat primitives at their real width so the squint test can
// happen — five activity covers side by side, four rail panels in a row. Every one of
// those needs a record to render from, and building them inline would put ninety
// lines of object literal in the middle of a page whose job is layout.
//
// ═══ AND WHY THEY ARE NOT THE SCENARIO FIXTURES ═══
//
// `chatScenario()` builds relative to a passed `now` and returns fourteen threads.
// The gallery wants ONE of each thing, at a FIXED instant, so two visits render
// identically and a screenshot diff means something. A frozen instant is wrong for
// the app (breach and recency drift) and exactly right here.

import { teensForMentor } from "@/lib/record/people-demo";
import { teenAvatarInitial, teenDisplayName } from "@/lib/record/teen-name";
import { LIVE_ID } from "@/lib/record/subject";
import type { AssistInput } from "@/lib/chat/assist";
import type { ChatEvent, ChatThread } from "@/lib/chat/types";

/** FROZEN, unlike the app's. See the module note. */
export const GALLERY_NOW = new Date("2026-09-01T14:00:00.000Z").getTime();

/** Caleb, from the real roster — so the Profile panel renders the same fixture the
 *  app does rather than a gallery-only person who could drift from it. */
const CALEB = teensForMentor(LIVE_ID).find((t) => t.id === "t18")!;

export const GALLERY_THREAD: ChatThread = {
  id: CALEB.id,
  kind: "teen",
  displayName: teenDisplayName(CALEB),
  subtitle: CALEB.pronouns ?? "",
  avatarInitial: teenAvatarInitial(CALEB),
  lastActivityAt: GALLERY_NOW - 5 * 60 * 60_000,
  preview: "went ok actually",
  previewFromMentor: false,
  unreadCount: 0,
  needsCheckIn: false,
};

/** Shaped so the Assist ladder lands on a real suggestion rather than the all-clear —
 *  a gallery showing "Nothing needs you here" would demonstrate the one state that
 *  needs no design. */
export const GALLERY_ASSIST: AssistInput = {
  teen: { ...CALEB, menteeLastSentDaysAgo: 9, mentorLastSentDaysAgo: 10 },
  messages: [],
  artifacts: [],
  noteCount: 0,
  now: GALLERY_NOW,
};

/** One of each kind, so the chip's six sentences and its two tones are all visible
 *  at once. `g2` is the one the gallery marks retracted. */
export const GALLERY_EVENTS: ChatEvent[] = [
  {
    id: "g1",
    threadId: CALEB.id,
    at: GALLERY_NOW - 6 * 60 * 60_000,
    kind: "activity-sent",
    actorId: LIVE_ID,
    artifactId: "a1",
    artifactName: "Connection Cards",
  },
  {
    id: "g2",
    threadId: CALEB.id,
    at: GALLERY_NOW - 5 * 60 * 60_000,
    kind: "activity-sent",
    actorId: LIVE_ID,
    artifactId: "a2",
    artifactName: "Hot Takes",
  },
  {
    id: "g3",
    threadId: CALEB.id,
    at: GALLERY_NOW - 4 * 60 * 60_000,
    kind: "activity-rescinded",
    actorId: LIVE_ID,
    artifactId: "a2",
    artifactName: "Hot Takes",
  },
  {
    id: "g4",
    threadId: CALEB.id,
    at: GALLERY_NOW - 3 * 60 * 60_000,
    kind: "swap-started",
    actorId: CALEB.id,
    artifactId: "a3",
    artifactName: "a Swap",
  },
  {
    id: "g5",
    threadId: CALEB.id,
    at: GALLERY_NOW - 2 * 60 * 60_000,
    kind: "note-added",
    actorId: LIVE_ID,
    artifactId: "n1",
    artifactName: "Sleep has come up three times",
  },
  {
    id: "g6",
    threadId: CALEB.id,
    at: GALLERY_NOW - 90 * 60_000,
    kind: "escalation-opened",
    actorId: LIVE_ID,
    artifactId: "e1",
    artifactName: "an escalation",
  },
  {
    id: "g7",
    threadId: CALEB.id,
    at: GALLERY_NOW - 30 * 60_000,
    kind: "escalation-resolved",
    actorId: LIVE_ID,
    artifactId: "e1",
    artifactName: "the escalation",
  },
];
