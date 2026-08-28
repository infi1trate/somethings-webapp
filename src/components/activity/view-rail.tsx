"use client";

// THE SAVED-VIEW RAIL. Real tab semantics, built properly here.
//
// NOTHING TO REUSE. The brief says "reuse the pattern from the Tasks page
// segmented switcher if it's already accessible" — there is no Tasks page. The two
// switchers that DO exist were both checked and neither is a tablist:
//   · `segmented-control.tsx` is a radiogroup (correct for its own use — it picks
//     a value, it does not swap a panel).
//   · `user-record-shell.tsx`'s record tabs are plain buttons with
//     `aria-current="page"`, which is right for what they are (they change the
//     URL) and wrong here (these swap a panel in place).
// So this is built from the APG tabs pattern.
//
// WHY REAL TABS AND NOT LINKS: switching view swaps the content of one panel
// without navigating, and the keyboard contract that goes with that is arrow-key
// selection inside a single tab stop — not six tab stops a reader has to walk
// through to reach the feed.
//
// MANUAL ACTIVATION, deliberately. Arrow keys move focus AND select, which is
// automatic activation — correct here because switching views is instant and
// cheap. If a view ever becomes expensive to load, this is the line to change:
// move selection to Enter/Space and leave the arrows moving focus only.

import { useRef } from "react";
import { ACTIVITY_VIEWS } from "@/lib/activity/views";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** THE UNREAD BADGE. Never colour alone — the number is the signal and the
 *  accessible label states it in words. */
function UnreadBadge({ count }: { count: number | null }) {
  if (count === null || count === 0) return null;
  return (
    <span
      role="img"
      /* TODO-COPY */
      aria-label={`${count} unread`}
      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[var(--surface-s2)] px-1.5 text-[11.5px] font-semibold leading-[16px] tabular-nums text-[var(--text-secondary)]"
    >
      {count}
    </span>
  );
}

export function ViewRail({
  activeId,
  onSelect,
  unreadFor,
}: {
  activeId: string;
  onSelect: (id: string) => void;
  /** Unread count per view id. Returns null for "no badge" — the badge is
   *  flagged off today (see SHOW_UNREAD_BADGE in activity-ledger.tsx).
   *
   *  A COUNT, NOT A NODE. Passing JSX in would make this prop a component
   *  factory, which is both an eslint react/display-name error and the wrong
   *  division of labour: the rail owns how a tab looks, the ledger owns what the
   *  number is. */
  unreadFor?: (viewId: string) => number | null;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = ACTIVITY_VIEWS.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onSelect(ACTIVITY_VIEWS[next].id);
  };

  return (
    <div
      role="tablist"
      /* TODO-COPY */
      aria-label="Activity views"
      className="flex items-end gap-1 border-b border-[color:var(--border-contour)]"
    >
      {ACTIVITY_VIEWS.map((view, i) => {
        const selected = view.id === activeId;
        return (
          <button
            key={view.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`activity-tab-${view.id}`}
            aria-selected={selected}
            aria-controls="activity-panel"
            // ONE TAB STOP for the whole rail: only the selected tab is
            // reachable by Tab, and the arrows move within. Without this a reader
            // walks three stops before reaching the feed.
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(view.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "relative min-h-11 shrink-0 rounded-md px-3 py-2 text-[14px] leading-[20px] transition-colors",
              selected
                ? "font-semibold text-[var(--text-primary)]"
                : "font-normal text-[var(--text-secondary)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
              RING
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {view.label}
              <UnreadBadge count={unreadFor?.(view.id) ?? null} />
            </span>
            {selected && (
              // Underline-active. Sits ON the rail's own hairline, matching the
              // record shell's treatment so the two rails read as one system.
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[var(--text-primary)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
