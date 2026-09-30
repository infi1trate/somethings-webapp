// ═══════════════════════════════════════════════════════════════════════════
// THE WHOLE-PAGE EMPTY STATE'S WORDS (report item 14)
//
// Three rule violations shipped in one small component and none of them was
// catchable by anything that existed:
//
//   · "No open tasks" — `Tasks` is the destination name the addendum RETIRED.
//   · "Every queue is clear." — MEASURED FALSE on §9's `care-open-empty`
//     fixture: it rendered while three risk flags were open, because its gate
//     counts one surface's domains and the sentence speaks for all of them.
//   · "Go to ongoing chats" — prohibited vocabulary. The banned list covers
//     "all messaging/conversation synonyms including 'chat'/'chats'".
//
// ═══ WHY A SOURCE TEST, AND WHY THIS FILE EXISTS AT ALL ═══
//
// THE COMPONENT IS CURRENTLY UNREACHABLE. `nothingOpen` gained
// `&& scope !== "care-reviews"` when §9 gave Care Reviews its own two empty
// states, and `TasksScope` has exactly one member — so no render, no snapshot
// and no probe can reach these strings. An unmounted component holding banned
// copy is a landmine: the day a second scope exists it ships as written.
//
// AND THE EXISTING GUARD COULD NOT HAVE CAUGHT IT. `scenarios.test.ts` has the
// BANNED pattern, applied to `TODAY_SCENARIOS` ids, labels and descriptions —
// scenario NAMES only. Nothing in this repo checks a component's visible copy,
// which is exactly how "ongoing chats" survived every pass. This closes the one
// component; the general gap is reported rather than papered over with a
// repo-wide scan that would drown in false positives from identifiers like
// `TaskItem` and hrefs like `/app/chat`.
//
// COMMENTS ARE STRIPPED FIRST. The notes in that component legitimately QUOTE
// all three retired strings to record what they replaced — the same reason
// `pinned.ts` and the greeting check strip comments before asserting. Without
// it this test would fail on its own explanation.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  join(process.cwd(), "src/components/tasks/tasks-page.tsx"),
  "utf8"
);

/** Block and line comments out, so a note may quote what it replaced. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** The component's body, comment-stripped. Narrow on purpose: a banned word
 *  elsewhere in this 1700-line file is a different finding and should not be
 *  reported by a test named for this one. */
const BODY = (() => {
  const clean = stripComments(SRC);
  const i = clean.indexOf("function WholePageEmpty");
  expect(i, "WholePageEmpty is gone — retarget or delete this test").toBeGreaterThan(-1);
  // To the next top-level declaration, which is enough to cover the JSX.
  const rest = clean.slice(i + 1);
  const j = rest.search(/\nfunction |\nexport /);
  return rest.slice(0, j > -1 ? j : rest.length);
})();

/** The visible strings: JSX text nodes and template/quoted literals. */
const WORDS = BODY.replace(/<[^>]*>/g, " ").replace(/[{}]/g, " ");

describe("the three strings that were wrong are gone", () => {
  it("does not say 'tasks' — the retired destination name", () => {
    expect(WORDS).not.toMatch(/\btasks?\b/i);
  });
  it("does not claim every queue is clear", () => {
    /* The overclaim, and any close variant of it. This component can only
       honestly speak for the list it is in. */
    expect(WORDS).not.toMatch(/every\s+queue/i);
    expect(WORDS).not.toMatch(/\ball\s+(queues|clear)\b/i);
  });
  it("uses no prohibited conversation synonym as a common noun", () => {
    /* Lower-case `chats`/`messages`/`texts` are the banned usage. `Chat`
       capitalised is the DESTINATION's own name (§2.2 renamed Coverage to
       Chat) and is permitted — the ban is on the things, not the place. */
    expect(WORDS).not.toMatch(/\b(chats|chatting|messages?|messaging|texts?|DMs?)\b/);
    expect(WORDS).not.toMatch(/\bchat\b/);
    expect(WORDS, "the destination name is allowed and expected").toMatch(/\bChat\b/);
  });
});

describe("what it says instead", () => {
  it("speaks only for the list it is in", () => {
    expect(WORDS).toMatch(/This list is empty right now/);
  });
  it("does not congratulate", () => {
    /* An empty queue is the resting state of this work rather than an
       achievement — the rule `CARE_TAB_EMPTY` and Today's all-clear subtitle
       both follow, and the one part of the old note that was right. */
    expect(WORDS).not.toMatch(/\b(nice work|well done|great job|you'?re all caught up|congrat)/i);
  });
  it("names the destination when it has one, and nothing when it does not", () => {
    /* The unscoped branch of `SCOPE_TITLE` falls back to "Tasks", so taking
       the label unconditionally would pipe the retired noun back in.
       ═══ THE FIRST VERSION OF THIS ASSERTION CHECKED NOTHING ═══
       It was `expect(BODY).toMatch(/label\s*\?/)`, which matches the PROP TYPE
       `label?: string` — so it passed with the ternary removed entirely.
       MUTATION-TESTED AND CAUGHT: dropping the guard left all seven green.
       What distinguishes the two states is the ELSE BRANCH existing, so that is
       what is asserted: the unlabelled fallback as its own literal. */
    expect(BODY).toMatch(/:\s*"Nothing is waiting"/);
    expect(BODY).toMatch(/label\s*\?\s*`Nothing is waiting in \$\{label\}`/);
  });
  it("every string it renders is marked for Nicole", () => {
    /* The copy protocol: no invented string ships unmarked. Checked against
       the RAW source, since the markers live in the comments this file's other
       assertions strip. */
    const raw = SRC.slice(SRC.indexOf("function WholePageEmpty"));
    const body = raw.slice(0, raw.search(/\nfunction |\nexport /) + 1 || raw.length);
    expect((body.match(/NEEDS-COPY-NICOLE/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(body, "TODO-COPY is the unmarked form the protocol replaces").not.toMatch(
      /TODO-COPY/
    );
  });
});
