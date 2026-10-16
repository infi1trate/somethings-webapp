"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE CONSOLE TOP BAR (SUP-1) — Figma `topBar` 3928:10081
//
// Spans the CONTENT column only (standing rule 1): it renders in the column
// beside the rail, so the rail stays full height and its top edge is the app's.
// Three groups — history · search + Ask Ava · notifications + support — at
// 64px, `padding: 8px 24px 8px 0`, with no fill and no border of its own (it
// sits on the shell, exactly as Figma draws it).
//
// ═══ HISTORY, THE BELL AND SUPPORT ARE LIVE ═══
// Search, ⌘K and Ask Ava are DISABLED, not enabled-but-dead (standing rule 3):
// out of the tab order, `aria-disabled`, "Coming soon." in a tooltip. The bell
// shipped inert too and is now Activity (2026-10-16). Support toggles the
// panel's open state; the panel is SUP-2.
//
// ═══ GEOMETRY, FROM THE FILE ═══
//   history pill   80×36: two 24px chevrons, 8px pad, a 24px inset divider
//   search         514 max × 48, radius-lrg, 16/20 pad, 24px glyph, 12 gap
//   ⌘K chip        42×29, radius 4, sunken-strong
//   Ask Ava        120 min × 40, pill, sunken, 16px sparkles, 8 gap
//   right group    40 + 12 + 40, 8px right pad, radius-lrg
// The search width is NOT the file's fixed 514: it is `flex 1 1 auto` capped
// at 514 with a 240 floor (the pack's correction), and the centre group is
// centred in the space between the outer two, which is where Figma puts it.
//
// ═══ BELOW ~900px OF CONTENT WIDTH ═══
// A container query on the bar itself, so the threshold is the CONTENT width
// the pack names, not the viewport: the history control drops (browser and
// system back cover it on touch) and search collapses to a 40×40 icon button.
// The support CTA never drops.

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessagesSquare, Search, Sparkles } from "lucide-react";
import { ActivityBell } from "@/components/app-shell/activity-bell";
import { useNavHistory } from "@/lib/app-shell/nav-history";
import { toggleSupport, useSupportOpen } from "@/lib/support/panel";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** TODO-COPY. One string for every inert control in the bar. */
const COMING_SOON = "Coming soon.";

/** ═══ THE INERT CONTROL'S CONTRACT (standing rule 3) ═══
 *  `aria-disabled` + `tabIndex={-1}` rather than the `disabled` attribute: a
 *  disabled button receives no pointer events, so its `title` tooltip never
 *  shows in Chrome, and "Coming soon." is the one thing these controls have to
 *  say. Out of the tab order either way. */
const inert = {
  "aria-disabled": true,
  tabIndex: -1,
  title: COMING_SOON,
  onClick: (e: React.MouseEvent) => e.preventDefault(),
} as const;

/** A 24px chevron with a 40×40 hit area (Fitts; SC 2.5.8's 24 is the floor).
 *  The `::after` bleeds 8px on every side of the glyph, so the two buttons
 *  tile the 80px pill exactly — 0–40 and 40–80 — and never overlap. */
function HistoryButton({
  dir,
  enabled,
  onPress,
}: {
  dir: "back" | "forward";
  enabled: boolean;
  onPress: () => void;
}) {
  const Icon = dir === "back" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      data-history={dir}
      /* TODO-COPY */
      aria-label={dir === "back" ? "Go back" : "Go forward"}
      aria-disabled={!enabled || undefined}
      tabIndex={enabled ? 0 : -1}
      onClick={enabled ? onPress : undefined}
      className={cn(
        "relative flex size-6 items-center justify-center rounded-sm",
        "after:absolute after:-inset-2 after:content-['']",
        enabled
          ? "text-[var(--icon-secondary)] hover:text-[var(--text-primary)]"
          : /* "Reduce the icon to text-tertiary" — the disabled state. */
            "cursor-default text-[var(--text-tertiary)]",
        RING
      )}
    >
      <Icon aria-hidden className="size-6" strokeWidth={1.75} />
    </button>
  );
}

export function ConsoleTopBar({
  supportUnread = 0,
  activityUnread = 0,
}: {
  supportUnread?: number;
  activityUnread?: number;
}) {
  const router = useRouter();
  const { canGoBack, canGoForward } = useNavHistory();
  const supportOpen = useSupportOpen();

  return (
    <header
      data-anno-ref="console-topbar"
      /* `@container` — the compact rules below read THIS box's width, which is
         the content column's, not the viewport's. */
      className="@container hidden h-16 shrink-0 md:block"
    >
      <div className="flex h-full items-center gap-4 py-2 pr-6 pl-0">
        {/* ── LEFT · history (functional) ─────────────────────────────── */}
        <nav
          aria-label="History"
          /* ═══ 80 WIDE, AS FIGMA DRAWS IT ═══
             MEASURED at first as 83: the divider took 1px of flow with an 8px
             gap on each side. Figma's `Vertical/Inset` is a zero-width stroke
             centred at x=40, with the glyphs at 8 and 48. So the divider is
             positioned, not in flow, and the glyphs sit 16 apart inside 1px of
             border + 7px of padding: 1 + 7 + 24 + 16 + 24 + 7 + 1 = 80. Each
             glyph's 40px hit area then tiles the pill exactly (0–40, 40–80). */
          className="relative flex h-9 shrink-0 items-center gap-4 rounded-[8px] border border-[color:var(--border-default)] bg-[var(--surface-canvas)] px-[7px] py-1.5 @max-[899px]:hidden"
        >
          <HistoryButton dir="back" enabled={canGoBack} onPress={() => router.back()} />
          {/* The full-height inset divider (Figma `Vertical/Inset`, 24 tall). */}
          <span aria-hidden className="pointer-events-none absolute top-1.5 left-1/2 h-6 w-px -translate-x-1/2 bg-[var(--border-default)]" />
          <HistoryButton dir="forward" enabled={canGoForward} onPress={() => router.forward()} />
        </nav>

        {/* ── CENTRE · search + Ask Ava (both disabled) ───────────────── */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-4">
          {/* THE FIELD, at ≥900 content width. The title sits on the wrapper and
              the input ignores the pointer, so hovering anywhere on the field
              shows "Coming soon." — a disabled input swallows the hover. */}
          <div
            title={COMING_SOON}
            className="flex h-12 min-w-[240px] max-w-[514px] flex-[1_1_auto] cursor-default items-center gap-3 rounded-[var(--radius-lrg)] border border-[color:var(--border-default)] bg-[var(--surface-canvas)] py-4 pr-5 pl-4 @max-[899px]:hidden"
          >
            <Search aria-hidden className="size-6 shrink-0 text-[var(--icon-secondary)]" strokeWidth={1.75} />
            <input
              type="search"
              disabled
              aria-disabled="true"
              tabIndex={-1}
              /* TODO-COPY */
              placeholder="Search Somethings"
              aria-label="Search Somethings (coming soon)"
              className="pointer-events-none min-w-0 flex-1 bg-transparent text-[16px] leading-[24px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] disabled:opacity-100"
            />
            {/* ⌘K — `text-primary`, not the file's raw `text-black`. Decorative
                while search is disabled, so hidden from assistive tech. */}
            <kbd
              aria-hidden
              className="flex h-[29px] w-[42px] shrink-0 items-center justify-center rounded-[4px] border border-[color:var(--border-default)] bg-[var(--surface-sunken-strong)] font-mono text-[16px] leading-[20px] text-[var(--text-primary)]"
            >
              ⌘K
            </kbd>
          </div>
          {/* THE ICON FORM, below 900 content width. */}
          <button
            type="button"
            {...inert}
            aria-label="Search (coming soon)"
            className="hidden size-10 shrink-0 cursor-default items-center justify-center rounded-[var(--radius-lrg)] border border-[color:var(--border-default)] bg-[var(--surface-canvas)] @max-[899px]:flex"
          >
            <Search aria-hidden className="size-6 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            {...inert}
            aria-label="Ask Ava (coming soon)"
            className="flex h-10 min-w-[120px] shrink-0 cursor-default items-center justify-center gap-2 rounded-full border border-[color:var(--border-default)] bg-[var(--surface-sunken)] px-4"
          >
            {/* Figma binds this glyph to `fill/ivory/border` (#947a3d). */}
            <Sparkles aria-hidden className="size-4 text-[var(--fill-ivory-border)]" strokeWidth={1.75} />
            {/* Label/Medium is Lausanne 700, and only Lausanne 400 ships, so the
                weight would be a declaration with no rendering behind it. Avantt
                Bold is this codebase's emphasis face (AGENTS.md). */}
            <span className="font-display text-[14px] font-bold leading-[16px] text-[var(--text-primary)]">
              Ask Ava
            </span>
          </button>
        </div>

        {/* ── RIGHT · notifications (disabled) + support (functional) ─── */}
        <div className="flex shrink-0 items-center gap-3 pr-2">
          {/* ═══ THE BELL IS ACTIVITY (2026-10-16) ═══
              It shipped inert ("Coming soon."); Activity moved into it and the
              Activity tab went away. See `activity-bell.tsx`. */}
          <ActivityBell unread={activityUnread} />
          {/* ═══ SUPPORT — THE ONE LIVE CONTROL ON THIS SIDE ═══
              Figma fills this button white and not the bell, with no state
              attached. Resolved per the pack: the white is the OPEN state.
              `aria-controls` points at the panel, which is always mounted
              (inert while closed) since SUP-2. */}
          <button
            type="button"
            data-support-cta
            aria-expanded={supportOpen}
      aria-controls="support-panel"
            /* TODO-COPY */
            aria-label={supportUnread > 0 ? `Support, ${supportUnread} unread` : "Support"}
            onClick={toggleSupport}
            className={cn(
              "flex size-10 items-center justify-center rounded-[var(--radius-lrg)] border border-[color:var(--border-default)] transition-colors",
              supportOpen
                ? "bg-[var(--surface-raised)]"
                : "bg-transparent hover:bg-[var(--tint-hover)]",
              RING
            )}
          >
            <MessagesSquare aria-hidden className="size-6 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
