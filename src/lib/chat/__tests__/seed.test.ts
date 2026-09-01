// THE GUARD ON THE CHAT FIXTURES.
//
// ═══ THE TEST THAT EXISTS BECAUSE OF A SCREENSHOT ═══
//
// The first version of `seed.ts` gave each authored line an absolute age in
// minutes before `now`, which meant writing a descending sequence by hand — and
// three of the five scenarios got it wrong. The rendered result was a conversation
// in which the mentor answered a question before it was asked: Elena said "did the
// cards, the last one was hard", the mentor said "we can leave that one", and only
// then did she say which one she meant.
//
// It was found by looking at a screenshot, which is luck. What makes it not recur
// is the pair below: the model changed to accumulating deltas (so inversion is not
// expressible), and these assert that the rendered order IS the authored order and
// that nothing lands in the future. Either one alone would have caught it.

import { describe, expect, it } from "vitest";
import {
  CHAT_SCENARIOS,
  DEFAULT_CHAT_SCENARIO_ID,
  chatScenario,
} from "@/lib/chat/seed";
import { menteeRecency, teenAsMentee, TEEN_QUIET_DAYS } from "@/lib/record/mentees-demo";
import { teensForMentor } from "@/lib/record/people-demo";
import { LIVE_ID } from "@/lib/record/subject";
import { needsMeta } from "@/components/chat/thread/message-bubble";
import {
  ACTIVITIES,
  ITEM_POOL,
  isUnlocked,
  metaLine,
} from "@/lib/chat/activities";

/** A fixed instant. The builders take `now` as a parameter, so a test can pin it
 *  without the fixtures themselves being frozen. */
const NOW = new Date("2026-09-01T18:00:00.000Z").getTime();

const every = () =>
  CHAT_SCENARIOS.map((s) => ({ id: s.id, data: chatScenario(s.id, NOW) }));

describe("the chat fixtures are chronologically coherent", () => {
  it("every thread's messages are in ascending time order", () => {
    let checked = 0;
    for (const { id, data } of every()) {
      for (const [threadId, messages] of Object.entries(data.messages)) {
        checked += messages.length;
        const times = messages.map((m) => m.at);
        expect(
          times,
          `${id} / ${threadId}: rendered order is not chronological`
        ).toEqual([...times].sort((a, b) => a - b));
      }
    }
    // Guards against a vacuous sweep: if `messages` came back empty, every
    // assertion above would pass by iterating nothing.
    expect(checked, "no messages were checked").toBeGreaterThan(100);
  });

  it("no message is timed in the future", () => {
    // The delta model adds up, so an over-long scenario would run past `now` —
    // and a transcript with tomorrow's timestamp in it is the kind of detail that
    // makes a reader distrust everything else on the screen.
    for (const { id, data } of every()) {
      for (const [threadId, messages] of Object.entries(data.messages)) {
        for (const m of messages) {
          expect(m.at, `${id} / ${threadId} / ${m.id}`).toBeLessThanOrEqual(NOW);
        }
      }
    }
  });

  it("message ids carry their authored position, so order is auditable", () => {
    /* `-m1`, `-m2`, … in authored order. Not decoration: it is what lets the
       assertion above mean "the rendered order equals the ORDER SOMEBODY WROTE"
       rather than only "the timestamps happen to ascend". A sort could satisfy
       the first test and still have reordered the dialogue. */
    for (const { id, data } of every()) {
      for (const [threadId, messages] of Object.entries(data.messages)) {
        const positions = messages.map((m) => Number(m.id.split("-m")[1]));
        expect(positions, `${id} / ${threadId}`).toEqual(
          positions.map((_, i) => i + 1)
        );
      }
    }
  });

  it("is deterministic — the same scenario and instant build the same data", () => {
    for (const s of CHAT_SCENARIOS) {
      expect(chatScenario(s.id, NOW)).toEqual(chatScenario(s.id, NOW));
    }
  });

  it("an unknown scenario id falls back to the default rather than throwing", () => {
    expect(chatScenario("no-such-scenario", NOW)).toEqual(
      chatScenario(DEFAULT_CHAT_SCENARIO_ID, NOW)
    );
  });
});

describe("the roster is the one that already exists", () => {
  it("every teen thread is a teen already matched to the live mentor", () => {
    const roster = new Set(teensForMentor(LIVE_ID).map((t) => t.id));
    for (const { id, data } of every()) {
      const teens = data.threads.filter((t) => t.kind === "teen");
      expect(teens.length, id).toBe(roster.size);
      for (const t of teens) {
        expect(roster.has(t.id), `${id} / ${t.id} is not on the roster`).toBe(true);
      }
    }
  });

  it("every scenario's focus thread is in its own thread list", () => {
    // A focus id that names nobody would silently open the first thread instead,
    // and the scenario would demonstrate the wrong relationship.
    for (const { id, data } of every()) {
      expect(
        data.threads.some((t) => t.id === data.focusThreadId),
        `${id}: focus ${data.focusThreadId} is not in the list`
      ).toBe(true);
    }
  });

  it("every thread has messages, so no list row opens onto nothing", () => {
    for (const { id, data } of every()) {
      for (const t of data.threads) {
        expect(
          (data.messages[t.id] ?? []).length,
          `${id} / ${t.id} has no messages`
        ).toBeGreaterThan(0);
      }
    }
  });

  it("support threads are the mentor's real supervision edges", () => {
    // The live mentor reports to lead `s-brandy`, who reports to supervisor
    // `s-stephen` — stated in people-demo.ts. Not invented contacts.
    for (const { id, data } of every()) {
      const support = data.threads.filter((t) => t.kind === "support").map((t) => t.id);
      expect(support.sort(), id).toEqual(["s-brandy", "s-stephen"]);
    }
  });
});

describe("the list's derived state", () => {
  it("Check-in is mentees-demo's own teen-quiet state, not a second rule", () => {
    /* The whole point of deriving it: the chat list's Check-in filter and the
       mentee table's row chip must contain the same people. Re-deriving from the
       source here proves they cannot diverge — if someone adds a local threshold
       to seed.ts, this fails. */
    for (const { id, data } of every()) {
      for (const teen of teensForMentor(LIVE_ID)) {
        const thread = data.threads.find((t) => t.id === teen.id)!;
        const expected =
          menteeRecency(teenAsMentee(teen, NOW), NOW).kind === "teen-quiet";
        expect(thread.needsCheckIn, `${id} / ${teen.id}`).toBe(expected);
      }
    }
    // And the threshold is the shared constant, not a copy.
    expect(TEEN_QUIET_DAYS).toBeGreaterThan(0);
  });

  it("unread stays a minority of the list, or the badge means nothing", () => {
    /* MEASURED, NOT ASSERTED. The first rule was "the teen wrote last", which
       fired on ten of fifteen rows — a badge on two thirds of a list is not a
       signal, and the Unread filter became a synonym for All. Held at under half
       rather than at an exact count, so the fixtures can move without the test
       becoming a transcription of them. */
    for (const { id, data } of every()) {
      const teens = data.threads.filter((t) => t.kind === "teen");
      const unread = teens.filter((t) => t.unreadCount > 0).length;
      expect(unread, `${id}: ${unread} of ${teens.length} unread`).toBeLessThan(
        teens.length / 2
      );
    }
  });

  it("every scenario has something in Unread and something in Check-in", () => {
    // Both filters are visible in every scenario, so both need contents in every
    // scenario — a filter that is disabled in four of five is a filter nobody
    // reviews.
    for (const { id, data } of every()) {
      const teens = data.threads.filter((t) => t.kind === "teen");
      expect(teens.some((t) => t.unreadCount > 0), `${id}: nothing unread`).toBe(true);
      expect(teens.some((t) => t.needsCheckIn), `${id}: nothing to check in on`).toBe(true);
    }
  });

  it("threads are ordered by last activity, newest first", () => {
    for (const { id, data } of every()) {
      const times = data.threads.map((t) => t.lastActivityAt);
      expect(times, id).toEqual([...times].sort((a, b) => b - a));
    }
  });

  it("no two visible previews in a scenario are identical", () => {
    /* The filler pool had eight entries across fifteen teens, and the repeats
       were visible in the list: two rows reading "yes! started it last night",
       two reading "better than i thought honestly". A conversation list where
       four rows say the same thing reads as a rendering fault. */
    for (const { id, data } of every()) {
      const previews = data.threads
        .filter((t) => t.kind === "teen")
        .map((t) => t.preview);
      expect(new Set(previews).size, `${id}: duplicate previews`).toBe(previews.length);
    }
  });
});

describe("media and clustering", () => {
  it("every media message carries dimensions and alt text", () => {
    /* The frame is sized from `w`/`h` before the bytes arrive — that is the whole
       reason there is no spinner. A media record missing either would silently
       fall back to a zero-sized box. And `alt` is the only way a screen-reader
       user learns what a teen shared. */
    let media = 0;
    for (const { id, data } of every()) {
      for (const messages of Object.values(data.messages)) {
        for (const m of messages) {
          if (m.kind !== "image" && m.kind !== "gif") continue;
          media++;
          expect(m.media, `${id} / ${m.id}`).toBeDefined();
          expect(m.media!.w, `${id} / ${m.id}`).toBeGreaterThan(0);
          expect(m.media!.h, `${id} / ${m.id}`).toBeGreaterThan(0);
          expect(m.media!.alt.trim().length, `${id} / ${m.id}`).toBeGreaterThan(0);
        }
      }
    }
    expect(media, "no media messages were checked").toBeGreaterThan(0);
  });

  it("a voice message carries a duration", () => {
    let voice = 0;
    for (const { data } of every()) {
      for (const messages of Object.values(data.messages)) {
        for (const m of messages) {
          if (m.kind !== "voice") continue;
          voice++;
          expect(m.durationSec).toBeGreaterThan(0);
        }
      }
    }
    expect(voice, "no voice messages were checked").toBeGreaterThan(0);
  });

  it("the fixtures actually exercise timestamp clustering", () => {
    /* `needsMeta` drops a bubble's name-and-time header when a message continues
       the one above it. A fixture in which every message changes speaker or sits
       more than five minutes from its neighbour makes that live code unreachable
       — which is exactly what happened to the same rule on the Tasks excerpt
       before its own fixture was fixed. */
    let clustered = 0;
    for (const { data } of every()) {
      for (const messages of Object.values(data.messages)) {
        for (let i = 1; i < messages.length; i++) {
          if (!needsMeta(messages[i], messages[i - 1])) clustered++;
        }
      }
    }
    expect(clustered, "no message clusters under another").toBeGreaterThan(0);
  });
});

describe("the crisis data is deliberately incomplete somewhere", () => {
  it("the escalation scenario has full emergency information", () => {
    const data = chatScenario("escalation-active", NOW);
    const info = data.emergency[data.focusThreadId];
    expect(info).toBeDefined();
    expect(info.teenPhone).toBeTruthy();
    expect(info.address).toBeTruthy();
    expect(info.contact).toBeTruthy();
  });

  it("the fresh match has none of it, so the unavailable state is reachable", () => {
    /* The crisis view has to work when the data is thin, because that is when it
       gets opened. Making a scenario that genuinely lacks it is the difference
       between a designed empty state and one nobody has seen. */
    const data = chatScenario("fresh-match", NOW);
    const info = data.emergency[data.focusThreadId];
    expect(info).toBeDefined();
    expect(info.address).toBeNull();
    expect(info.contact).toBeNull();
    expect(info.liveLocation).toBeNull();
  });
});

describe("the vocabulary this product does not use", () => {
  it("no fixture string uses clinical or churn language", () => {
    /* The legacy build's own documentation entries read "Patient is depressed".
       These are the words that describe a person as a case: they do not appear in
       anything this surface renders. Checked against the serialised fixtures
       rather than by reading, because the fixture is where one would reappear. */
    const banned = [
      "patient",
      "caseload",
      "churn",
      "at-risk",
      "at risk",
      "lapsed",
      "retention",
      "engagement score",
    ];
    for (const { id, data } of every()) {
      const json = JSON.stringify(data).toLowerCase();
      for (const word of banned) {
        expect(json.includes(word), `${id} contains "${word}"`).toBe(false);
      }
    }
  });
});

// ── Activities ──────────────────────────────────────────────────────────────

describe("the activity definitions", () => {
  it("all five carry a purpose, a mechanic and structured meta", () => {
    /* THE DEFECT THIS PREVENTS: five hand-laid-out covers where one named its
       purpose, one described its mechanic, one said neither, and the metadata line
       was prose written per activity. Structured fields are what make the covers
       comparable, and a missing one would render an empty slot rather than fail. */
    for (const a of ACTIVITIES) {
      expect(a.purpose.trim().length, a.id).toBeGreaterThan(20);
      expect(a.mechanic.trim().length, a.id).toBeGreaterThan(20);
      expect(a.meta.count, a.id).toBeGreaterThan(0);
      expect(a.meta.unit.trim().length, a.id).toBeGreaterThan(0);
      expect(a.meta.minutes, a.id).toBeGreaterThan(0);
      // SINGULAR, because `metaLine` pluralises. A pool carrying "questions" would
      // render "3 questionss".
      expect(a.meta.unit.endsWith("s"), `${a.id}: unit must be singular`).toBe(false);
    }
    expect(ACTIVITIES.length).toBe(5);
  });

  it("every metadata line comes out in one format", () => {
    // The whole reason `meta` is structured. One formatter, so "3 questions · ~2
    // min" and "1 theme · ~1 min" cannot diverge in shape.
    for (const a of ACTIVITIES) {
      expect(metaLine(a), a.id).toMatch(/^\d+ \w+s? · ~\d+ min$/);
    }
  });

  it("each activity's pool holds at least as many prompts as its set needs", () => {
    // A deck shorter than the set means a mentor can never fill it, and the
    // builder's "the deck ends when the set is full" branch never fires.
    for (const a of ACTIVITIES) {
      expect(ITEM_POOL[a.id].length, a.id).toBeGreaterThanOrEqual(a.meta.count);
    }
  });

  it("exactly one activity is locked, and it says what opens it", () => {
    const locked = ACTIVITIES.filter((a) => a.locked);
    expect(locked.length).toBe(1);
    for (const a of locked) {
      expect(a.locked!.requires.length).toBeGreaterThan(0);
      // The microcopy has to name the CONDITION, not just say "locked" — a gate
      // that does not teach the path reads as arbitrary.
      expect(a.locked!.microcopy.length).toBeGreaterThan(40);
      for (const req of a.locked!.requires) {
        expect(ACTIVITIES.some((x) => x.id === req), `${a.id} requires ${req}`).toBe(true);
      }
    }
  });

  it("the lock reads answers, not sends", () => {
    /* The rule is about whether the pair has a habit of ANSWERING. A set that was
       sent and ignored must not open it, or the gate is measuring the mentor's
       activity rather than the relationship. */
    const deep = ACTIVITIES.find((a) => a.locked)!;
    const sentButIgnored = [
      {
        id: "x",
        threadId: "t1",
        activityId: "connection-cards" as const,
        sentAt: 0,
        items: [],
        completion: { openedAt: 1, completedItemIds: [] },
        rescindedAt: null,
      },
    ];
    expect(isUnlocked(deep, sentButIgnored)).toBe(false);
    const answered = [
      { ...sentButIgnored[0], completion: { openedAt: 1, completedItemIds: ["a", "b"] } },
    ];
    expect(isUnlocked(deep, answered)).toBe(true);
    // AND A RESCINDED SET DOES NOT COUNT. Taking something back cannot leave the
    // credit for it behind.
    expect(isUnlocked(deep, [{ ...answered[0], rescindedAt: 2 }])).toBe(false);
  });

  it("the lock is demonstrable in both directions across the scenarios", () => {
    /* A gate that is closed in every scenario is a gate nobody has seen open, and
       one that is open in every scenario is dead code. Both states have to be
       reachable from the dev harness. */
    const deep = ACTIVITIES.find((a) => a.locked)!;
    const states = every().map(({ id, data }) => {
      const own = Object.values(data.artifacts).filter(
        (a) => a.threadId === data.focusThreadId
      );
      return { id, open: isUnlocked(deep, own) };
    });
    expect(states.some((s) => s.open), "no scenario opens it").toBe(true);
    expect(states.some((s) => !s.open), "no scenario locks it").toBe(true);
  });
});
