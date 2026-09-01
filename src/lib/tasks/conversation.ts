// THE CONVERSATION BEHIND A FLAG — seeded fixtures, not a fetch.
//
// ═══ WHY A FIXTURE MODULE AND NOT A PAYLOAD FIELD ═══
//
// `RiskFlagPayload.flaggedExcerpt` is one string, and the pane used to render it
// as a styled quote. A quote answers "what was said"; a supervisor deciding
// whether a flag was raised correctly is asking something else — "what was said
// AROUND it". A single line cannot answer that, and neither can a field: the
// surrounding messages are a different shape from the item.
//
// So the conversation lives here, derived from the item rather than stored on it.
// That keeps the locked rule intact — no message content in list rows, ever,
// because a row has no reason to call this — while giving the pane the context it
// needs.
//
// ═══ THE FLAGGED LINE IS THE ITEM'S OWN STRING, NOT A COPY ═══
//
// `buildConversation` takes the excerpt and places it verbatim at the anchor. If
// it were re-authored here the fixture would drift from the pane's other blocks —
// the AI rationale quotes the flag, and a supervisor reading a rationale about a
// sentence that appears nowhere in the transcript would rightly stop trusting the
// screen. One string, two renderings.
//
// ═══ DETERMINISTIC, BECAUSE A PROTOTYPE IS DEMONSTRATED REPEATEDLY ═══
//
// Everything is seeded off the item id. The same flag shows the same
// conversation on every reload and in every screenshot, which is what makes a
// screenshot evidence rather than an anecdote. No `Math.random`, no `Date.now`
// inside the builder — the clock arrives as an argument, the same discipline
// `tasksScenario` holds to.

import type { TaskItem } from "@/lib/tasks/types";

const SECOND = 1_000;
const MINUTE = 60_000;

export type MessageSender = "teen" | "mentor";

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  /** FIRST NAME ONLY for the teen — the surface's rule, and the pane already
   *  holds `teenDisplayName` ("Riley T."), so the first token is taken from it
   *  rather than re-derived from an id nobody here owns. */
  senderName: string;
  at: number;
  text: string;
  /** The one message the flag is about. Exactly one per conversation. */
  flagged?: boolean;
}

export interface Conversation {
  /** The anchor — the message the excerpt opens scrolled to. */
  anchorId: string;
  messages: ConversationMessage[];
  /** True when the fixture is the whole conversation we have. Drives the quiet
   *  edge marker; there is no pagination in v1. */
  truncatedStart: boolean;
}

/** ±15 messages, per the brief. Kept as a named constant because the number is a
 *  product decision (enough to scroll, short enough to feel instant) rather than
 *  an implementation detail. */
export const CONTEXT_BEFORE = 15;
export const CONTEXT_AFTER = 15;

/** A tiny deterministic hash, so a fixture is stable per item and different
 *  between items. Same shape the seed module uses. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** ═══ ORDINARY CONVERSATION, DELIBERATELY ═══
 *
 *  The filler is mundane on purpose. A supervisor's judgement about whether a
 *  flag was raised correctly depends on the flagged line standing out from what
 *  surrounds it — if every message were dramatic the excerpt would teach nothing,
 *  and if the fixture were lorem ipsum it would read as a placeholder rather than
 *  as a conversation. These are the shapes teen–mentor check-ins actually take.
 *
 *  NOTHING HERE IS CLINICAL. No symptoms, no diagnoses, no crisis language: the
 *  flagged line carries whatever weight the item has, and inventing more around
 *  it would put words in a fictional teen's mouth that the item never claimed. */
const TEEN_LINES = [
  "hey sorry i missed the last one",
  "yeah that week was a lot",
  "i had a test thursday so i was up late",
  "kinda tired but ok",
  "my mom keeps asking about it",
  "idk it's fine",
  "we lost 3–1 lol",
  "i might try out for the spring team",
  "yeah maybe",
  "that sounds good",
  "can we do later next week?",
  "ok",
  "i finished the thing i was telling you about",
  "not really, i just kept putting it off",
  "thanks",
];

const MENTOR_LINES = [
  "no worries at all — how did the week end up?",
  "that sounds like a lot to carry",
  "did you get any rest after?",
  "makes sense. anything you want to pick up next time?",
  "what did you tell her?",
  "fair enough. I'm around if it stops being fine",
  "ha, still counts. how did you play?",
  "that's a big step — when are tryouts?",
  "no pressure either way",
  "great. same time next week?",
  "sure, what day works?",
  "sounds good, I'll send an invite",
  "nice, how did it feel to finish it?",
  "that happens. glad it's done",
  "anytime",
];

/** The teen's first name, from the pre-formatted display name ("Riley T." →
 *  "Riley"). The rule that a surname never reaches this surface is enforced at
 *  the item; this only has to avoid undoing it. */
export function firstNameOf(displayName: string): string {
  return displayName.split(" ")[0] ?? displayName;
}

/** Build the conversation for one flagged item.
 *
 *  `anchorText` is the message the flag is about — passed in rather than read off
 *  the item, so an escalation (which has no `flaggedExcerpt`) can anchor to its
 *  own triggering moment through the same builder. When it is null the anchor is
 *  the most recent message, which is the brief's fallback for escalations whose
 *  fixture carries no triggering line. */
export function buildConversation(
  item: TaskItem,
  anchorText: string | null,
  now: number
): Conversation {
  const seed = hash(item.id);
  const teenName = firstNameOf(item.teenDisplayName);
  const mentorName = firstNameOf(item.mentorName);

  // The flagged message sits at `openedAt` — the moment the flag was raised is
  // the moment the message arrived, which is what makes the timestamps in the
  // excerpt reconcile with the pane's own "opened" line.
  const anchorAt = item.openedAt;

  /** ═══ GAPS ACCUMULATE; THEY ARE NOT MULTIPLIED ═══
   *
   *  This was `anchorAt - i * (4min + ((seed + i) % 7)min)`, which is NOT
   *  monotonic in `i`: the jitter term varies per step, so a message 10 steps back
   *  could land later than one 9 steps back and the transcript rendered out of
   *  order. Caught by the ordering test rather than by eye — the timestamps are
   *  minutes apart and the lines are plausible either way, which is exactly the
   *  kind of wrong that survives a look.
   *
   *  Walking backwards and SUBTRACTING each gap is monotonic by construction: the
   *  jitter can vary as much as it likes and the order still holds. */
  /* ═══ PEOPLE SEND TWO IN A ROW, AND THE FIXTURE DID NOT ═══
   *
   *  This alternated strictly — teen, mentor, teen, mentor, for thirty messages.
   *  MEASURED against the pane's timestamp clustering: 20 of 20 bubbles carried a
   *  header, because the sender changed on every single line, so the clustering
   *  rule was live code that could never fire.
   *
   *  The right conclusion was that the FIXTURE was wrong, not the rule. Nobody
   *  texts in perfect turns. A teen types a thought, then the rest of it eight
   *  seconds later; a mentor sends a question and then softens it. That is what a
   *  supervisor reading a real transcript sees, and it changes how the excerpt
   *  reads — a burst is one utterance, and splitting it into two headed bubbles
   *  makes a hesitant sentence look like two separate disclosures.
   *
   *  So a run is 1 or 2 messages, decided by the seed. Deterministic, and the
   *  invariant that survives is the one that matters: the message immediately
   *  before the anchor is still the MENTOR's, because a flagged teen message
   *  almost always answers something.
   *
   *  Within a run the gap is well under the clustering threshold (30–90s) and
   *  between runs it is well over (4–10min), so the rule is exercised in both
   *  directions rather than sitting near its boundary. */
  const before: ConversationMessage[] = [];
  let cursor = anchorAt;
  let sender: MessageSender = "mentor";
  /** How many MORE messages this speaker still owes after the current one. A
   *  counter of the extras rather than of the run length: the first draft counted
   *  the run and asked `runLeft > 1` on the NEXT iteration, by which point it had
   *  already been decremented to 1 — so the condition was never true and the
   *  fixture alternated exactly as strictly as before. Caught by the test, which
   *  reported zero consecutive pairs across sixty conversations; both versions
   *  render a perfectly plausible transcript, so nothing about looking at it
   *  would have shown the difference. */
  let extra = 0;
  for (let i = 1; i <= CONTEXT_BEFORE; i++) {
    const continuing = i > 1 && extra > 0;
    if (continuing) {
      extra -= 1;
    } else if (i > 1) {
      sender = sender === "mentor" ? "teen" : "mentor";
      // Roughly one turn in three is two messages. Seeded, so it is stable per
      // item and varies between items.
      extra = (seed + i * 7) % 3 === 0 ? 1 : 0;
    }
    const pool = sender === "teen" ? TEEN_LINES : MENTOR_LINES;
    // Spacing varies a little so the column does not read as a metronome.
    cursor -= continuing
      ? 30 * SECOND + ((seed + i) % 60) * SECOND
      : 4 * MINUTE + ((seed + i) % 7) * MINUTE;
    before.push({
      id: `${item.id}-m-b${i}`,
      sender,
      senderName: sender === "teen" ? teenName : mentorName,
      at: cursor,
      text: pool[(seed + i) % pool.length],
    });
  }
  // Built newest-first while walking back, so flip to chronological.
  before.reverse();

  const anchor: ConversationMessage = {
    id: `${item.id}-m-anchor`,
    sender: "teen",
    senderName: teenName,
    at: anchorAt,
    // VERBATIM. See the module note — the rationale quotes this same string.
    text: anchorText ?? TEEN_LINES[seed % TEEN_LINES.length],
    flagged: anchorText !== null,
  };

  const after: ConversationMessage[] = [];
  let fwdSender: MessageSender = "mentor";
  let fwdExtra = 0;
  // AFTER THE FLAG THE CONVERSATION THINS OUT, which is true to life and also
  // true to the data: the flag is recent, so there has not been much since. The
  // count is seeded so it varies per item without varying per render.
  const afterCount = Math.min(CONTEXT_AFTER, 2 + (seed % 5));
  let fwd = anchorAt;
  for (let i = 1; i <= afterCount; i++) {
    const continuing = i > 1 && fwdExtra > 0;
    if (continuing) {
      fwdExtra -= 1;
    } else if (i > 1) {
      fwdSender = fwdSender === "mentor" ? "teen" : "mentor";
      fwdExtra = (seed + i * 5) % 3 === 0 ? 1 : 0;
    }
    const sender = fwdSender;
    const pool = sender === "teen" ? TEEN_LINES : MENTOR_LINES;
    // Same accumulation as above, for the same reason.
    fwd += continuing
      ? 40 * SECOND + ((seed + i) % 50) * SECOND
      : 6 * MINUTE + ((seed + i) % 5) * MINUTE;
    const at = fwd;
    // NEVER IN THE FUTURE. A transcript with tomorrow's timestamp in it is the
    // kind of detail that makes a reader distrust everything else on the screen.
    if (at > now) break;
    after.push({
      id: `${item.id}-m-a${i}`,
      sender,
      senderName: sender === "teen" ? teenName : mentorName,
      at,
      text: pool[(seed + i + 3) % pool.length],
    });
  }

  return {
    anchorId: anchor.id,
    messages: [...before, anchor, ...after],
    // Always true in v1: the fixture is a window, never the whole thread, and
    // saying so is what the edge marker is for.
    truncatedStart: true,
  };
}

/** ═══ THE DEEP LINK ═══
 *
 *  `chatHrefFor` owns the chat URL shape; this adds the message anchor so the
 *  eventual thread view can scroll to the right line.
 *
 *  THE ANCHOR IS NOT HONOURED YET. There is no `/app/chat` route — the path
 *  resolves through the `[section]` catch-all — so `?msg=` is carried and
 *  ignored. That is deliberate rather than deferred: emitting the parameter now
 *  means the chat surface can start reading it without every call site changing,
 *  and a link that lands on the right conversation is already better than one
 *  that lands nowhere. Logged as a gap. */
export function conversationHref(teenId: string, messageId: string): string {
  return `/app/chat?with=${encodeURIComponent(teenId)}&msg=${encodeURIComponent(messageId)}`;
}
