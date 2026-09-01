// ONE SUGGESTION AT A TIME.
//
// ═══ WHY ONE ═══
//
// A list of five suggestions is a second to-do list, and a mentor with fourteen
// teens does not need another one. It also destroys the thing that makes a
// suggestion useful: if the surface offers five, none of them is a recommendation —
// the mentor is back to choosing, which is the work the panel was supposed to save.
//
// So: the highest-priority thing, with its reason, and two ways out. If they do it,
// the next one appears. If they dismiss it, the next one appears. Either way the
// panel is answering "what now" rather than "here are some options".
//
// ═══ EVERY SUGGESTION IS DERIVED FROM SOMETHING OBSERVABLE ═══
//
// Not from a model, and not from a score. Each rule below reads a fact the surface
// already holds — how long since the teen wrote, whether a sent set is sitting
// unopened, whether a swap is waiting on the mentor's own half — and the `because`
// line states that fact. A suggestion whose reason is "our system thinks" is a
// suggestion a mentor cannot check, and one they cannot check is one they will stop
// reading.
//
// ═══ THE ORDER IS A LADDER, NOT A SCORE ═══
//
// First match wins. A ladder is inspectable — anyone can read this file and say why
// a given suggestion appeared — where a weighted score is not, and on a surface
// where the suggestions concern a teenager, inspectable matters more than optimal.

import { menteeRecency, teenAsMentee } from "@/lib/record/mentees-demo";
import type { DemoTeen } from "@/lib/record/people-demo";
import { activityById } from "@/lib/chat/activities";
import type { ChatMessage, SentArtifact } from "@/lib/chat/types";

export interface Suggestion {
  id: string;
  /** What to do, as an instruction the mentor could act on without translating. */
  title: string;
  /** THE OBSERVABLE FACT this is based on. Present so a mentor can disagree with
   *  it — which is the difference between a suggestion and an instruction. */
  because: string;
  /** The action, when there is one the panel can take. Absent for suggestions whose
   *  action is "say something", which only the mentor can do. */
  action?: { kind: "open-toolkit" | "open-swap"; label: string };
}

export interface AssistInput {
  teen: DemoTeen;
  messages: ChatMessage[];
  artifacts: SentArtifact[];
  noteCount: number;
  now: number;
}

/** TODO-COPY throughout. */
export function suggestFor(input: AssistInput): Suggestion[] {
  const { teen, messages, artifacts, noteCount, now } = input;
  const out: Suggestion[] = [];
  const recency = menteeRecency(teenAsMentee(teen, now), now);
  const first = teen.firstName;

  // ── 1 · Nothing has been said yet ────────────────────────────────────────
  if (messages.length === 0 || recency.kind === "no-contact") {
    out.push({
      id: "say-hello",
      title: `Say hello to ${first}`,
      because: "You have been matched and neither of you has written yet.",
    });
  }

  // ── 2 · A swap is waiting on the mentor's own half ───────────────────────
  const openSwap = artifacts.find(
    (a) =>
      a.activityId === "swaps" &&
      !a.rescindedAt &&
      a.completion.completedItemIds.length > 0
  );
  if (openSwap) {
    out.push({
      id: "finish-swap",
      title: "Send your half of the swap",
      /* THE MOST ACTIONABLE KIND OF SUGGESTION: the teen has already done their
         part, so the only thing standing between them and a finished exchange is
         the mentor. */
      because: `${first} sent theirs and is waiting on you.`,
      action: { kind: "open-swap", label: "Open Swaps" },
    });
  }

  // ── 3 · The teen has gone quiet ──────────────────────────────────────────
  if (recency.kind === "teen-quiet") {
    out.push({
      id: "check-in",
      title: `Check in with ${first}`,
      /* THE FACT, WITH ITS NUMBER. "Has gone quiet" is a characterisation; "last
         wrote 9 days ago" is something a mentor can look at and judge. */
      because: `They last wrote ${recency.days} days ago.`,
      action: { kind: "open-toolkit", label: "Something to send" },
    });
  }

  // ── 4 · The mentor owes a reply ──────────────────────────────────────────
  if (recency.kind === "waiting-on-mentor") {
    out.push({
      id: "reply",
      title: `Reply to ${first}`,
      because: `They wrote ${recency.days} days ago and are waiting on you.`,
    });
  }

  // ── 5 · Something sent is sitting unopened ───────────────────────────────
  const unopened = artifacts.find(
    (a) => !a.rescindedAt && a.completion.openedAt === null
  );
  if (unopened) {
    out.push({
      id: "unopened",
      title: `Mention the ${activityById(unopened.activityId).name.toLowerCase()} you sent`,
      /* NOT "CHASE THEM". The suggestion is to bring it up in conversation, because
         a set that has been sitting unopened for three days is usually a set the
         teen has not seen rather than one they are refusing. */
      because: "It has not been opened yet, and a mention in the chat usually does it.",
    });
  }

  // ── 6 · A long relationship with nothing written down ────────────────────
  if (noteCount === 0 && (teen.matchedDaysAgo ?? 0) > 60 && messages.length > 6) {
    out.push({
      id: "first-note",
      title: "Write down something you have noticed",
      /* AIMED AT THE MENTOR'S OWN INTEREST, not at compliance. A mentor who has
         never written a note is not failing a process — they have nothing to hand
         their lead when a conversation gets hard, and that is the cost. */
      because: `Two months in with no notes. If ${first} has a hard week, this is what your lead would read.`,
    });
  }

  // ── 7 · Nothing is wrong ─────────────────────────────────────────────────
  if (out.length === 0) {
    out.push({
      id: "steady",
      title: "Nothing needs you here",
      /* ═══ AN EXPLICIT ALL-CLEAR, AND IT DOES NOT INVENT WORK ═══
         The temptation is to always have a suggestion, and it is the wrong
         instinct: a panel that manufactures a task for a healthy mentorship trains
         a mentor to ignore it. "Nothing needs you" is the most valuable thing this
         panel can say on thirteen of fourteen threads. */
      because: `You and ${first} are in regular contact and nothing is outstanding.`,
    });
  }

  return out;
}
