// THE FIVE ACTIVITIES.
//
// ═══ EVERY COVER RENDERS FROM THIS FILE, AND NOTHING IS HAND-LAID-OUT ═══
//
// The surface this replaces gave each activity its own card, and the five came out
// five different shapes: one named its purpose, one described its mechanic, one
// said neither, and the metadata line was prose written per activity — "3 cards",
// "about 2 minutes", nothing. A mentor comparing them could not, because they were
// not comparable.
//
// So `purpose`, `mechanic` and `meta` are separate fields with separate jobs, and
// `ActivityCover` formats all three. "Identical format across all five" is true by
// construction rather than by proofreading, and adding a sixth activity means
// adding a row here.
//
// ═══ THE THREE FIELDS ANSWER THREE DIFFERENT QUESTIONS ═══
//
//   purpose   why would I send this?          — one sentence, about the mentorship
//   mechanic  what happens if I do?           — mentor does X, teen receives Y
//   meta      how much is this asking of us?  — count, unit, minutes
//
// The legacy covers answered the second question and left the first and third to
// be guessed, which is backwards: a mentor with fourteen teens and eight minutes is
// deciding WHETHER, not HOW.
//
// ═══ LOCKED IS VISIBLE ═══
//
// Deep Thoughts needs groundwork before it lands well, so it sits on the shelf
// saying what unlocks it. Hidden means a mentor never learns it exists; greyed with
// no reason means they learn it exists and not how to get it.

import {
  Camera,
  Layers,
  MessageCircleQuestion,
  Sparkles,
  Zap,
} from "lucide-react";
import type { ActivityDef, ActivityId, SentArtifact } from "@/lib/chat/types";

/** ═══ THE ITEM POOLS ═══
 *
 *  TODO-COPY on every line. Written rather than generated, for the same reason the
 *  dialogue is: these are the actual words a fifteen-year-old will read, and the
 *  difference between a question that opens something and one that closes it is
 *  entirely in the wording.
 *
 *  Deliberately not probing. "What is something you are better at than a year ago"
 *  is answerable on a bad day; "what is your biggest regret" is an interview. A
 *  mentor should be able to send any of these without reading them first — which is
 *  the standard a pool like this has to meet, because some of them will. */
export const ITEM_POOL: Record<ActivityId, string[]> = {
  "hot-takes": [
    "Pineapple on pizza: yes or no",
    "Best month of the year",
    "Mornings or nights",
    "Cats or dogs, and you have to pick",
    "Worst chore in the house",
    "A song you would put on right now",
    "Beach or mountains",
    "The most overrated snack",
    "Text or call",
    "Summer break or winter break",
  ],
  "connection-cards": [
    "Something you're better at than you were a year ago",
    "A person who made this week easier",
    "One thing you'd change about how this week went",
    "Something small that went right",
    "A thing you're looking forward to",
    "Something you'd want someone to notice about you",
    "A place you feel like yourself",
    "Something you've changed your mind about",
  ],
  "deep-thoughts": [
    "What do you want to be different a year from now?",
    "When do you feel most like yourself?",
    "What's something you carry that nobody asks about?",
    "Who do you want to be for the people around you?",
    "What would you tell yourself two years ago?",
  ],
  swaps: [
    "Something that made you laugh this week",
    "Where you are right now",
    "Something you made",
    "The view from your window",
    "Something you're proud of",
    "Your setup, however messy",
  ],
  moments: [
    "A win this week, however small",
    "Something you want to remember",
    "A thing you finished",
  ],
};

export const ACTIVITIES: ActivityDef[] = [
  {
    id: "hot-takes",
    name: "Hot Takes", // TODO-COPY
    glyph: Zap,
    wash: "amber",
    purpose:
      "A low-stakes way in when a conversation has gone quiet, or when you have not met yet.",
    mechanic: "You pick the questions. They answer with a tap, in the chat.",
    meta: { count: 3, unit: "question", minutes: 2 },
  },
  {
    id: "connection-cards",
    name: "Connection Cards",
    glyph: Layers,
    wash: "sand",
    purpose:
      "Builds the habit of noticing how a week actually went, one card at a time.",
    mechanic: "You choose a set. They answer whichever ones they want to.",
    meta: { count: 3, unit: "card", minutes: 5 },
  },
  {
    id: "swaps",
    name: "Swaps",
    glyph: Camera,
    wash: "sage",
    purpose:
      "Shows a teen something about your life, which is usually what makes them share theirs.",
    mechanic: "You both send a photo on the same theme. Neither sees the other's first.",
    meta: { count: 1, unit: "theme", minutes: 1 },
  },
  {
    id: "moments",
    name: "Moments",
    glyph: Sparkles,
    wash: "clay",
    purpose:
      "Marks something worth remembering, so a good week is on the record and not just in it.",
    mechanic: "You invite them to capture one thing. It stays in the conversation.",
    meta: { count: 1, unit: "prompt", minutes: 1 },
  },
  {
    id: "deep-thoughts",
    name: "Deep Thoughts",
    glyph: MessageCircleQuestion,
    wash: "rose",
    purpose:
      "The questions worth asking once a teen trusts you enough to answer them properly.",
    mechanic: "You send one question. There is no format and no deadline for the answer.",
    meta: { count: 1, unit: "question", minutes: 10 },
    locked: {
      requires: ["connection-cards"],
      /* TODO-COPY. NAMES THE CONDITION AND WHY, in one sentence. "Locked" on its
         own teaches a mentor nothing; "complete a Connection Cards set first"
         teaches them the path but not the reason, and the reason is the part that
         stops this reading as an arbitrary gate. */
      microcopy:
        "Opens once you and they have finished a Connection Cards set — these questions land differently when there is already a habit of answering.",
    },
  },
];

export function activityById(id: ActivityId): ActivityDef {
  return ACTIVITIES.find((a) => a.id === id)!;
}

/** ═══ THE METADATA LINE, FORMATTED ONCE ═══
 *
 *  "3 questions · ~2 min". Pluralised from `count`, so no pool has to carry a
 *  plural, and the tilde is on the minutes because it is an estimate and the count
 *  is not — a mentor who reads "2 min" and takes four feels lied to about a number
 *  that was never precise.
 *
 *  TODO-COPY. */
export function metaLine(def: ActivityDef): string {
  const { count, unit, minutes } = def.meta;
  return `${count} ${unit}${count === 1 ? "" : "s"} · ~${minutes} min`;
}

/** ═══ WHETHER DEEP THOUGHTS IS OPEN YET ═══
 *
 *  The rule, stated once: a Connection Cards set exists that the teen has answered
 *  at least twice. Not "was sent" — sending is the mentor's act, and the gate is
 *  about whether the pair has a habit of ANSWERING, which is the thing that makes a
 *  deep question land rather than sit there.
 *
 *  `>= 2` rather than "all": a set the teen did most of counts. Requiring every
 *  card would make the gate turn on a teen finishing something they were explicitly
 *  told they did not have to finish, which the mentor's own copy in these fixtures
 *  says out loud. */
export const UNLOCK_ANSWERS = 2;

export function isUnlocked(
  def: ActivityDef,
  artifacts: SentArtifact[]
): boolean {
  if (!def.locked) return true;
  return def.locked.requires.every((required) =>
    artifacts.some(
      (a) =>
        a.activityId === required &&
        !a.rescindedAt &&
        a.completion.completedItemIds.length >= UNLOCK_ANSWERS
    )
  );
}

/** TODO-COPY. What a locked cover says when the requirement is partly met — a
 *  mentor who has sent a set and had one card answered is closer than one who has
 *  sent nothing, and a gate that cannot tell them apart is a gate that feels
 *  arbitrary. Returns null when there is no progress to report. */
export function unlockProgress(
  def: ActivityDef,
  artifacts: SentArtifact[]
): string | null {
  if (!def.locked) return null;
  const best = artifacts
    .filter((a) => def.locked!.requires.includes(a.activityId) && !a.rescindedAt)
    .reduce((n, a) => Math.max(n, a.completion.completedItemIds.length), 0);
  if (best === 0) return null;
  return `${best} of ${UNLOCK_ANSWERS} answered`;
}
