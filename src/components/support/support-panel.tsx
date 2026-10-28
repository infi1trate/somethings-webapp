"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE SUPPORT PANEL — chrome and slide-out (SUP-2)
//
// ═══ IT ALWAYS PUSHES (answered 2026-10-16) ═══
// The pack pushed at ≥1280px of content and overlaid below. Answered: "The
// panel should always push, regardless of user role — adjust other containers
// and spaces responsively to accommodate this." So from 768 up the canvas
// shrinks by 424px (a 4px gutter + the 420px panel) and the surfaces inside it
// read the CANVAS width, not the viewport, through the `canvas` container
// (`AppShell`). Below 768 it is a full-screen sheet, as the pack says.
//
// ═══ NON-MODAL (standing rule 5) ═══
// No scrim, no focus trap, and an outside click does nothing: the panel exists
// so a mentor can read the teen thread while asking a supervisor about it. It
// closes from the CTA toggle, Esc (while focus is inside), and the close
// button here.
//
// ═══ ALWAYS MOUNTED, INERT WHEN CLOSED ═══
// It lives in the persistent shell (`(console)/layout.tsx`), so it keeps its
// state and its scroll position across route changes AND across closing and
// reopening — standing rule 4. Closed, it is `inert` and zero-width, so it is
// out of the tab order and the accessibility tree.
//
// ═══ THE TREATMENT ═══
// `surface-raised` (pure white) against the ecru canvas — the brightest
// surface in the layout, on purpose. Asymmetric radius 4 / 24 / 24 / 4: a card
// that slid in from the right and sits nearly flush at its left seam. Bloom
// Elevation/1, the only elevated surface. 16px bottom padding, clipped.
//
// ═══ MOTION ═══
// Slide + fade, 220ms, cubic-bezier(0.32, 0.72, 0, 1) — inside the 400ms
// Doherty threshold. Reduced motion: instant, no transform.

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Search, SquarePen, X } from "lucide-react";
import { setSupportOpen, setSupportThread, useSupportOpen, useSupportPinned, useSupportThread } from "@/lib/support/panel";
import { SupportList } from "@/components/support/support-list";
import { SupportThread, type ThreadMessage } from "@/components/support/support-thread";
import { markSupportRead, useOutbox } from "@/lib/support/outbox";
import { useSupportSections } from "@/lib/support/use-support";
import { pinnedThread, supportThread } from "@/lib/support/threads";
import { useOnline } from "@/lib/support/online";
import { useNavClock } from "@/lib/app-shell/shell-config";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

/** The panel header's icon buttons: 40×40, `border-subtle`, pill radius (the
 *  Figma `iconButton` instance in the panel header — the top bar's are 12px;
 *  the mismatch is Appendix A's and is kept as drawn). */
const ICON_BTN =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)]";

/** Standing rule 3, as in the top bar: the controls SUP-3/SUP-4 will wire are
 *  inert now — out of the tab order, "Coming soon." */
const inert = {
  "aria-disabled": true,
  tabIndex: -1,
  title: "Coming soon.",
  onClick: (e: React.MouseEvent) => e.preventDefault(),
} as const;

/** The CTA a reader can actually see — the desktop bar's or the mobile bar's. */
const visibleCta = () =>
  [...document.querySelectorAll<HTMLElement>("[data-support-cta]")].find(
    (el) => el.getBoundingClientRect().width > 0
  ) ?? null;

export function SupportPanel() {
  const open = useSupportOpen();
  const onChat = (usePathname() ?? "").startsWith("/app/chat");
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const wasOpen = useRef(open);
  /* ═══ THE LIST'S INPUTS (SUP-3) ═══ The shell's nav clock, so the times
     move on with navigation like every badge does (no `Date.now()` in
     render). Only mounted after hydration (`ConsoleShell`), so the persona is
     the real one. */
  const persona = useOnboardingStore((s) => s.persona);
  const chatScenarioId = useOnboardingStore((s) => s.chatScenarioId);
  const load = useOnboardingStore((s) => s.devLoadState);
  const now = useNavClock();
  const online = useOnline();
  const outbox = useOutbox();
  /* ═══ THE LIST, WITH THIS SESSION ON TOP OF IT ═══ Read threads lose their
     unread, written ones preview what was sent — from the one hook the CTA
     badge reads too (SUP-5, `use-support.ts`). */
  const { sections, pinned } = useSupportSections();
  const pin = useSupportPinned();

  /* ═══ WHICH VIEW ═══ A thread id that this persona cannot see (the persona
     switched) falls back to the list rather than an empty panel. */
  const threadId = useSupportThread();
  const thread = useMemo(() => {
    /* A pinned contact's thread comes from the pin, not the directory. */
    const t = !threadId
      ? null
      : pin && threadId === pin.id
        ? pinnedThread(pin, now)
        : supportThread(threadId, persona, chatScenarioId, now);
    if (!t) return null;
    const row = sections.flatMap((s) => s.rows).find((r) => r.id === t.row.id) ?? t.row;
    return { ...t, row };
  }, [threadId, persona, chatScenarioId, now, sections, pin]);
  const messages = useMemo<ThreadMessage[]>(
    () =>
      thread
        ? [
            ...thread.messages,
            ...outbox
              .filter((m) => m.threadId === thread.row.id)
              .map((m) => ({ id: m.id, at: m.at, mine: true, text: m.text, status: m.status })),
          ]
        : [],
    [thread, outbox]
  );

  /* ═══ BACK KEEPS THE LIST WHERE IT WAS ═══ The list unmounts while a
     thread is open, so its scroll offset is kept here and put back, and focus
     returns to the row that opened the thread. Its open sections are already
     persistent (`disclosure.ts`). */
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const listScroll = useRef(0);
  const openedFrom = useRef<string | null>(null);
  const openThread = (id: string) => {
    listScroll.current = bodyRef.current?.scrollTop ?? 0;
    openedFrom.current = id;
    markSupportRead(id);
    setSupportThread(id);
  };
  const showingThread = !!thread;
  const wasThread = useRef(showingThread);
  useLayoutEffect(() => {
    if (wasThread.current && !showingThread) {
      if (bodyRef.current) bodyRef.current.scrollTop = listScroll.current;
      const from = openedFrom.current;
      if (from) {
        bodyRef.current
          ?.querySelector<HTMLElement>(`[data-support-row="${CSS.escape(from)}"] [data-support-row-open]`)
          ?.focus({ preventScroll: true });
      }
    }
    wasThread.current = showingThread;
  }, [showingThread]);

  /* ═══ FOCUS (SUP-2) ═══
     Open: focus moves to the panel header — not trapped, so Tab continues out
     of it. Close: focus returns to the CTA, but only if it was INSIDE the panel;
     a reader who closed it from the CTA is already there, and one who closed it
     while working elsewhere must not be yanked. DOM focus in an effect. */
  useEffect(() => {
    if (open && !wasOpen.current) {
      /* The header in view: the list's title, or an open thread's name. */
      requestAnimationFrame(() =>
        (titleRef.current ?? panelRef.current?.querySelector<HTMLElement>("#support-thread-title"))?.focus({
          preventScroll: true,
        })
      );
    } else if (!open && wasOpen.current) {
      if (panelRef.current?.contains(document.activeElement)) visibleCta()?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      data-support-slot
      data-open={open ? "true" : "false"}
      className={cn(
        /* ═══ THE PUSH ═══ The canvas is this element's flex sibling, so its
           width transition IS the push: 424 = a 4px gutter + the 420 panel.
           `overflow-hidden` clips the panel mid-slide. From `md`, where
           `<main>` has right and bottom padding, the slot bleeds 8px into it
           (432 wide, `-mr-2`) so Elevation/1 is not clipped; below `md` there
           is no padding to bleed into, and the bleed measured as an 8px
           horizontal scroll. */
        "relative min-h-0 shrink-0 overflow-hidden",
        "md:-mr-2 md:-mb-2 md:pr-2 md:pb-2",
        /* `motion-safe:`, not `motion-reduce:transition-none`: measured, the
           media-variant transition was emitted after the reset and won, so a
           reduced-motion reader still got a 220ms push. */
        `motion-safe:min-[768px]:transition-[width] motion-safe:min-[768px]:duration-[220ms] ${EASE}`,
        /* ═══ ITS WIDTH IS A VARIABLE (support-beside-hub) ═══ 420 everywhere
           but chat, where the canvas card (conversation + hub, 50/50) holds
           840 while it can and Support gives way first, to 348:
           `clamp(348px, 100cqi − 844px, 420px)` against `<main>`'s width
           (844 = the 840 card + the 4px gutter). */
        "[--support-w:420px]",
        /* pack v11.0: the card's width is `--chat-card` — 840 + 4, or the
           escalation room's 1000 + 4 (`globals.css`). */
        onChat && "md:[--support-w:clamp(348px,calc(100cqi-var(--chat-card)),420px)]",
        open ? "min-[768px]:w-[calc(var(--support-w)+4px)] md:w-[calc(var(--support-w)+12px)]" : "min-[768px]:w-0",
        /* ═══ 768–959: BETWEEN THE MOBILE BARS (standing rule 2) ═══ The top
           bar and the bottom bar are fixed at this tier, so the panel keeps
           their reservations clear rather than running underneath them. */
        "min-[768px]:max-md:pt-[var(--topbar-reserve)] min-[768px]:max-md:pb-[var(--nav-reserve)]",
        /* `max-[768px]` is width < 768, the exact complement of
           `min-[768px]`; it was `max-[767px]`, which left a 767px viewport
           neither a sheet nor a push (measured, support-beside-hub). */
        /* ═══ BELOW 768: A FULL-SCREEN SHEET ═══ Fixed from under the mobile
           top bar to the bottom, over the bottom bar. Under the top bar, not
           over it, so the CTA that opened it is still there to close it
           (standing rule 2); it also closes from its own header. */
        "max-[768px]:fixed max-[768px]:inset-x-0 max-[768px]:top-[var(--topbar-reserve)] max-[768px]:bottom-[var(--dev-bar-h,0px)] max-[768px]:z-50",
        !open && "max-[768px]:hidden"
      )}
    >
      <aside
        ref={panelRef}
        id="support-panel"
        /* A label, not `labelledby`: the thread view swaps the header. */
        aria-label="Support"
        inert={!open}
        onKeyDown={(e) => {
          /* Esc closes while focus is inside — the panel's own dismissal, not a
             global one, so Esc elsewhere keeps meaning what it meant. */
          if (e.key === "Escape") {
            e.stopPropagation();
            setSupportOpen(false);
          }
        }}
        className={cn(
          "flex h-full flex-col overflow-hidden bg-[var(--surface-raised)] pb-4",
          "min-[768px]:ml-1 min-[768px]:w-[var(--support-w)] min-[768px]:rounded-[4px_24px_24px_4px] min-[768px]:shadow-[var(--elevation-1)]",
          /* Under the shell's escalation banner (pack v11.0) the panel's top
             corners close: the banner is the split surface's top edge. */
          "md:group-has-[>[data-shell-banner]:not(:empty)]/main:rounded-t-none",
          "max-[768px]:w-full",
          `transition-[opacity,transform] duration-[220ms] ${EASE} motion-reduce:transition-none motion-reduce:transform-none`,
          open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
        )}
      >
        {thread ? (
          <SupportThread
            data={thread}
            messages={messages}
            now={now}
            online={online}
            onBack={() => setSupportThread(null)}
          />
        ) : (
        <>
        {/* ── HEADER, LIST STATE: 64px, raised, a bottom divider ──────────── */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[var(--surface-raised)] pr-3 pl-4">
          <h2
            ref={titleRef}
            id="support-panel-title"
            /* The focus target on open (the header, per the pack). `-1`: it is
               a landmark for focus, not a tab stop. */
            tabIndex={-1}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1 rounded-sm font-display text-[16px] font-bold leading-[24px] text-[var(--text-primary)] outline-none",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
            )}
          >
            {/* TODO-COPY */}
            Support
            {/* THE DISCLOSURE CARET IS DRAWN, NOT WIRED. Figma puts it beside
                the title and nothing in the pack says what it opens; a caret
                that opens nothing would be enabled-but-dead, so it is
                decoration until its menu is specified (flagged). */}
            <ChevronDown aria-hidden className="size-4 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </h2>
          <button type="button" {...inert} aria-label="Search support (coming soon)" className={cn(ICON_BTN, "cursor-default")}>
            <Search aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </button>
          <button type="button" {...inert} aria-label="New message (coming soon)" className={cn(ICON_BTN, "cursor-default")}>
            <SquarePen aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </button>
          {/* THE VISIBLE EXIT (Nielsen H3). Figma shows none; the pack adds it. */}
          <button
            type="button"
            data-support-close
            /* TODO-COPY */
            aria-label="Close support"
            onClick={() => setSupportOpen(false)}
            className={cn(ICON_BTN, "transition-colors hover:bg-[var(--tint-hover)]", RING)}
          >
            <X aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
          </button>
        </header>

        {/* ── BODY: the grouped list (SUP-3) ─────────────────────────────── */}
        <div ref={bodyRef} data-support-body className="min-h-0 flex-1 overflow-y-auto">
          <SupportList sections={sections} pinned={pinned} persona={persona} now={now} load={load} online={online} onOpen={openThread} />
        </div>
        </>
        )}
      </aside>
    </div>
  );
}
