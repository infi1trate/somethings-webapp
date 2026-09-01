"use client";

// THE CONVERSATION LIST — workspace switch, filters, rows.
//
// ═══ THE WORKSPACE SWITCH IS A VISIBLE CONTROL, NOT A DROPDOWN ═══
//
// The surface this replaces put it in the panel's title: "Teens ⌄". Three things
// were wrong with that, in rising order of cost:
//
//  1. A title that is also a control is a control nobody presses, because a
//     heading is the one thing on a panel a reader has learned not to click.
//  2. It hides the OTHER workspace completely. A mentor who has never opened that
//     menu does not know Support exists — and Support is where they ask their lead
//     a question, which is the thing a struggling mentor most needs to find.
//  3. It hides the counts. Whether anything is waiting in the workspace you are
//     not looking at is exactly what a switch should tell you, and a closed
//     dropdown tells you nothing.
//
// Two segments, both visible, each carrying its own unread count. It costs 36px
// and answers all three.
//
// ═══ AND THE TWO LISTS ARE THE SAME COMPONENT ═══
//
// A support thread renders through the same `ConversationRow` as a teen thread,
// because it is the same shape (see `ChatThread`). That sameness is the argument
// for the switch rather than for a separate screen: these are the same kind of
// object, and a mentor moving between them is doing the same thing.
//
// ═══ FILTERS COUNT WHAT THEY WILL SHOW ═══
//
// "Unread 3", not "Unread". A filter whose count is in its own label cannot
// disagree with its results, and a mentor can see whether pressing it is worth
// it. `All` carries no count — it is the total, which the two beside it already
// imply, and a number there would just be noise.
//
// A filter with nothing in it is DISABLED AND STILL VISIBLE, not hidden. A
// control that appears and disappears as data changes is a control whose position
// cannot be learned.

import { useId, useMemo, useState } from "react";
import { SegmentedControl } from "@/components/record/segmented-control";
import { ConversationRow } from "@/components/chat/list/conversation-row";
import type { ChatThread, ThreadId, ThreadKind } from "@/lib/chat/types";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

export type ListFilter = "all" | "unread" | "check-in";

/** TODO-COPY.
 *
 *  "Check-in" NAMES WHAT THE MENTOR WOULD DO, not a state of the teen. The
 *  vocabulary this product does not use — at-risk, churn, lapsed, cold — all
 *  describe the person; this describes the action available. The underlying
 *  condition is `mentees-demo.ts`'s own `teen-quiet` state at its own threshold,
 *  so this filter and the mentee table cannot disagree about who is in it. */
const FILTER_LABEL: Record<ListFilter, string> = {
  all: "All",
  unread: "Unread",
  "check-in": "Check-in",
};

function countFor(threads: ChatThread[], f: ListFilter): number {
  if (f === "unread") return threads.filter((t) => t.unreadCount > 0).length;
  if (f === "check-in") return threads.filter((t) => t.needsCheckIn).length;
  return threads.length;
}

function applyFilter(threads: ChatThread[], f: ListFilter): ChatThread[] {
  if (f === "unread") return threads.filter((t) => t.unreadCount > 0);
  if (f === "check-in") return threads.filter((t) => t.needsCheckIn);
  return threads;
}

export function ConversationList({
  threads,
  now,
  selectedId,
  onSelect,
  className,
}: {
  threads: ChatThread[];
  /** THREADED THROUGH from the page's mount-fixed clock rather than read here.
   *  Fifteen rows in one render must agree about what "3d" means, and reading the
   *  clock per row is both impure and a way for two rows to disagree. */
  now: number;
  selectedId: ThreadId | null;
  onSelect: (id: ThreadId) => void;
  className?: string;
}) {
  const [workspace, setWorkspace] = useState<ThreadKind>("teen");
  const [filter, setFilter] = useState<ListFilter>("all");
  const listId = useId();

  const inWorkspace = useMemo(
    () => threads.filter((t) => t.kind === workspace),
    [threads, workspace]
  );
  /** UNREAD PER WORKSPACE, for the switch's own labels — the number a mentor
   *  needs is "is anything waiting over there", which is unread in the workspace
   *  they are NOT looking at. */
  const unreadIn = (kind: ThreadKind) =>
    threads
      .filter((t) => t.kind === kind)
      .reduce((n, t) => n + (t.unreadCount > 0 ? 1 : 0), 0);

  const visible = applyFilter(inWorkspace, filter);
  /* A filter that empties when the workspace changes would leave a mentor
     looking at an empty list they did not ask for. Fall back to All rather than
     showing nothing — and the filter row reflects it, because `filter` is read
     through this. */
  const effectiveFilter = visible.length === 0 && filter !== "all" ? "all" : filter;
  const rows = applyFilter(inWorkspace, effectiveFilter);

  return (
    <div
      data-slot="conversation-list"
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-[color:var(--border-subtle)] bg-[var(--surface-card)]",
        className
      )}
    >
      {/* ── WORKSPACE ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 pb-2.5 pt-3">
        <SegmentedControl
          /* ═══ THE COUNT APPEARS ON THE WORKSPACE YOU ARE NOT IN ═══
             It was on both, and a screenshot showed why that is wrong: "Teens · 4"
             sitting twenty pixels above "Unread 4". The same number twice, in two
             controls, where the second one is the one that filters — so the first
             was decoration that looked like information.
             What the switch is actually for is the OTHER side: whether anything is
             waiting in the workspace you are not looking at. On the active side the
             filter row already answers it. So the number shows exactly when it is
             news, and the switch is quiet the rest of the time. */
          options={[
            {
              value: "teen" as ThreadKind,
              // TODO-COPY. The count is the number of CONVERSATIONS with
              // something unread, not the number of messages — a mentor decides
              // where to look, not how much to read.
              label:
                workspace !== "teen" && unreadIn("teen") > 0
                  ? `Teens · ${unreadIn("teen")}`
                  : "Teens",
              controls: `${listId}-list`,
            },
            {
              value: "support" as ThreadKind,
              label:
                workspace !== "support" && unreadIn("support") > 0
                  ? `Support · ${unreadIn("support")}`
                  : "Support",
              controls: `${listId}-list`,
            },
          ]}
          value={workspace}
          onChange={(v) => {
            setWorkspace(v);
            // The filter is per workspace in meaning — "unread" in Teens and
            // "unread" in Support are different sets — but keeping the selection
            // across the switch is what a reader expects, and the fallback above
            // covers the case where it would empty the list.
          }}
          semantics="tabs"
          fullWidth
          size="md"
          /* TODO-COPY */
          ariaLabel="Conversations"
        />
      </div>

      {/* ── FILTERS ───────────────────────────────────────────────────── */}
      <div
        role="group"
        /* TODO-COPY */
        aria-label="Filter conversations"
        className="flex shrink-0 items-center gap-1.5 px-3 pb-2.5"
      >
        {(["all", "unread", "check-in"] as ListFilter[]).map((f) => {
          const n = countFor(inWorkspace, f);
          const on = effectiveFilter === f;
          const empty = f !== "all" && n === 0;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              disabled={empty}
              onClick={() => setFilter(f)}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors",
                /* 28, not 26. `touchTarget` takes a CLOSED set of visual
                   heights — it carries the arithmetic that reaches 44px from
                   each, so an arbitrary number has no correct pseudo-element
                   inset to pair with it. The chip is sized to a step the helper
                   knows. */
                touchTarget(28),
                on
                  ? "bg-[var(--surface-s2)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                // DISABLED, NOT HIDDEN — see the module note. Reduced contrast
                // rather than removal, and `disabled` so it is not a tab stop.
                empty && "opacity-45 hover:bg-transparent",
                RING
              )}
              style={{ font: "var(--type-field-label)" }}
            >
              {FILTER_LABEL[f]}
              {/* NO COUNT ON `All` — it is the total, which the other two imply.
                  `tabular-nums` because these tick as a mentor works. */}
              {f !== "all" && (
                <span className="tabular-nums text-[var(--text-muted)]">{n}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── ROWS ──────────────────────────────────────────────────────── */}
      <div
        id={`${listId}-list`}
        role="tabpanel"
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {rows.length === 0 ? (
          <p
            className="px-4 py-8 text-center text-[var(--text-secondary)]"
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY. Only reachable in the Support workspace with no
                contacts, which is not a state the fixtures produce — kept because
                an empty branch that renders nothing is a blank panel. */}
            No conversations here yet.
          </p>
        ) : (
          <ul role="list">
            {rows.map((t) => (
              <li key={t.id}>
                <ConversationRow
                  thread={t}
                  now={now}
                  selected={t.id === selectedId}
                  onSelect={() => onSelect(t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
