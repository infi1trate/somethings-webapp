// WHAT A TEEN HAS CHOSEN TO SHARE ABOUT THEMSELVES.
//
// ═══ THIS IS THE TEEN'S OWN CONTENT, AND IT IS RENDERED VERBATIM ═══
//
// The casing rule this build follows — no stylistic all-lowercase — governs PRODUCT
// CHROME: titles, labels, menu items, buttons. It does not govern a fifteen-year-old
// writing about themselves. So the strings below keep their own capitalisation, and
// the Profile panel renders them exactly as they are. Section headings above them
// are ours and get sentence case; the words inside are theirs and get nothing.
//
// It is also why nothing here is "improved". A teen who wrote "i wish more people
// knew that im actually funny" said that; a product that tidies it to "I wish more
// people knew that I'm actually funny" has quietly edited a person's self-description
// to match a style guide.
//
// ═══ TODO-DATA ═══
//
// Every string is invented. There is no teen-authored profile anywhere in this repo —
// `people-demo.ts` holds staff-visible facts (pronouns, group, tenure) and nothing a
// teen wrote. The real source is whatever the teen app collects at onboarding, and
// the shape below is the minimal honest projection of it: a few structured basics, a
// handful of things they have shared lately, and one or two prompts in their own
// words.
//
// The basics are DELIBERATELY THIN. Age and grade are the two facts a mentor
// actually needs and cannot infer, and a panel that listed twelve fields would be a
// form rather than a person.

import type { ThreadId } from "@/lib/chat/types";

export interface TeenProfile {
  /** Structured, and short. See the module note. */
  basics: Array<{ label: string; value: string }>;
  /** Things they have shared recently — captions on what would be photos if this
   *  prototype had any (Phase 0, conflict 8). The caption IS the content here. */
  lately: string[];
  /** A prompt and their answer, verbatim. */
  ownWords: Array<{ prompt: string; answer: string }>;
}

/** TODO-DATA on every entry. Only the live mentor's roster is covered; a teen with
 *  no entry gets the panel's honest empty state, which is the correct rendering of
 *  "they have not filled this in". */
export const TEEN_PROFILES: Record<ThreadId, TeenProfile> = {
  // Caleb Ortiz — the rich one, matched 171 days.
  t18: {
    basics: [
      { label: "Age", value: "16" },
      { label: "Grade", value: "11th" },
      { label: "Lives with", value: "Mum and younger sister" },
    ],
    lately: [
      "Olive asleep on my chem textbook",
      "The tomatoes I grew, which are ugly",
      "My sister's terrible drawing of me",
    ],
    ownWords: [
      {
        prompt: "I wish more people knew that…",
        answer: "im not actually quiet, i just take a while to start talking",
      },
      {
        prompt: "Something I'm good at",
        answer: "fixing bikes. my uncle taught me and now i do the whole street's",
      },
    ],
  },
  // Sam Karim — seven days in, so almost nothing yet. The state a Profile panel
  // has to handle well and usually is not designed for.
  t14: {
    basics: [
      { label: "Age", value: "15" },
      { label: "Grade", value: "9th" },
    ],
    lately: [],
    ownWords: [],
  },
  // Jordan Tate — the escalation thread. Sparse on purpose: what they have shared
  // is a mentor's only context in the moment they most need some.
  t13: {
    basics: [
      { label: "Age", value: "17" },
      { label: "Grade", value: "12th" },
      { label: "Lives with", value: "Aunt" },
    ],
    lately: ["The view from the fire escape"],
    ownWords: [
      {
        prompt: "Something that helps when things are hard",
        answer: "being outside. or music but loud enough that i cant think",
      },
    ],
  },
  // Riley Moss — re-matched, so their words carry the previous mentorship.
  t15: {
    basics: [
      { label: "Age", value: "16" },
      { label: "Grade", value: "10th" },
    ],
    lately: ["My tutor's whiteboard, covered", "New headphones"],
    ownWords: [
      {
        prompt: "What I want from a mentor",
        answer: "someone who actually answers. thats it really",
      },
    ],
  },
  // Elena Duarte — the activities scenario.
  t23: {
    basics: [
      { label: "Age", value: "15" },
      { label: "Grade", value: "10th" },
      { label: "Lives with", value: "Mum" },
    ],
    lately: ["My friend's dog wearing my hat", "Sunset from the bus"],
    ownWords: [
      {
        prompt: "Something I'm looking forward to",
        answer: "my cousin visiting in march. we havent seen each other in 2 years",
      },
    ],
  },
};

export function profileFor(threadId: ThreadId): TeenProfile | undefined {
  return TEEN_PROFILES[threadId];
}
