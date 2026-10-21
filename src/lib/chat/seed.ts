// MENTOR CHAT SEED — five relationship scenarios.
//
// ═══ THE ROSTER IS NOT INVENTED ═══
//
// Fifteen teens are already matched to the live mentor in `people-demo.ts`, and
// they already carry `matchedDaysAgo`, `mentorLastSentDaysAgo` and
// `menteeLastSentDaysAgo`. So the conversation list is built from the roster that
// exists, and its ORDER, its previews and its Check-in filter are all derived
// from those stamps rather than from a second set of numbers that would drift.
//
// Concretely: `needsCheckIn` is `menteeRecency(...) === "teen-quiet"` — the
// model `mentees-demo.ts` already defines, at the threshold it already defines
// (`TEEN_QUIET_DAYS`). Not a new rule. If the threshold changes, the mentee
// table and this list change together.
//
// ═══ DIALOGUE IS AUTHORED, NOT GENERATED ═══
//
// Five scenarios of fifteen-to-twenty-five messages is small enough to write, and
// written dialogue is the only kind that can actually be ABOUT something. A
// generator produces text that is plausible sentence by sentence and meaningless
// as a conversation — which is fine for a risk-flag excerpt where the point is
// the shape, and useless here where the point is that a mentor can read a real
// exchange and understand a relationship.
//
// The teens who are NOT the scenario's focus still get threads, because a list
// row that opens onto nothing is worse than no row. Theirs are short and derived
// from their own recency stamps.
//
// ═══ BUILT RELATIVE TO A PASSED `now` ═══
//
// No `Math.random`, no `Date.now()` in this file. Two builds at the same instant
// are byte-identical, which is what makes a screenshot comparison mean anything.
// Same contract as `lib/tasks/seed.ts`, and for the same reason.

import { DEMO_PEOPLE, teensForMentor, type DemoTeen } from "@/lib/record/people-demo";
import { menteeRecency, teenAsMentee } from "@/lib/record/mentees-demo";
import { teenAvatarInitial, teenDisplayName } from "@/lib/record/teen-name";
import { LIVE_ID } from "@/lib/record/subject";
import type {
  ChatData,
  ChatEvent,
  ChatMessage,
  ChatThread,
  EmergencyInfo,
  EscalationState,
  SentArtifact,
  Sender,
  ThreadId,
} from "@/lib/chat/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** THE MENTOR'S OWN SUPPORT PEOPLE, from the supervision edges that already
 *  exist: the live mentor reports to lead `s-brandy`, who reports to supervisor
 *  `s-stephen`. Not a fixture — `people-demo.ts` states both edges in a comment
 *  and in the data. */
const SUPPORT_IDS = ["s-brandy", "s-stephen"] as const;

// ── Authoring helpers ───────────────────────────────────────────────────────

/** ═══ A LINE IS A DELTA, NOT AN AGE — AND THAT IS A BUG FIX ═══
 *
 *  The first version of this file gave each line an absolute `ago` in minutes
 *  before `now`, so authoring meant writing a DESCENDING sequence by hand:
 *  `9 * 1440`, then `9 * 1440 - 300`, then `9 * 1440 - 280`. That third number is
 *  larger than the second, which means OLDER, which means the reply landed before
 *  the question. It happened in three of the five scenarios and it reached a
 *  screenshot: Elena said "did the cards, the last one was hard", the mentor
 *  answered "we can leave that one", and only THEN did she say which one she
 *  meant. The conversation read backwards.
 *
 *  A sort cannot fix that, and the first version had one — it sorted the messages
 *  into timestamp order, which is exactly what rendered the inverted dialogue
 *  faithfully. The sort made the bug invisible rather than impossible.
 *
 *  So `after` is MINUTES SINCE THE PREVIOUS LINE. Authored order is chronological
 *  order by construction: there is no number you can write that puts a line before
 *  the one above it, because the numbers only ever add. Pinned in
 *  __tests__/seed.test.ts, which asserts that rendered order equals authored order
 *  and that nothing lands in the future.
 *
 *  Same lesson, same shape, as `lib/tasks/conversation.ts`: "gaps accumulate; they
 *  are not multiplied". */
interface Line {
  from: Sender;
  /** Minutes after the previous line. Omitted on the first, which starts at the
   *  scenario's `startsAgo`. */
  after?: number;
  text?: string;
  /** An image. Dimensions are REQUIRED — see MessageMedia on why. */
  image?: { w: number; h: number; alt: string };
  voice?: number;
  gif?: { w: number; h: number; alt: string };
  reactions?: { emoji: string; by: Sender }[];
}

function messagesFrom(
  threadId: ThreadId,
  /** Minutes before `now` that the FIRST line was sent. */
  startsAgo: number,
  lines: Line[],
  now: number
): ChatMessage[] {
  let cursor = now - startsAgo * MINUTE;
  return lines.map((l, i) => {
    cursor += (l.after ?? 0) * MINUTE;
    const kind = l.image ? "image" : l.voice ? "voice" : l.gif ? "gif" : "text";
    const media = l.image ?? l.gif;
    return {
      id: `${threadId}-m${i + 1}`,
      threadId,
      at: cursor,
      sender: l.from,
      kind,
      ...(l.text !== undefined ? { text: l.text } : {}),
      ...(media ? { media } : {}),
      ...(l.voice !== undefined ? { durationSec: l.voice } : {}),
      ...(l.reactions ? { reactions: l.reactions } : {}),
    } as ChatMessage;
    // NO SORT. There is nothing to sort — see the note above on why the sort was
    // the thing hiding the defect.
  });
}

// ── Previews ────────────────────────────────────────────────────────────────

/** ═══ THE PREVIEW IS COMPOSED HERE, NOT IN THE ROW ═══
 *
 *  A row previews whatever happened last, and what happened last might not be a
 *  message — it might be an activity going out or a note being written. Composing
 *  the sentence at seed time means the row renders one string and does not have to
 *  hold a switch over six event kinds and four message kinds.
 *
 *  Non-text messages get a NOUN, not an emoji: "Photo", "Voice note". An emoji in
 *  a preview is a glyph a screen reader either skips or reads as a paragraph. */
function previewOf(m: ChatMessage): string {
  switch (m.kind) {
    case "image":
      return "Photo"; // TODO-COPY
    case "voice":
      return "Voice note"; // TODO-COPY
    case "gif":
      return "GIF"; // TODO-COPY
    default:
      return m.text ?? "";
  }
}

/** TODO-COPY. What an event reads as in a list row — past tense, no exclamation,
 *  and it names the artifact so the row is about something. */
function previewOfEvent(e: ChatEvent): string {
  switch (e.kind) {
    case "activity-sent":
      return `Sent ${e.artifactName}`;
    case "activity-rescinded":
      return `Took back ${e.artifactName}`;
    case "note-added":
      return `Added a note`;
    case "swap-started":
      return `Started ${e.artifactName}`;
    case "escalation-opened":
      return `Raised an escalation`;
    case "escalation-resolved":
      return `Resolved the escalation`;
  }
}

// ── Filler threads ──────────────────────────────────────────────────────────

/** TODO-DATA. Short exchanges for the teens a scenario is not about. Indexed by
 *  a stable hash of the teen id so a given teen always gets the same one — a
 *  roster whose previews reshuffle between renders is impossible to review. */
const FILLER: Array<[string, string]> = [
  ["How was the thing on Saturday?", "it was alright. my cousin came which was unexpected"],
  ["Did you end up going to practice?", "yeah coach put me in for the second half"],
  ["How did the presentation go?", "better than i thought honestly"],
  ["Still on for Thursday?", "yeah thursday works"],
  ["How are you doing with the new schedule?", "its a lot but im managing"],
  ["Did you get the book?", "started it last night actually"],
  ["How was your week?", "kind of long but ok"],
  ["How's the job hunt going?", "i have an interview next week"],
  ["Did your sister's thing go ahead?", "yeah she was so nervous it was funny"],
  ["Any word on the transfer?", "not yet. supposed to hear friday"],
  ["How's the ankle?", "way better. i can run on it now"],
  ["Did you talk to your teacher about the grade?", "i did and she moved it up two points"],
  ["What did you end up doing for the project?", "the one about local water. it took forever"],
  ["Is your dad back from the trip?", "sunday. the house is so quiet lol"],
  ["Did you decide about the summer program?", "im gonna apply. worst case they say no"],
  ["How did the driving test go?", "failed the parallel park. retaking it"],
];

/* ═══ SIXTEEN, NOT EIGHT, AND STRIDED ═══
   Eight pairs across fifteen teens guaranteed repeats, and they were VISIBLE in
   the list: Naomi and Ravi both previewed "yes! started it last night", Sam and
   Imani both "better than i thought honestly", Yuki and Caleb both "kind of long
   but ok". A conversation list where four rows say the same thing reads as a
   rendering fault, not as a caseload.
   Sixteen covers the roster with one spare, and the hash is strided so two
   adjacent teens do not land on adjacent entries. */

/* ═══ ASSIGNED BY ROSTER INDEX, NOT BY HASH ═══
   A hash into a sixteen-entry pool collides — measured: fourteen teens produced
   twelve distinct previews, so two pairs of rows said the same thing. That is the
   birthday problem, and widening the pool only makes it less likely rather than
   impossible.
   The roster's order is stable (`teensForMentor` filters a literal array), so the
   index is just as deterministic as a hash and collision-free by construction as
   long as the pool is at least as long as the roster. Asserted in
   __tests__/seed.test.ts, which fails on any duplicate rather than on a threshold. */

/** A two-or-three message thread positioned at the teen's REAL last-exchange
 *  stamps, so the list's order and its Check-in flags are the same facts the
 *  mentee table shows. */
function fillerThread(teen: DemoTeen, index: number, now: number): ChatMessage[] {
  const [mentorLine, teenLine] = FILLER[index % FILLER.length];
  const mentorAgo = (teen.mentorLastSentDaysAgo ?? 3) * 1440;
  const teenAgo = (teen.menteeLastSentDaysAgo ?? 3) * 1440;
  /* THE OLDER STAMP GOES FIRST, so the exchange reads as an exchange. The gap
     between them is the delta, which is what the `after` model needs — and which
     also means the two messages are positioned at the teen's REAL last-exchange
     stamps rather than at invented times. */
  const mentorFirst = mentorAgo >= teenAgo;
  const startsAgo = Math.max(mentorAgo, teenAgo);
  const gap = Math.max(1, Math.abs(mentorAgo - teenAgo));
  return messagesFrom(
    teen.id,
    startsAgo,
    mentorFirst
      ? [
          { from: "mentor", text: mentorLine },
          { from: "them", after: gap, text: teenLine },
        ]
      : [
          { from: "them", text: teenLine },
          { from: "mentor", after: gap, text: mentorLine },
        ],
    now
  );
}

// ── Support threads ─────────────────────────────────────────────────────────

function supportThreads(now: number): {
  messages: Record<ThreadId, ChatMessage[]>;
} {
  return {
    messages: {
      // TODO-COPY / TODO-DATA. The lead mentor — a working relationship, not a
      // help desk. This is what makes Support belonging in the same list obvious:
      // it is the same kind of conversation.
      "s-brandy": messagesFrom(
        "s-brandy",
        4 * 1440,
        [
          {
            from: "them",
            text: "Saw your note on Caleb — good catch on the sleep thing. Want to talk it through Thursday?",
          },
          {
            from: "mentor",
            after: 40,
            text: "Thursday works. I'll bring the last few weeks of messages.",
          },
          {
            from: "them",
            after: 2840,
            text: "One more thing — the re-match paperwork for Riley is done on my end. Nothing needed from you.",
          },
          { from: "mentor", after: 15, text: "Thanks for turning that around quickly." },
        ],
        now
      ),
      // The supervisor — used sparingly, which is true to the role.
      "s-stephen": messagesFrom(
        "s-stephen",
        21 * 1440,
        [
          {
            from: "them",
            text: "Welcome aboard properly. Brandy is your first stop for anything day to day, and I'm here for the things that can't wait.",
          },
          { from: "mentor", after: 90, text: "Understood. Thank you." },
        ],
        now
      ),
    },
  };
}

// ── The five scenarios ──────────────────────────────────────────────────────

interface ScenarioBuild {
  focusThreadId: ThreadId;
  /** Minutes before `now` that the focus thread's FIRST message was sent. */
  startsAgo: number;
  /** Authored dialogue, oldest first. Each line's `after` is minutes since the
   *  one above it — see `Line`. */
  lines: Line[];
  events?: (now: number) => ChatEvent[];
  /** ═══ AN ESCALATION IN THE FIXTURE, NOT ONLY IN THE STORE ═══
   *  The escalation scenario has to OPEN with a live escalation — the whole point
   *  is reviewing the mid-crisis state, and requiring somebody to raise one first
   *  would make it a state you can only reach by performing it. Merged with the
   *  store's own at read time, the same way events and artifacts are, so a mentor
   *  can also raise one on any other thread. */
  escalation?: (now: number) => EscalationState;
  artifacts?: (now: number) => SentArtifact[];
  /** Overrides for the focus teen's unread count, when the scenario is about
   *  something arriving. */
  unread?: number;
  emergency?: EmergencyInfo;
}

/** FRESH MATCH — Sam Karim, matched seven days ago. Two messages, both from the
 *  mentor's first reach-out. Every empty state on the surface is reachable here,
 *  and the emergency contact is deliberately ABSENT: intake has not finished, and
 *  a crisis view that has never been seen with missing data is a crisis view
 *  nobody has tested. */
const FRESH_MATCH: ScenarioBuild = {
  focusThreadId: "t14",
  startsAgo: 6 * 1440,
  lines: [
    {
      from: "mentor",
      text: "Hi Sam — I'm Dev, your mentor. No agenda today, I just wanted to say hello. What's been keeping you busy?",
    },
    { from: "them", after: 1240, text: "hi. mostly school and my brothers games" },
    { from: "mentor", after: 100, text: "What does he play?" },
    { from: "them", after: 40, text: "baseball. hes way better than me lol" },
  ],
  emergency: {
    teenPhone: "+13125550788",
    address: null,
    liveLocation: null,
    contact: null,
  },
};

/** ACTIVE MENTORSHIP — Caleb Ortiz, matched 171 days ago. The rich thread: text,
 *  a photo, a voice note, reactions, several days. This is the scenario the
 *  surface should be judged on. */
const ACTIVE: ScenarioBuild = {
  focusThreadId: "t18",
  startsAgo: 9 * 1440,
  lines: [
    { from: "mentor", text: "How did the chemistry retake go?" },
    { from: "them", after: 300, text: "got a B. i'll take it" },
    {
      from: "mentor",
      after: 20,
      text: "That's a real jump from last time. What did you do differently?",
      reactions: [{ emoji: "🙌", by: "them" }],
    },
    { from: "them", after: 40, text: "did the practice problems instead of just reading it" },
    // Two seconds later — a continuation, so the bubble drops its header. This is
    // the pair that exercises the clustering rule.
    { from: "them", after: 2, text: "which is what you said to do so" },
    { from: "mentor", after: 38, text: "I'll take the credit." },
    {
      from: "them",
      after: 7160,
      image: { w: 1200, h: 1600, alt: "A cat asleep on a stack of textbooks" },
    },
    { from: "them", after: 2, text: "study buddy" },
    {
      from: "mentor",
      after: 55,
      text: "Committed. What's her name?",
      reactions: [{ emoji: "😂", by: "them" }],
    },
    { from: "them", after: 10, text: "olive" },
    /* ═══ THE PAIR THAT STRADDLES THE CLUSTERING THRESHOLD (Phase 10) ═══
       TODO-DATA on both lines. `CLUSTER_MS` is five minutes, and MEASURED before
       this: the shipped chat fixtures held six consecutive same-sender pairs,
       with gaps of 2, 2, 2450, 3860 and 4320 MINUTES. Nothing anywhere near
       five — so no test in this repo could tell five minutes from six, and the
       Phase 6 de-fork's "the mentor thread is byte-identical" was verified on a
       snapshot that could not see a threshold change at all (gap row 429).
       FOUR THEN SIX, both from `them`: the first continues the cluster and drops
       its header, the second crosses the window and takes one. One pair, both
       sides of the line, on the thread the surface is meant to be judged on.
       THIS DOES CHANGE THE RENDERED THREAD, deliberately — Phase 6's constraint
       was that the DE-FORK not change it, which it did not. */
    { from: "them", after: 4, text: "she sits on whatever im reading" },
    { from: "them", after: 6, text: "anyway. thanks for the practice problem thing" },
    { from: "them", after: 2450, voice: 34 },
    {
      from: "mentor",
      after: 90,
      text: "That sounds like a lot to be carrying on your own. Do your parents know the schedule changed?",
    },
    { from: "them", after: 30, text: "not yet. im gonna tell them this weekend" },
    { from: "mentor", after: 1300, text: "How did the weekend conversation go?" },
    { from: "them", after: 1163, text: "went ok actually. my mom was more chill about it than i expected" },
  ],
  /* ═══ A FINISHED SET, WHICH IS WHAT OPENS DEEP THOUGHTS ═══
     171 days in with a completed Connection Cards behind them is exactly the
     relationship the lock is describing, so this is the scenario where the
     unlocked shelf should be seen. It also matches Caleb's own
     `completedActivities` fixture in people-demo, which has been standing in for
     an activity layer that did not exist until this build. */
  events: (now) => [
    {
      id: "ev-t18-1",
      threadId: "t18",
      at: now - 8 * DAY,
      kind: "activity-sent",
      actorId: LIVE_ID,
      artifactId: "art-t18-cards",
      artifactName: "Connection Cards", // TODO-COPY
    },
  ],
  artifacts: (now) => [
    {
      id: "art-t18-cards",
      threadId: "t18",
      activityId: "connection-cards",
      sentAt: now - 8 * DAY,
      items: [
        { id: "c1", text: "Something you're better at than you were a year ago" },
        { id: "c2", text: "A person who made this week easier" },
        { id: "c3", text: "Something small that went right" },
      ],
      completion: {
        openedAt: now - 8 * DAY + 3 * HOUR,
        completedItemIds: ["c1", "c2", "c3"],
      },
      rescindedAt: null,
    },
  ],
  emergency: {
    teenPhone: "+19089107001",
    address: "1412 Rosewood Ave, Charlotte, NC 28203",
    liveLocation: null,
    contact: { name: "Denise Ortiz", relation: "Mother", phone: "+19089107091" },
  },
};

/** ACTIVITIES IN FLIGHT — Elena Duarte. Three artifacts in three different
 *  states, which is the only way to see that the lifecycle is a lifecycle:
 *  sent-and-unopened (rescind is live), partly done, and a swap waiting on the
 *  mentor's own half. */
const IN_FLIGHT: ScenarioBuild = {
  focusThreadId: "t23",
  startsAgo: 6 * 1440,
  lines: [
    { from: "mentor", text: "I sent you a few questions — no rush on them." },
    { from: "them", after: 400, text: "ok ill look tonight" },
    { from: "them", after: 3860, text: "did the cards. the last one was hard" },
    { from: "mentor", after: 30, text: "Which one?" },
    { from: "them", after: 10, text: "the one about what id change" },
    {
      from: "mentor",
      after: 10,
      text: "We can leave that one. You don't have to finish a set for it to count.",
    },
    { from: "them", after: 3910, text: "sent you mine for the swap. your turn" },
  ],
  unread: 1,
  events: (now) => [
    {
      id: "ev-t23-1",
      threadId: "t23",
      at: now - 6 * DAY,
      kind: "activity-sent",
      actorId: LIVE_ID,
      artifactId: "art-t23-hot",
      artifactName: "Hot Takes", // TODO-COPY
    },
    {
      id: "ev-t23-2",
      threadId: "t23",
      at: now - 4 * DAY,
      kind: "activity-sent",
      actorId: LIVE_ID,
      artifactId: "art-t23-cards",
      artifactName: "Connection Cards",
    },
    {
      id: "ev-t23-3",
      threadId: "t23",
      at: now - 8 * HOUR,
      kind: "swap-started",
      actorId: "t23",
      artifactId: "art-t23-swap",
      artifactName: "a Swap",
    },
  ],
  artifacts: (now) => [
    {
      id: "art-t23-hot",
      threadId: "t23",
      activityId: "hot-takes",
      sentAt: now - 6 * DAY,
      items: [
        { id: "i1", text: "Pineapple on pizza: yes or no" },
        { id: "i2", text: "Best month of the year" },
        { id: "i3", text: "Mornings or nights" },
      ],
      // UNOPENED — which is what makes rescind eligible.
      completion: { openedAt: null, completedItemIds: [] },
      rescindedAt: null,
    },
    {
      id: "art-t23-cards",
      threadId: "t23",
      activityId: "connection-cards",
      sentAt: now - 4 * DAY,
      items: [
        { id: "c1", text: "Something you're better at than you were a year ago" },
        { id: "c2", text: "A person who made this week easier" },
        { id: "c3", text: "One thing you'd change about how this week went" },
      ],
      completion: { openedAt: now - 3 * DAY - 2 * HOUR, completedItemIds: ["c1", "c2"] },
      rescindedAt: null,
    },
    {
      id: "art-t23-swap",
      threadId: "t23",
      activityId: "swaps",
      sentAt: now - 8 * HOUR,
      items: [{ id: "s1", text: "Something that made you laugh this week" }],
      completion: { openedAt: now - 8 * HOUR, completedItemIds: ["s1"] },
      rescindedAt: null,
    },
  ],
  emergency: {
    teenPhone: "+19089107006",
    address: "88 Kestrel Row, Durham, NC 27703",
    liveLocation: null,
    contact: { name: "Marta Duarte", relation: "Mother", phone: "+19089107096" },
  },
};

/** ESCALATION ACTIVE — Jordan Tate. Already the record registry's
 *  `escalation-crisis` subject, so the two surfaces agree about who this is.
 *  Full emergency data, because the crisis view has to be seen working before it
 *  is seen degrading. */
const ESCALATION: ScenarioBuild = {
  focusThreadId: "t13",
  startsAgo: 2 * 1440,
  lines: [
    { from: "mentor", text: "Haven't heard from you in a bit. How's this week going?" },
    { from: "them", after: 2480, text: "not great honestly" },
    { from: "mentor", after: 20, text: "I'm here. What's going on?" },
    { from: "them", after: 80, text: "everything at home is bad again and i'm so tired of it" },
    // Four minutes later, same speaker — clusters under the line above it, which
    // is how a disclosure sent in two parts should read: one utterance.
    { from: "them", after: 4, text: "i don't know how much longer i can keep doing this" },
    {
      from: "mentor",
      after: 56,
      text: "Thank you for telling me that. I'm taking it seriously and I'm staying with you. Are you safe right now?",
    },
    { from: "them", after: 40, text: "i think so. i'm in my room" },
  ],
  unread: 0,
  events: (now) => [
    {
      id: "ev-t13-1",
      threadId: "t13",
      at: now - 235 * MINUTE,
      kind: "escalation-opened",
      actorId: LIVE_ID,
      artifactId: "esc-t13",
      artifactName: "an escalation",
    },
  ],
  emergency: {
    teenPhone: "+19089102201",
    address: "27 Halloway St, Apt 4B, Newark, NJ 07103",
    liveLocation: { label: "Home · shared 14 minutes ago", at: 0 },
    contact: { name: "Renata Tate", relation: "Aunt / guardian", phone: "+19089102291" },
  },
  /* PART-WAY THROUGH, which is the state worth reviewing: two steps covered, three
     not, the supervisor notified four minutes after it opened, and the anchor set to
     the message it was raised from. A fixture with a fresh escalation would only ever
     show the first frame. */
  escalation: (now) => ({
    id: "esc-t13",
    threadId: "t13",
    openedAt: now - 235 * MINUTE,
    anchorMessageId: "t13-m5",
    supervisorNotifiedAt: now - 231 * MINUTE,
    supervisorId: "s-brandy",
    assessment: {
      "safe-now": { checked: true, at: now - 220 * MINUTE },
      alone: { checked: true, at: now - 214 * MINUTE },
    },
    resolvedAt: null,
    resolutionNoteId: null,
    /* TIERING (pack v1.0): raised as a Tier 1 crisis, still awaiting a
       supervisor's confirmation on the placement, the safety check two
       answers in — the pack's "active Tier 1 with partial safety check". */
    requested: 1,
    /* TODO-COPY */
    contextNote: "Jordan said they don't know how much longer they can keep doing this. Things at home are bad again.",
    safetyCheck: {
      answers: {
        "cssrs-1": { value: "yes", at: now - 212 * MINUTE },
        "cssrs-2": { value: "no", at: now - 209 * MINUTE },
      },
      submittedAt: null,
    },
    outcomeId: null,
  }),
};

/** RE-MATCHED — Riley Moss, matched 40 days ago with a prior mentorship on
 *  record. The header carries the badge; the thread starts at the new match, and
 *  the fact that there IS history before it is the rail's job to say, not the
 *  thread's. */
const REMATCHED: ScenarioBuild = {
  focusThreadId: "t15",
  startsAgo: 38 * 1440,
  lines: [
    {
      from: "mentor",
      text: "Hi Riley — I'm Dev. I know you've done this once before, so tell me what worked and what didn't and we'll go from there.",
    },
    { from: "them", after: 1440, text: "hi. honestly it just kind of stopped" },
    {
      from: "mentor",
      after: 60,
      text: "That's fair to be annoyed about. What would you want to be different?",
    },
    { from: "them", after: 30, text: "idk just someone who actually answers" },
    { from: "mentor", after: 10, text: "I can do that." },
    { from: "them", after: 36000, text: "you were right about the tutoring thing btw" },
    { from: "mentor", after: 45, text: "Yeah? How's it going?" },
    { from: "them", after: 15, text: "the guy is kind of funny actually. it helps" },
    { from: "them", after: 4320, gif: { w: 480, h: 270, alt: "An animated thumbs up" } },
  ],
  /* TWO OF THREE ANSWERED — over the unlock threshold, which is the case the
     `>= 2` rather than "all" rule exists for. A teen who did most of a set has the
     habit the gate is checking for, and requiring every card would make the gate
     turn on somebody finishing a thing they were told they did not have to
     finish. */
  events: (now) => [
    {
      id: "ev-t15-1",
      threadId: "t15",
      at: now - 20 * DAY,
      kind: "activity-sent",
      actorId: LIVE_ID,
      artifactId: "art-t15-cards",
      artifactName: "Connection Cards",
    },
  ],
  artifacts: (now) => [
    {
      id: "art-t15-cards",
      threadId: "t15",
      activityId: "connection-cards",
      sentAt: now - 20 * DAY,
      items: [
        { id: "c1", text: "A thing you're looking forward to" },
        { id: "c2", text: "Something you'd want someone to notice about you" },
        { id: "c3", text: "A place you feel like yourself" },
      ],
      completion: {
        openedAt: now - 20 * DAY + 40 * MINUTE,
        completedItemIds: ["c1", "c3"],
      },
      rescindedAt: null,
    },
  ],
  emergency: {
    teenPhone: "+17078894102",
    address: "903 Larkin Way, Raleigh, NC 27604",
    liveLocation: null,
    contact: { name: "Paul Moss", relation: "Father", phone: "+17078894192" },
  },
};

// ── The registry ────────────────────────────────────────────────────────────

export interface ChatScenario {
  id: string;
  /** TODO-COPY — dev chrome, not product. */
  label: string;
  description: string;
  /** "real" — the roster record genuinely exhibits this. "shaped" — it was given
   *  data the fixtures cannot produce yet. Same convention as
   *  `lib/dev/record-scenarios.ts`, and the same reason: a reviewer looking at a
   *  screenshot needs to know which they are looking at. */
  data: "real" | "shaped";
  note?: string;
  build: ScenarioBuild;
}

export const CHAT_SCENARIOS: ChatScenario[] = [
  {
    id: "fresh-match",
    label: "Fresh match",
    description: "Sam, 7 days in. Every empty state, no emergency contact.",
    data: "real",
    build: FRESH_MATCH,
  },
  {
    id: "active-mentorship",
    label: "Active mentorship",
    description: "Caleb, 171 days. Photo, voice note, reactions.",
    data: "real",
    build: ACTIVE,
  },
  {
    id: "activities-in-flight",
    label: "Activities in flight",
    description: "Elena. Unopened, part-done, and a swap awaiting the mentor.",
    data: "shaped",
    note: "In-flight artifacts are exactly what no fixture in the repo can produce yet — that layer is this build.",
    build: IN_FLIGHT,
  },
  {
    id: "escalation-active",
    label: "Escalation active",
    description: "Jordan. Banner pinned, supervisor notified, full crisis data.",
    data: "real",
    build: ESCALATION,
  },
  {
    id: "re-matched",
    label: "Re-matched",
    description: "Riley, 40 days in with a prior mentorship on record.",
    data: "real",
    build: REMATCHED,
  },
];

export const DEFAULT_CHAT_SCENARIO_ID = "active-mentorship";

// ── The build ───────────────────────────────────────────────────────────────

function teenThread(teen: DemoTeen, messages: ChatMessage[], events: ChatEvent[], now: number): ChatThread {
  const recency = menteeRecency(teenAsMentee(teen, now), now);
  const last = messages[messages.length - 1];
  const lastEvent = events[events.length - 1];
  /* THE PREVIEW IS WHICHEVER HAPPENED LAST. An activity going out at 4pm should
     not be buried under a message from 11am — the row's job is to say what the
     state of this relationship is right now. */
  const eventWins = !!lastEvent && (!last || lastEvent.at > last.at);
  const at = eventWins ? lastEvent!.at : (last?.at ?? now - (teen.matchedDaysAgo ?? 0) * DAY);

  return {
    id: teen.id,
    kind: "teen",
    displayName: teenDisplayName(teen),
    // TODO-COPY. Age is not on the fixture, so the subtitle carries what IS
    // known rather than a computed age nobody stored. Pronouns when present.
    subtitle: teen.pronouns ?? "",
    avatarInitial: teenAvatarInitial(teen),
    ...(teen.pastMentors?.length ? { badge: "re-matched" as const } : {}),
    ...(recency.kind === "no-contact" ? { badge: "new-match" as const } : {}),
    ...(teen.menteeState === "paused" ? { badge: "paused" as const } : {}),
    lastActivityAt: at,
    preview: eventWins ? previewOfEvent(lastEvent!) : last ? previewOf(last) : "",
    previewFromMentor: eventWins ? lastEvent!.actorId === LIVE_ID : last?.sender === "mentor",
    unreadCount: 0,
    /* ═══ THE CHECK-IN RULE IS NOT NEW ═══
       `teen-quiet` is `mentees-demo.ts`'s own state, at its own
       `TEEN_QUIET_DAYS` threshold: the mentor wrote last and the teen has been
       silent since. It describes THE GAP, never the teen — which is why the
       filter reads "Check-in" and not any of the words this product does not
       use. `no-contact` is deliberately excluded: a pair matched last week with
       no messages yet is the expected beginning of every mentorship, and
       `mentees-demo` says so in its own comment. */
    needsCheckIn: recency.kind === "teen-quiet",
  };
}

function supportThread(id: string, messages: ChatMessage[]): ChatThread {
  const person = DEMO_PEOPLE.find((p) => p.id === id)!;
  const last = messages[messages.length - 1];
  return {
    id,
    kind: "support",
    displayName: person.name,
    // TODO-COPY. The role, because that is what a mentor needs to know about a
    // support contact — which of these two people to ask.
    subtitle: person.role === "supervisor" ? "Supervisor" : "Lead mentor",
    avatarInitial: person.name.charAt(0).toUpperCase(),
    lastActivityAt: last?.at ?? 0,
    preview: last ? previewOf(last) : "",
    previewFromMentor: last?.sender === "mentor",
    unreadCount: 0,
    needsCheckIn: false,
  };
}

/** Build a scenario. `now` is the caller's clock — see the module note. */
/** ═══ THE SCENARIO'S ESCALATIONS ALONE ═══ What `lib/tiering` reads, so the
 *  user record and Monitoring see the chat's escalation without building
 *  every thread. Keyed by thread id, which is the teen's record id. */
export function scenarioEscalations(id: string, now: number): Record<ThreadId, EscalationState> {
  const scenario = CHAT_SCENARIOS.find((s) => s.id === id);
  const e = scenario?.build.escalation?.(now);
  return e ? { [e.threadId]: e } : {};
}

/** The crisis escalation fixture, by itself — Monitoring's Alert scenarios
 *  raise the same one, so the two axes agree about who is in crisis. */
export const crisisEscalationFixture = (now: number): EscalationState => ESCALATION.escalation!(now);

export function chatScenario(id: string, now: number): ChatData {
  const scenario =
    CHAT_SCENARIOS.find((s) => s.id === id) ??
    CHAT_SCENARIOS.find((s) => s.id === DEFAULT_CHAT_SCENARIO_ID)!;
  const b = scenario.build;

  const messages: Record<ThreadId, ChatMessage[]> = {};
  const events: Record<ThreadId, ChatEvent[]> = {};
  const artifacts: Record<string, SentArtifact> = {};
  const emergency: Record<ThreadId, EmergencyInfo> = {};
  const escalations: Record<ThreadId, EscalationState> = {};
  const threads: ChatThread[] = [];

  // ── Teens ────────────────────────────────────────────────────────────────
  const roster = teensForMentor(LIVE_ID);
  roster.forEach((teen, i) => {
    const focus = teen.id === b.focusThreadId;
    messages[teen.id] = focus
      ? messagesFrom(teen.id, b.startsAgo, b.lines, now)
      : fillerThread(teen, i, now);
    events[teen.id] = focus ? (b.events?.(now) ?? []) : [];
    if (focus && b.emergency) emergency[teen.id] = b.emergency;
    const thread = teenThread(teen, messages[teen.id], events[teen.id], now);
    if (focus && b.unread !== undefined) thread.unreadCount = b.unread;
    /* ═══ UNREAD IS RECENT AND UNANSWERED, NOT MERELY UNANSWERED ═══
       The first rule was "the teen wrote last", which fired on ten of fifteen
       rows — a list where two thirds of the conversations carry a badge, which
       makes the badge mean nothing and the Unread filter a synonym for All. It
       was visible in the first screenshot and it is why the threshold exists.
       One day: a message from three weeks ago that nobody answered is not
       unread mail, it is a gap in the relationship — and the Check-in filter is
       the one that describes gaps. Keeping them distinct is what makes having
       both worthwhile. */
    const UNREAD_DAYS = 1;
    const theirs = teen.menteeLastSentDaysAgo ?? 99;
    if (!focus && theirs < (teen.mentorLastSentDaysAgo ?? 0) && theirs <= UNREAD_DAYS) {
      thread.unreadCount = 1;
    }
    threads.push(thread);
  });

  for (const a of b.artifacts?.(now) ?? []) artifacts[a.id] = a;
  if (b.escalation) {
    const e = b.escalation(now);
    escalations[e.threadId] = e;
  }

  // ── Support ──────────────────────────────────────────────────────────────
  const support = supportThreads(now);
  for (const id of SUPPORT_IDS) {
    messages[id] = support.messages[id] ?? [];
    events[id] = [];
    threads.push(supportThread(id, messages[id]));
  }
  // The lead's last message is unanswered in the escalation scenario — the
  // supervisor has acknowledged and is waiting on the mentor.
  if (scenario.id === "escalation-active") {
    /* ═══ THE SUPERVISOR'S GUIDANCE (Tiering & Escalation pack) ═══ What the
       Care tab quotes as "Latest from your supervisor" — her answer to the
       escalation, six minutes after it opened, and the one still unread. The
       Support panel reads this same thread, so the two agree. TODO-COPY. */
    const opened = now - 235 * MINUTE;
    messages["s-brandy"] = [
      ...(messages["s-brandy"] ?? []),
      {
        id: "s-brandy-esc-1",
        threadId: "s-brandy",
        at: opened + 6 * MINUTE,
        sender: "them",
        kind: "text",
        text: "I'm here and I've got your notes. Keep Jordan talking and ask if their aunt is home. I'm calling her now.",
      },
    ];
    const brandy = threads.find((t) => t.id === "s-brandy");
    if (brandy) brandy.unreadCount = 1;
  }

  return {
    threads: threads.sort((a, b2) => b2.lastActivityAt - a.lastActivityAt),
    messages,
    events,
    artifacts,
    emergency,
    escalations,
    focusThreadId: b.focusThreadId,
  };
}
