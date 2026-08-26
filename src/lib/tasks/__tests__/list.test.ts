// THE GUARD ON §4's COALESCING.
//
// The properties that matter and are easy to lose:
//   · a group sits exactly where its head would have — no second sort
//   · groups never span domains
//   · only FLAGS coalesce
//   · a group of one is a plain row
//   · resolving a child is derived, so the group recomputes without bookkeeping

import { describe, expect, it } from "vitest";
import { coalesceLabel, isFlagTask, itemsOf, listEntriesFor, paneItemFor } from "@/lib/tasks/list";
import { listForDomain } from "@/lib/tasks/sort";
import { tasksScenario } from "@/lib/tasks/seed";
import { DOMAIN_OF_TYPE, type TaskItem } from "@/lib/tasks/types";

const NOW = new Date("2026-08-26T20:05:00.000Z").getTime();
const HEAVY = () => tasksScenario("heavy-caseload", NOW);

describe("§4 — coalescing", () => {
  it("five red flags on one conversation collapse to one group row", () => {
    const entries = listEntriesFor(HEAVY(), "riskFlag", NOW);
    const group = entries.find((e) => e.kind === "group" && e.members.length === 5);
    expect(group).toBeDefined();
    expect(group!.kind).toBe("group");
    if (group!.kind === "group") {
      expect(group!.members.every((m) => m.taskType === "redFlagReview")).toBe(true);
      expect(new Set(group!.members.map((m) => m.objectId)).size).toBe(1);
    }
  });

  it("the group sits exactly where its head would have in the flat sort", () => {
    // No second ordering: if a group's position differed from its head's, some
    // other comparator would be involved.
    const items = HEAVY();
    const flat = listForDomain(items, "riskFlag", NOW);
    const entries = listEntriesFor(items, "riskFlag", NOW);
    // The first entry's pane item must be the first item of the flat list.
    expect(paneItemFor(entries[0]).id).toBe(flat[0].id);
    // And every entry's head must appear in the flat list in the same relative
    // order as the entries.
    const headPositions = entries.map((e) =>
      flat.findIndex((i) => i.id === paneItemFor(e).id)
    );
    expect(headPositions).toEqual([...headPositions].sort((a, b) => a - b));
  });

  it("a group's head is its highest-priority child", () => {
    const entries = listEntriesFor(HEAVY(), "riskFlag", NOW);
    for (const e of entries) {
      if (e.kind !== "group") continue;
      // Members are in comparator order, so the head is members[0].
      expect(e.head.id).toBe(e.members[0].id);
      expect(paneItemFor(e).id).toBe(e.members[0].id);
    }
  });

  it("groups never span domains", () => {
    const items = HEAVY();
    for (const domain of ["escalation", "riskFlag", "billing", "monitoring"] as const) {
      for (const e of listEntriesFor(items, domain, NOW)) {
        for (const member of itemsOf(e)) {
          expect(member.domain, `${domain}/${e.id}`).toBe(domain);
          expect(DOMAIN_OF_TYPE[member.taskType]).toBe(domain);
        }
      }
    }
  });

  it("a group's members all share one task type, so red and orange never merge", () => {
    // taskType is half the key. A key that dropped it would put a red and an
    // orange flag on the same conversation into one row, which is two different
    // jobs in one row.
    const entries = listEntriesFor(HEAVY(), "riskFlag", NOW);
    for (const e of entries) {
      if (e.kind !== "group") continue;
      expect(new Set(e.members.map((m) => m.taskType)).size).toBe(1);
    }
  });

  it("only flags coalesce — billing and escalations are always plain rows", () => {
    const items = HEAVY();
    for (const domain of ["billing", "escalation"] as const) {
      for (const e of listEntriesFor(items, domain, NOW)) {
        expect(e.kind, `${domain}/${e.id}`).toBe("item");
      }
    }
    expect(isFlagTask("intakeBillingReview")).toBe(false);
    expect(isFlagTask("activeEscalation")).toBe(false);
    expect(isFlagTask("redFlagReview")).toBe(true);
    expect(isFlagTask("standardFlagReview")).toBe(true);
  });

  it("a group of one is emitted as a plain row, not a group with a dead disclosure", () => {
    const items = HEAVY();
    const entries = listEntriesFor(items, "riskFlag", NOW);
    // heavy-caseload has one ungrouped orange flag on its own conversation.
    const solo = entries.find(
      (e) => e.kind === "item" && e.item.taskType === "orangeFlagReview"
    );
    expect(solo).toBeDefined();
    for (const e of entries) {
      if (e.kind === "group") expect(e.members.length).toBeGreaterThan(1);
    }
  });

  it("every open item in a domain appears exactly once across the entries", () => {
    // Nothing dropped and nothing duplicated — the property a grouping pass is
    // most likely to break.
    const items = HEAVY();
    for (const domain of ["escalation", "riskFlag", "billing", "monitoring"] as const) {
      const flat = listForDomain(items, domain, NOW).map((i) => i.id).sort();
      const viaEntries = listEntriesFor(items, domain, NOW)
        .flatMap(itemsOf)
        .map((i) => i.id)
        .sort();
      expect(viaEntries, domain).toEqual(flat);
    }
  });
});

describe("§4 — resolving is derived, so groups need no bookkeeping", () => {
  const resolve = (items: TaskItem[], id: string): TaskItem[] =>
    items.map((i) => (i.id === id ? { ...i, status: "resolved" as const } : i));

  it("resolving a child shrinks the group's count", () => {
    let items = HEAVY();
    const before = listEntriesFor(items, "riskFlag", NOW).find(
      (e) => e.kind === "group" && e.members.length === 5
    )!;
    if (before.kind !== "group") throw new Error("expected a group");
    items = resolve(items, before.members[0].id);
    const after = listEntriesFor(items, "riskFlag", NOW).find(
      (e) => e.kind === "group" && e.members.length === 4
    );
    expect(after).toBeDefined();
  });

  it("resolving down to one member turns the group into a plain row", () => {
    let items = HEAVY();
    const group = listEntriesFor(items, "riskFlag", NOW).find(
      (e) => e.kind === "group" && e.members.length === 5
    )!;
    if (group.kind !== "group") throw new Error("expected a group");
    const survivor = group.members[4];
    for (const m of group.members.slice(0, 4)) items = resolve(items, m.id);
    const entries = listEntriesFor(items, "riskFlag", NOW);
    const asItem = entries.find(
      (e) => e.kind === "item" && e.item.id === survivor.id
    );
    expect(asItem).toBeDefined();
    // And there is no group left holding it.
    expect(entries.some((e) => e.kind === "group" && e.members.some((m) => m.id === survivor.id))).toBe(false);
  });

  it("resolving the last child removes the row entirely", () => {
    let items = HEAVY();
    const group = listEntriesFor(items, "riskFlag", NOW).find(
      (e) => e.kind === "group" && e.members.length === 5
    )!;
    if (group.kind !== "group") throw new Error("expected a group");
    for (const m of group.members) items = resolve(items, m.id);
    const entries = listEntriesFor(items, "riskFlag", NOW);
    for (const m of group.members) {
      expect(entries.flatMap(itemsOf).some((i) => i.id === m.id)).toBe(false);
    }
  });
});

describe("copy", () => {
  it("the coalesce badge names flags", () => {
    expect(coalesceLabel(3)).toBe("3 flags");
  });
});
