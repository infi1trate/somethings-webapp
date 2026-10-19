import { describe, expect, it } from "vitest";
import { supportDirectory } from "../directory";
import { isLongMessage, runBreaks, supportThread } from "../threads";

const NOW = new Date(2026, 9, 16, 12, 0).getTime();
const MIN = 60_000;

describe("supportThread", () => {
  it("opens every row a mentor can see, and its last message is what the row previews", () => {
    for (const s of supportDirectory("mentor", "active-mentorship", NOW)) {
      for (const r of s.rows) {
        const t = supportThread(r.id, "mentor", "active-mentorship", NOW);
        expect(t, r.id).not.toBeNull();
        expect(t!.messages.at(-1)?.text, r.id).toBe(r.preview);
      }
    }
  });
  it("is empty for a lead mentor's supervisor, as the row says", () => {
    const t = supportThread("s-stephen", "lead-mentor", "active-mentorship", NOW);
    expect(t?.messages).toEqual([]);
    expect(t?.role).toBe("Supervisor");
  });
  it("is null for a row this persona cannot see", () => {
    expect(supportThread("c-fall-26", "admin", "active-mentorship", NOW)).toBeNull();
  });
  it("carries one long message in the default fixture", () => {
    const t = supportThread("c-fall-26", "mentor", "active-mentorship", NOW)!;
    expect(t.messages.filter((m) => isLongMessage(m.text))).toHaveLength(1);
  });
});

describe("runBreaks", () => {
  const m = (at: number, mine: boolean, author?: string) => ({ at, mine, author });
  it("breaks on sender, on author, and on a ten-minute gap", () => {
    const b = runBreaks([m(0, false, "A"), m(MIN, false, "A"), m(2 * MIN, false, "B"), m(3 * MIN, true), m(14 * MIN, true)]);
    expect(b.map((x) => [x.first, x.last])).toEqual([
      [true, false],
      [false, true],
      [true, true],
      [true, true],
      [true, true],
    ]);
  });
});
