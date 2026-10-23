// ═══════════════════════════════════════════════════════════════════════════
// STAY CLOSE — Ava's nudges while a mentor waits (pack v4.0, Workstream D)
//
// While the supervisor has the escalation, the mentor's job is to stay with
// the teen. These are 2–3 short, warm lines a mentor MIGHT send, grounded in
// what the teen actually said in this thread.
//
// ═══ THE RULES, ENFORCED HERE ═══
//   never clinical   no assessment language, no risk words, no advice about
//                    safety — `CLINICAL` is a guard every nudge must pass,
//                    and a nudge that fails it is dropped, not rewritten
//   never auto-sent  a nudge goes into the message box, editable; the mentor
//                    sends it or does not
//   never persisted  derived at render from the thread's lines; nothing here
//                    writes to a record, and "used" is component state only
//
// A FAKE AI, like the debrief draft: deterministic templates keyed on topics
// the teen raised. TODO-COPY, every line.

export interface StayNudge {
  id: string;
  text: string;
}

/** Words a nudge must never contain. Clinical or crisis language is the
 *  supervisor's — a mentor's waiting line is presence, not assessment. */
export const CLINICAL =
  /\b(suicid\w*|kill\w*|die|dying|dead|death|harm\w*|hurt yourself|safe(ty)?|plan\w*|risk\w*|assess\w*|crisis|emergency|911|988|hospital|diagnos\w*|therap\w*|medic\w*|pills?)\b/i;

const TOPICS: { id: string; match: RegExp; text: (name: string) => string }[] = [
  { id: "home", match: /\b(home|mom|dad|parents?|family|brother|sister)\b/i, text: () => "You said things at home are hard again. I'm listening if you want to tell me more." },
  { id: "tired", match: /\b(tired|exhausted|sleep|worn out)\b/i, text: () => "Being that tired is a lot to carry. You don't have to explain anything right now." },
  { id: "school", match: /\b(school|class|teacher|test|homework)\b/i, text: () => "School sounds like it's piling on too. What's been the worst part this week?" },
  { id: "alone", match: /\b(alone|lonely|nobody|no one)\b/i, text: (n) => `You're not on your own with this, ${n}. I'm right here.` },
  { id: "friends", match: /\b(friends?|they all)\b/i, text: () => "That sounds really lonely. Who's been around for you lately?" },
];

/** Always available, last: presence, in the mentor's voice. */
const STEADY = (name: string): StayNudge => ({ id: "here", text: `I'm still here with you, ${name}. Take all the time you need.` });

/** 2–3 nudges, grounded in the teen's most recent lines first. */
export function stayCloseNudges(teenLines: readonly string[], name: string): StayNudge[] {
  const recent = [...teenLines].reverse();
  const out: StayNudge[] = [];
  for (const line of recent) {
    for (const t of TOPICS) {
      if (out.length >= 2) break;
      if (t.match.test(line) && !out.some((n) => n.id === t.id)) out.push({ id: t.id, text: t.text(name) });
    }
  }
  /* Grounded in nothing the teen said: a thanks, so the set is never one line. */
  if (out.length === 0) out.push({ id: "thanks", text: "Thank you for telling me. I'm glad you did." });
  out.push(STEADY(name));
  return out.filter((n) => !CLINICAL.test(n.text)).slice(0, 3);
}

/** ═══ THE STEADYING LINE ═══ One at a time, rotating, for the mentor —
 *  never sent, never stored. */
export const STEADYING_LINES: readonly string[] = [
  "You're doing the right thing by staying.",
  "Short, warm messages are enough right now.",
  "You don't have to fix this. Being here is the help.",
];
export const STEADYING_EVERY_MS = 12_000;
