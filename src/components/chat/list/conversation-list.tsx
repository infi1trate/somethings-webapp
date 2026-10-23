"use client";

// THE CONVERSATION LIST — filters, rows.
//
// ═══ SUPERSEDED (SUP-5): THERE IS NO WORKSPACE SWITCH ═══
// Support conversations moved into the global Support panel, and leaving a
// `Teens | Support` switch here put the same conversations behind two routes
// with two unread counts (Nielsen H4). This list holds teens; Support is the
// top bar's CTA. The reasoning below is what built the switch and is kept
// because it is still right about what a switch must do — the argument it
// lost is whether Support belongs in this list at all.
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

import { useEffect, useMemo, useRef, useState } from "react";
import { ConversationRow, type RowEscalation } from "@/components/chat/list/conversation-row";
import type { ChatThread, ThreadId } from "@/lib/chat/types";
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

/** ═══ WHERE THE READER WAS, ACROSS A ROUTE REMOUNT ═══
 *
 *  Opening a thread is a real navigation now (`/app/chat` → `/app/chat/<id>`),
 *  so this component UNMOUNTS and its state is gone. Coming back therefore
 *  landed the reader at the top of the Teens list with the filter reset — even
 *  if they had been deep in Support/Unread when they tapped. On a list whose
 *  job is working through conversations one at a time, that is the round-trip
 *  that matters most, and it lost every bit of context each time.
 *
 *  MODULE-SCOPED, NOT storage. It has to outlive the component but must not
 *  outlive the tab: where a mentor had scrolled to is a trace of whose records
 *  they were reading, and it has no business surviving into a later session on
 *  a shared machine. A module binding is exactly that lifetime — it dies with
 *  the tab, and a fresh load correctly starts at the top of Teens.
 *
 *  It is also why this is safe against hydration: a server render and a first
 *  client paint both see the initial values here, and it only ever diverges
 *  after a client-side navigation, where there is no server render to disagree
 *  with. */
type ListMemory = { filter: ListFilter; top: number };

const listMemory: ListMemory = { filter: "all", top: 0 };

/** The only writer. `react-hooks/immutability` forbids a component body from
 *  assigning to a module binding at all — it cannot see that these writes are in
 *  event handlers rather than in render, and the conservative rule is the right
 *  one. Routing every write through a function declared out here satisfies it
 *  and puts the mutation where the state it guards lives. */
function remember(patch: Partial<ListMemory>) {
  Object.assign(listMemory, patch);
}

export function ConversationList({
  threads,
  now,
  selectedId,
  onSelect,
  className,
  escalations,
}: {
  threads: ChatThread[];
  /** THREADED THROUGH from the page's mount-fixed clock rather than read here.
   *  Fifteen rows in one render must agree about what "3d" means, and reading the
   *  clock per row is both impure and a way for two rows to disagree. */
  now: number;
  selectedId: ThreadId | null;
  onSelect: (id: ThreadId) => void;
  className?: string;
  /** Open escalations by thread (pack v5.0, C1). */
  escalations?: Record<string, RowEscalation>;
}) {
  /* Lazy initialisers, so the read happens once at mount rather than on every
     render — and so a remount picks up where the last one left off. */
  const [filter, setFilterState] = useState<ListFilter>(() => listMemory.filter);

  /* WRITE-THROUGH WRAPPERS rather than an effect watching the state. An effect
     would record the same values one commit later and fire on the restore too;
     these run exactly when a reader makes a choice, which is the only moment
     the memory should change. */
  const setFilter = (v: ListFilter) => {
    remember({ filter: v, top: 0 });
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
    setFilterState(v);
  };

  /* ═══ A CALLBACK REF, NOT A REF + EFFECT ═══
   *
   *  The restore has to happen in the commit that creates the element, before
   *  paint — `useEffect` runs after paint, which is a visible jump from the top
   *  of the list to where the reader was, and `useLayoutEffect` warns during
   *  SSR. A callback ref runs at exactly the right moment with neither problem.
   *
   *  The node is kept in a REF, not state: attaching it must not re-render
   *  (nothing renders from it), and the setters above drive `scrollTop`
   *  imperatively — which on a state value is a mutation-after-render that
   *  `react-hooks/immutability` rejects, correctly. A ref is the sanctioned
   *  place for a mutable handle to the DOM. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const attachScroller = (el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    if (!el) return;
    // Whenever the rows are already present this is the whole restore, before
    // paint. When they are not, the effect below finishes the job.
    el.scrollTop = listMemory.top;
    restored.current = el.scrollTop === listMemory.top;
  };

  /* TEENS ONLY (SUP-5). Support threads still arrive in `threads` — the page
     needs them to hand a support deep link to the panel — and stop here. */
  const inWorkspace = useMemo(() => threads.filter((t) => t.kind === "teen"), [threads]);
  const visible = applyFilter(inWorkspace, filter);
  /* A filter that empties when the workspace changes would leave a mentor
     looking at an empty list they did not ask for. Fall back to All rather than
     showing nothing — and the filter row reflects it, because `filter` is read
     through this. */
  const effectiveFilter = visible.length === 0 && filter !== "all" ? "all" : filter;
  const rows = applyFilter(inWorkspace, effectiveFilter);

  /* ═══ THE RESTORE HAS TO WAIT FOR THE ROWS ═══
   *
   *  Attaching the ref is the right MOMENT but the wrong COMMIT. The threads are
   *  mount-gated in `chat-page.tsx` (`data` is null until `useMounted` flips), so
   *  the first commit hands this an empty list — and assigning `scrollTop` to a
   *  scroller shorter than its own viewport silently clamps to 0. Measured
   *  exactly that: left the list at 260, came back to 0, while the remembered
   *  workspace restored fine because nothing clamps a string.
   *
   *  So the ref makes the attempt (free, and correct whenever the rows are
   *  already there) and this re-attempts once they arrive. `restored` latches so
   *  a reader who deliberately scrolls back to the top is not yanked down again
   *  by the next re-render.
   *
   *  Reading back what the browser accepted is the check: if the list is now
   *  shorter than it was — the reader archived a conversation and returned — the
   *  offset cannot be honoured, and settling for the clamped value is the right
   *  answer rather than retrying forever. */
  const restored = useRef(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || restored.current || rows.length === 0) return;

    /* ═══ A HIDDEN LIST MUST NOT ANSWER FOR THE VISIBLE ONE ═══
     *
     *  Below `md` the thread route STILL RENDERS this component — it is
     *  `display: none`, not unmounted — and a hidden element reports
     *  `clientHeight: 0`, so every offset clamps to 0. Without this guard the
     *  hidden copy restored to 0, settled, and wrote that 0 back into the shared
     *  memory, wiping the position the visible list had just recorded. That is
     *  precisely what was happening: the row click stored 260 correctly, the
     *  thread route's hidden list overwrote it with 0, and the return landed at
     *  the top. Measured 260 → 0 across the round trip until this landed.
     *
     *  Returning rather than settling is the point — an element that cannot
     *  scroll has not failed to restore, it has not been asked yet. */
    const max = el.scrollHeight - el.clientHeight;
    if (el.clientHeight === 0 || max <= 0) return;

    const target = listMemory.top;
    el.scrollTop = target;
    /* Settle for what the browser accepted. If the list came back genuinely
       shorter than it was, the offset is unreachable and lowering the memory to
       the clamped value is both the honest answer and what stops this
       retrying. */
    remember({ top: el.scrollTop });
    restored.current = el.scrollTop === target;
  }, [rows.length]);

  return (
    <div
      data-slot="conversation-list"
      data-anno-ref="chat-list"
      className={cn(
        "flex h-full min-h-0 flex-col border-r border-[color:var(--border-subtle)] bg-[var(--surface-card)]",
        className
      )}
    >
      {/* ── FILTERS ───────────────────────────────────────────────────── */}
      <div
        role="group"
        /* TODO-COPY */
        aria-label="Filter conversations"
        /* `pt-3`: the switch above it, which carried the top padding, is gone. */
        className="flex shrink-0 items-center gap-1.5 px-3 pt-3 pb-2.5"
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
        data-anno-ref="chat-list-scroller"
        /* A region, no longer a tabpanel: the switch it belonged to is gone
           (SUP-5), and a tabpanel with no tab is an ARIA error. TODO-COPY. */
        role="region"
        aria-label="Conversations"
        tabIndex={-1}
        ref={attachScroller}
        /* Recorded on scroll rather than on unmount: a route change tears this
           down without a beat to run cleanup in, and the value is already
           current by then. */
        onScroll={(e) => {
          remember({ top: e.currentTarget.scrollTop });
        }}
        /* ═══ THIS SCROLLER OWNS THE ROOM ABOVE THE BAR ═══
         *
         *  The route passes `bottomInset="surface"` to the shell, which drops
         *  the panel's own bottom padding so these rows can run underneath the
         *  translucent bar instead of stopping at it. The reservation does not
         *  disappear — it moves here, onto the element that actually scrolls.
         *
         *  BOTH HALVES, and they do different jobs. `padding-bottom` is what
         *  lets the LAST row be scrolled out from under the bar; without it the
         *  final conversation is unreachable no matter how far the reader
         *  scrolls. `scroll-padding-bottom` is SC 2.4.11: it is what the browser
         *  consults when it scrolls a focused row into view, and without it a
         *  keyboard reader tabbing down the list lands on a row parked
         *  underneath the bar. Padding cannot cover that case — the browser
         *  targets the row's box, not the scroller's padding box.
         *
         *  `--nav-reserve` is the bar's height plus the safe-area inset, and it
         *  is already 0 both on a detail route and above the bar's tier, so
         *  this needs no breakpoint of its own. */
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          "[padding-bottom:var(--nav-reserve)]",
          "[scroll-padding-bottom:calc(var(--nav-reserve)+1rem)]"
        )}
      >
        {rows.length === 0 ? (
          <p
            className="px-4 py-8 text-center text-[var(--text-secondary)]"
            style={{ font: "var(--type-body)" }}
          >
            {/* TODO-COPY. Only reachable with an empty roster, which is not a
                state the fixtures produce — kept because an empty branch that
                renders nothing is a blank panel. */}
            No conversations here yet.
          </p>
        ) : (
          <ul role="list">
            {rows.map((t) => (
              <li key={t.id}>
                <ConversationRow
                  thread={t}
                  now={now}
                  escalation={escalations?.[t.id]}
                  selected={t.id === selectedId}
                  /* ═══ RECORD ON DEPARTURE, NOT ONLY ON SCROLL ═══
                     Opening a thread is the one exit that always comes back
                     here, so it is the moment the offset has to be right. The
                     `onScroll` handler above keeps it fresh, but it depends on
                     the browser having dispatched a scroll event — measured 0
                     dispatched for a programmatic scroll inside 150ms, and real
                     ones coalesce under load. Reading `scrollTop` here needs no
                     event to have fired at all. */
                  onSelect={() => {
                    remember({ top: scrollerRef.current?.scrollTop ?? 0 });
                    onSelect(t.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
