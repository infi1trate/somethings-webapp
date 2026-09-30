"use client";

// ═══════════════════════════════════════════════════════════════════════════
// THE DEV PANEL (bar-02)
//
// ═══ WHAT IT IS, GEOMETRICALLY ═══
//
// A container whose BOTTOM EDGE IS THE BAR'S TOP EDGE, so the two read as one
// object that grew taller rather than a bar plus a floating window. The bar does
// not move: it keeps `fixed inset-x-0 bottom-0 z-50` and `DEV_BAR_H = 40`, and
// `layout.tsx` still reserves exactly that much. This sits at `bottom-[40px]`.
//
// IT OVERLAYS, IT DOES NOT REFLOW. Nothing about the page under review shifts
// when this opens, which is the whole reason it is not a sibling in flow.
//
// CAPPED AT 50vh WITH INTERNAL SCROLL. bar-02's number, and the point of it is
// that at least half the screen being reviewed stays visible — the failure the
// native 83-option select had, which filled the viewport.
//
// ═══ WHY A PANEL AND NOT A WIDER BAR ═══
//
// bar-00 measured the axis row at 1006px intrinsic against 931px available at
// 1600 — it was already clipping 75px at the widest width in the pack, and 666px
// at 1024. A sixth axis is a row in here; in the bar it was 200px nobody had.
//
// ═══ MUTUALLY EXCLUSIVE WITH THE ANNOTATION DRAWER ═══
//
// Enforced in `lib/dev/panel.ts` for the open-the-panel direction and at the
// bar's drawer toggle for the reverse — see that module on why the asymmetry
// avoids an import cycle. The reason is geometric: the drawer is
// `fixed inset-y-0 right-0 w-[22rem]`, full height, so it reaches the bar and
// would overlap this in the bottom-right corner.
//
// ═══ IT DOES NOT CLOSE ON SELECTION ═══
//
// bar-02, and it is right: setting a fixture usually means setting more than one
// axis. Esc, click-outside and the toggle close it; changing a value does not.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { useFocusTrap } from "@/lib/anno/use-focus-trap";
import { AXES, axis, type AxisId } from "@/lib/dev/axes";
import {
  SEARCH_THRESHOLD,
  SCENARIO_CATALOGUE,
  countItems,
  filterGroups,
  groupsForRoute,
  scenarioLabel,
  type ScenarioGroup,
} from "@/lib/dev/scenario-catalogue";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** The control shell every small axis uses. Native `<select>` deliberately —
 *  bar-02: "Panels don't constrain width, so there's no reason to hand-build
 *  comboboxes for four-option controls and inherit their accessibility
 *  burden." */
const SELECT =
  "min-h-9 rounded-md border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-2 text-[13px] text-[var(--text-primary)]";

export interface DevPanelProps {
  pathname: string;
  /** Which axis to focus on open. `null` focuses the first control. */
  focus: AxisId | null;
  onClose: () => void;
  /** Where focus returns. `useFocusTrap` takes this rather than inferring it,
   *  because a shortcut-opened panel captures `<body>` — measured in anno-05. */
  returnFocusTo: () => HTMLElement | null;

  personas: readonly { key: string; label: string }[];
  persona: string;
  onPersona: (key: string) => void;

  scenarioValue: string;
  onScenario: (value: string) => void;
  scenarioRecents: readonly string[];
  /** ═══ WHAT THE SELECTED RECORD SCENARIO EXERCISES ═══
   *  The bar carried this as a truncate-and-click-to-expand line, hidden below
   *  1280 — machinery it only needed because it had no width. In a panel it is
   *  just the sentence, at every width. `null` for the four axis families, which
   *  have no such text. */
  scenarioNote: string | null;

  loadOptions: readonly { value: string; label: string }[];
  loadValue: string;
  onLoad: (value: string) => void;

  clockOptions: readonly { value: string; label: string }[];
  clockValue: string;
  onClock: (value: string) => void;
}

export function DevPanel({
  pathname,
  focus,
  onClose,
  returnFocusTo,
  personas,
  persona,
  onPersona,
  scenarioValue,
  onScenario,
  scenarioRecents,
  scenarioNote,
  loadOptions,
  loadValue,
  onLoad,
  clockOptions,
  clockValue,
  onClock,
}: DevPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [term, setTerm] = useState("");

  /* Esc, Tab cycling and focus return, from the hook the annotation drawer
     already uses. It does NOT do click-outside — that is the effect below. */
  useFocusTrap(panelRef, true, onClose, returnFocusTo);

  /* ═══ CLICK-OUTSIDE, AND IT MUST IGNORE THE BAR ═══
     A pointerdown on the bar's own toggle would otherwise close the panel here
     and reopen it in the toggle's handler — a click that looks like it does
     nothing. The bar is excluded by its slot attribute rather than by a ref, so
     any control the bar gains later is covered without a second edit. */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (panelRef.current?.contains(t)) return;
      if (t.closest("[data-dev-bar-root]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onClose]);

  /* Focus the row the chip named. Deferred a frame for the same reason the
     focus trap defers its own first focus: on the commit that opens the panel
     the children may not have laid out.
     ═══ AND IT NOW HANDLES `null` TOO, BECAUSE THE CLOSE BUTTON CHANGED WHAT
         "THE FIRST CONTROL" MEANS ═══
     The prop's contract is "`null` focuses the first control", and it used to
     get that for free: the focus trap takes the first focusable descendant, and
     that was the Role radiogroup. ADDING THE CLOSE BUTTON PUT A BUTTON ABOVE IT
     IN THE DOM — measured, `first focus on open: dev-panel-close` — so a
     reviewer pressing the shortcut landed on the way OUT of the panel rather
     than on the first thing they opened it to change.
     SO THE FALLBACK IS EXPLICIT NOW rather than a consequence of DOM order. The
     close button is still one Shift+Tab away, which is the conventional place
     for it, and this is the arrangement that survives someone adding a second
     control to that strip. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const target = focus
        ? root.querySelector<HTMLElement>(
            `[data-panel-axis="${focus}"] select, [data-panel-axis="${focus}"] input, [data-panel-axis="${focus}"] button`
          )
        : /* The first control of the first AXIS, skipping the close strip —
             which is what the contract meant by "the first control". */
          root.querySelector<HTMLElement>(
            "[data-panel-axis] select, [data-panel-axis] input, [data-panel-axis] button"
          );
      target?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  /* ═══ PAGE-SCOPED BY DEFAULT (bar-02) ═══ */
  const base = useMemo<ScenarioGroup[]>(
    () => (showAll ? [...SCENARIO_CATALOGUE] : groupsForRoute(pathname)),
    [showAll, pathname]
  );
  const visible = useMemo(() => filterGroups(base, term), [base, term]);
  const visibleCount = countItems(visible);
  /* The threshold is measured against the UNFILTERED set, so the field does not
     vanish under the hand of someone typing into it. */
  const showSearch = countItems(base) > SEARCH_THRESHOLD;

  const recents = scenarioRecents
    .map((v) => ({ value: v, label: scenarioLabel(v) }))
    /* An id that no longer resolves is dropped HERE rather than in the store —
       the store cannot import the registries without a cycle. See its note. */
    .filter((r): r is { value: string; label: string } => !!r.label);

  /* ═══ OUT OF SCOPE MEANS "BELONGS SOMEWHERE ELSE", NOT "UNRESOLVED" ═══
     MEASURED on Today: the notice read "Today belongs to another surface and
     changes nothing on this page" WHILE ON TODAY. The cause is that
     `todayScenarioId` is null — it is absent from the store's persist
     partialize, which is bar-00's own finding — so `scenarioValue` is the bare
     prefix `today:`, which resolves to no group, and "no group" was being
     treated as "another surface's group".
     SO THE VALUE MUST RESOLVE FIRST. An unset or unrecognised scenario is not
     out of scope; it is simply not set, and the panel says nothing about it. */

  /** The axes that do not apply here, for the collapsed group at the bottom. */
  const inapplicable = AXES.filter((a) => a.appliesTo(pathname) === "n/a");

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      /* TODO-COPY */
      aria-label="Prototype state"
      data-anno-ref="dev-panel"
      /* ═══ THE BAR'S TOP EDGE IS THIS PANEL'S BOTTOM (see the header) ═══
         `bottom-[40px]` is `DEV_BAR_H`, written as the literal it is because a
         Tailwind arbitrary value cannot read a TS const. The bar exports the
         constant and a test pins the two together rather than a comment asking
         nicely. */
      className={cn(
        "fixed inset-x-0 bottom-[40px] z-50 flex max-h-[50vh] flex-col",
        "border-t border-[color:var(--border-contour)] bg-[var(--surface-s1)]",
        "shadow-[var(--shadow-panel)]"
      )}
    >
      {/* ═══ THE CLOSE BUTTON — A FOURTH WAY OUT, AND THE ONLY VISIBLE ONE ═══
          The panel already closed on Esc, on click-outside, and on the `DEV`
          toggle that opened it. NONE OF THE THREE IS DISCOVERABLE: Esc is
          unlabelled, click-outside is unlabelled and undiscoverable by
          definition, and the toggle is behind the panel's own bottom edge in the
          bar — so a reviewer looking at an open 50vh panel has nothing on screen
          telling them how to put it away. Nielsen #6, recognition over recall.
          The toggle keeps `aria-expanded`, so this is an addition rather than a
          second source of truth: both call `closeDevPanel`.

          ═══ IN FLOW, NOT ABSOLUTE ═══
          A floated `×` in the panel's top-right corner would sit over the first
          row's content — the scroller's inner column is `max-w-[880px]` and
          centred, so there is clearance at 1600 and none at 900. This strip is a
          flex child ABOVE the scroller, so it cannot overlap anything and cannot
          scroll away from a reviewer who has paged down 82 scenarios.
          NO TITLE BESIDE IT. The dialog's name is on `aria-label`, and a visible
          heading is chrome this panel has done without; the strip holds the one
          control it was added for. */}
      <div className="flex shrink-0 justify-end px-3 pt-2">
        <button
          type="button"
          data-anno-ref="dev-panel-close"
          /* TODO-COPY. Names the action and its object, matching the bar
             toggle's own label rather than the bare "Close" a lone glyph would
             otherwise announce. */
          aria-label="Close prototype state"
          title="Close (Esc)"
          onClick={onClose}
          className={cn(
            /* 28x28. SC 2.5.8 wants 24 and bar-02 measured zero targets under
               it on this surface — including fixing the annotation drawer's
               26x22 — so a new control may not be the one that reintroduces
               that. 28 also matches the `DEV` toggle's `min-h-7`. */
            "flex size-7 items-center justify-center rounded-md transition-colors",
            "text-[var(--text-muted)] hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)]",
            RING
          )}
        >
          {/* `aria-hidden`: the accessible name is on the button. A labelled
              glyph would be announced twice. */}
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {/* `pt-1` RATHER THAN `py-3`: the strip above already spends the top
          padding, and 12px more would put the first axis row 20px from the
          panel's edge while every other gap in here is 12. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-1">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3">
          {/* ── ROLE ─────────────────────────────────────────────────────── */}
          <Row id="role" pathname={pathname}>
            <div
              role="radiogroup"
              /* TODO-COPY */
              aria-label="Role"
              className="flex flex-wrap items-center gap-1"
            >
              {personas.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={persona === p.key}
                  onClick={() => onPersona(p.key)}
                  className={cn(
                    "min-h-9 rounded-full px-3 text-[13px] transition-colors",
                    persona === p.key
                      ? "bg-[var(--text-primary)] font-semibold text-[var(--text-inverse)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Row>

          {/* ── SCENARIO ─────────────────────────────────────────────────── */}
          <Row id="scenario" pathname={pathname}>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {/* RECENTS, CAPPED AT FIVE. Above the list because its whole job
                  is to be reached before the list is scanned. */}
              {recents.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* ═══ 12px, NOT 11 ═══
                      The first pass used `text-[11px]` for the three quiet
                      labels in here, and 11 is OFF BLOOM'S SCALE — its smallest
                      step is 12, which is the same finding Phase M recorded
                      about the schedule rail's time labels. Uppercase, tracking
                      and `--text-muted` carry "quiet" without inventing a type
                      size that exists nowhere else in the product. */}
                  <span className="text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {/* TODO-COPY */}
                    Recent
                  </span>
                  {recents.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => onScenario(r.value)}
                      className={cn(
                        "min-h-9 max-w-[16rem] truncate rounded-full border px-3 text-[12px]",
                        r.value === scenarioValue
                          ? "border-[color:var(--text-primary)] font-semibold text-[var(--text-primary)]"
                          : "border-[color:var(--border-contour)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                        RING
                      )}
                      title={r.label}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {/* SEARCH, ONLY PAST THE THRESHOLD (bar-02) */}
                {showSearch && (
                  <span className="relative flex min-w-[12rem] flex-1 items-center">
                    <Search
                      aria-hidden
                      className="absolute left-2 size-3.5 text-[var(--text-muted)]"
                    />
                    <input
                      type="search"
                      value={term}
                      onChange={(e) => setTerm(e.target.value)}
                      /* TODO-COPY */
                      aria-label="Filter scenarios"
                      placeholder="Filter scenarios"
                      className={cn(SELECT, "w-full pl-7", RING)}
                    />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  aria-pressed={showAll}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full border border-[color:var(--border-contour)] px-3 text-[12px]",
                    showAll
                      ? "bg-[var(--text-primary)] font-semibold text-[var(--text-inverse)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  {/* TODO-COPY. Names the STATE it switches to, not the state it
                      is in — the convention the rest of this product's toggles
                      use. */}
                  {showAll ? "This page only" : "Show all"}
                </button>
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-muted)]">
                  {/* TODO-COPY. The denominator is the whole catalogue, so a
                      reviewer can see that scoping is hiding things rather than
                      that nothing exists. */}
                  {`${visibleCount} of ${countItems([...SCENARIO_CATALOGUE])}`}
                </span>
              </div>

              {/* THE LIST. A native `<select size>` would not give per-group
                  headings and a search box together, so this is a listbox of
                  buttons — the only hand-built control in the panel, and it is
                  the one bar-02 says needs real search. */}
              {visible.length === 0 ? (
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {/* TODO-COPY. Two different emptinesses, said differently. */}
                  {term
                    ? "No scenarios match that."
                    : "No scenarios for this page. Use Show all to reach the others."}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {visible.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1 text-[12px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
                        {g.label}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {g.items.map((i) => (
                          <button
                            key={i.value}
                            type="button"
                            onClick={() => onScenario(i.value)}
                            aria-current={i.value === scenarioValue || undefined}
                            className={cn(
                              "min-h-9 rounded-full border px-3 text-[12px]",
                              i.value === scenarioValue
                                ? "border-[color:var(--text-primary)] bg-[var(--tint-hover)] font-semibold text-[var(--text-primary)]"
                                : "border-[color:var(--border-contour)] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                              RING
                            )}
                          >
                            {i.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* THE RECORD SCENARIO'S OWN DESCRIPTION, restored here from the
                  bar — see the prop's note on why it loses the expand control. */}
              {scenarioNote && (
                <p
                  data-anno-ref="dev-panel-scenario-note"
                  className="text-[12px] text-[var(--text-secondary)]"
                >
                  {scenarioNote}
                </p>
              )}

              {/* ═══ WHAT WAS HERE: THE OUT-OF-SCOPE NOTICE, AND WHY IT IS NOT ═══
                  bar-02: "Selecting an out-of-scope scenario is allowed and must
                  SAY it doesn't apply here, not silently no-op." I built the
                  notice, then measured that it can never fire.
                  IT IS UNREACHABLE BY CONSTRUCTION. `scenarioValue` is derived
                  PER ROUTE — bar-01's own "the value follows the screen, not the
                  last click" — so on any route it reads that route's own axis and
                  can never hold another surface's value. And picking another
                  family's scenario does not leave you here to be told about it:
                  `selectScenario` navigates to the route the axis applies to,
                  which is the existing behaviour and a stronger answer to
                  bar-02's actual worry than a sentence would be. Measured:
                  clicking "Care · no open review" from Today landed on
                  `/app/care-reviews`.
                  SO THE REQUIREMENT IS MET AND THE UI IS NOT NEEDED. Shipping a
                  notice that cannot render is the dead chrome this project's
                  extensibility threshold forbids; `scenarioAppliesHere` stays in
                  the catalogue for the day a surface stops navigating. */}
            </div>
          </Row>

          {/* ── LOAD ─────────────────────────────────────────────────────── */}
          <Row id="load" pathname={pathname}>
            <select
              /* TODO-COPY */
              aria-label="Load state"
              value={loadValue}
              onChange={(e) => onLoad(e.target.value)}
              className={cn(SELECT, RING)}
            >
              {loadOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Row>

          {/* ── CLOCK ────────────────────────────────────────────────────── */}
          {axis("clock").appliesTo(pathname) !== "n/a" && (
            <Row id="clock" pathname={pathname}>
              <select
                /* TODO-COPY */
                aria-label="Pinned clock"
                value={clockValue}
                onChange={(e) => onClock(e.target.value)}
                className={cn(SELECT, RING)}
              >
                {clockOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Row>
          )}

          {/* ═══ THE AXES THAT DO NOT APPLY, VISIBLE BUT OUT OF THE WAY ═══
              bar-02: "Inapplicable axes appear in a collapsed `Not used on this
              page` group at the bottom — visible, so it's clear they exist, but
              out of the way."
              A `<details>` rather than a hand-rolled disclosure: it is
              keyboard- and screen-reader-complete for free, which is the same
              argument the panel uses for native selects. */}
          {inapplicable.length > 0 && (
            <details data-anno-ref="dev-panel-inapplicable" className="mt-1">
              <summary
                className={cn(
                  "flex min-h-9 cursor-pointer list-none items-center gap-1.5",
                  "text-[12px] text-[var(--text-secondary)]",
                  RING
                )}
              >
                <ChevronDown aria-hidden className="size-3.5 shrink-0" />
                {/* TODO-COPY */}
                {`Not used on this page (${inapplicable.length})`}
              </summary>
              <ul className="mt-2 flex flex-col gap-1 pl-5">
                {inapplicable.map((a) => (
                  <li key={a.id} className="text-[12px] text-[var(--text-muted)]">
                    <span className="font-semibold">{a.label}</span>
                    {" — "}
                    {a.reason(pathname)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

/** One labelled axis row. The label comes from `axes.ts`, so the panel and the
 *  bar cannot name an axis two ways, and the `recorded` note rides along for the
 *  same reason it does in the bar. */
function Row({
  id,
  pathname,
  children,
}: {
  id: AxisId;
  pathname: string;
  children: React.ReactNode;
}) {
  const decl = axis(id);
  const state = decl.appliesTo(pathname);
  const reason = state === "live" ? null : decl.reason(pathname);
  return (
    <div
      data-panel-axis={id}
      data-applicability={state}
      className="flex flex-col gap-1 border-b border-[color:var(--border-subtle)] pb-3 last:border-b-0 last:pb-0"
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {decl.label}
        </span>
        {reason && (
          <span className="text-[12px] italic text-[var(--text-muted)]">
            {reason}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
    </div>
  );
}
