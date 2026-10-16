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

import { useEffect, useRef } from "react";
import { ChevronDown, Search, SquarePen, X } from "lucide-react";
import { setSupportOpen, useSupportOpen } from "@/lib/support/panel";
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
  const panelRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const wasOpen = useRef(open);

  /* ═══ FOCUS (SUP-2) ═══
     Open: focus moves to the panel header — not trapped, so Tab continues out
     of it. Close: focus returns to the CTA, but only if it was INSIDE the panel;
     a reader who closed it from the CTA is already there, and one who closed it
     while working elsewhere must not be yanked. DOM focus in an effect. */
  useEffect(() => {
    if (open && !wasOpen.current) {
      requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
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
        open ? "min-[768px]:w-[424px] md:w-[432px]" : "min-[768px]:w-0",
        /* ═══ 768–959: BETWEEN THE MOBILE BARS (standing rule 2) ═══ The top
           bar and the bottom bar are fixed at this tier, so the panel keeps
           their reservations clear rather than running underneath them. */
        "min-[768px]:max-md:pt-[var(--topbar-reserve)] min-[768px]:max-md:pb-[var(--nav-reserve)]",
        /* ═══ BELOW 768: A FULL-SCREEN SHEET ═══ Fixed from under the mobile
           top bar to the bottom, over the bottom bar. Under the top bar, not
           over it, so the CTA that opened it is still there to close it
           (standing rule 2); it also closes from its own header. */
        "max-[767px]:fixed max-[767px]:inset-x-0 max-[767px]:top-[var(--topbar-reserve)] max-[767px]:bottom-[var(--dev-bar-h,0px)] max-[767px]:z-50",
        !open && "max-[767px]:hidden"
      )}
    >
      <aside
        ref={panelRef}
        id="support-panel"
        aria-labelledby="support-panel-title"
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
          "min-[768px]:ml-1 min-[768px]:w-[420px] min-[768px]:rounded-[4px_24px_24px_4px] min-[768px]:shadow-[var(--elevation-1)]",
          "max-[767px]:w-full",
          `transition-[opacity,transform] duration-[220ms] ${EASE} motion-reduce:transition-none motion-reduce:transform-none`,
          open ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
        )}
      >
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

        {/* ── BODY — the list arrives in SUP-3 ───────────────────────────── */}
        <div data-support-body className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
          <p className="text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY. The panel's first-run line until SUP-3's sections
                land; it says what Support is for rather than leaving a blank
                white card. */}
            Message your supervisors and the Somethings team here, without leaving what you&apos;re working on.
          </p>
        </div>
      </aside>
    </div>
  );
}
