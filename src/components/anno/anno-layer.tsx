"use client";

// THE ANNOTATION LAYER — R11 non-interference, R2 placement.
//
// ═══ NON-INTERFERENCE IS THE FIRST REQUIREMENT, NOT THE LAST ═══
//
// A review tool that changes the thing being reviewed is worse than no review
// tool: every finding becomes suspect. So the pointer story is settled before
// anything else, in three layers:
//
//   OFF    — this component returns `null`. No root, no listeners, no observers,
//            nothing in the DOM. The prototype is byte-identical to itself
//            without the feature. Not "a layer with pointer-events: none" —
//            actually absent.
//   VIEW   — root is `pointer-events: none`; only the pins opt back in with
//            `auto`. Every pixel that is not a 24px pin passes the click through
//            to the product.
//   PLACE  — a full-viewport capture surface with `pointer-events: auto` sits
//            under the pins and takes every click. The product is deliberately
//            unreachable, which is why the armed state has to be unmistakable.
//
// ═══ WHY z-index 60 ═══
//
// anno-00 measured the ladder: `z-50` is a crowded FLOOR shared by six component
// families (dialog, popover, select, dropdown, the survey tooltip, the dev bar),
// with nothing above it. 60 is the first free step, and being above the dialog
// layer is a deliberate choice — a modal is exactly where a reviewer most wants
// to leave a comment, and suppressing the layer under it would make dialogs the
// one part of the product that cannot be annotated. The cost is that the capture
// surface also covers an open dialog while armed; logged in GAPS.md, because the
// PRD did not decide it.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { annotationStore } from "@/lib/anno";
import { isAnnoError } from "@/lib/anno/errors";
import { annoRoleFromPersona, type Comment } from "@/lib/anno/types";
import { captureAnchor, resolveAnchor, whyRefused, type Anchor } from "@/lib/anno/anchor";
import { observeReposition, settleAfter } from "@/lib/anno/observe";
import { getClientId } from "@/lib/anno/identity";
import { setDrawerOpen, setMode, useAnnoMode, useDrawerOpen } from "@/lib/anno/mode";
import { arrival, buildCommentLink, copyLink } from "@/lib/anno/deeplink";
import { useOnboardingStore } from "@/lib/onboarding/store";
import {
  ClusterPin,
  Pin,
  CLUSTER_RADIUS,
  PIN_HIT,
  PIN_SEP,
  type PinState,
} from "@/components/anno/pin";
import { clusterByProximity, fanOut } from "@/lib/anno/cluster";
import { AnnoComposer } from "@/components/anno/anno-composer";
import { AnnoDrawer } from "@/components/anno/anno-drawer";
import { cn } from "@/lib/utils";

/** Above the `z-50` floor. See the module note. */
const LAYER_Z = 60;

type Placed = {
  comment: Comment;
  x: number;
  y: number;
  /** An unconfirmed optimistic echo — no server number yet. */
  pending: boolean;
  state: PinState;
  visible: boolean;
};

type Draft = {
  x: number;
  y: number;
  anchor: Anchor;
  /** True once a batch modifier was held at placement — suppresses auto-return. */
  batch: boolean;
};

export function AnnoLayer() {
  const mode = useAnnoMode();
  /** ═══ THE ROUTE COMES FROM THE ROUTER, NOT FROM `window.location` ═══
   *
   *  This component is mounted once in the ROOT layout and is not remounted by a
   *  client-side navigation, so anything it reads imperatively is read once and
   *  then silently goes stale. `window.location.pathname` inside the projection
   *  below looked correct — the value is live at the moment it is read — but
   *  nothing was re-reading it: the effect was keyed on `mode` alone, so a
   *  navigation ran no projection at all.
   *
   *  Measured, before this line existed: four pins written on
   *  `/admin/person/t13` stayed painted on `/app/mentees` at IDENTICAL viewport
   *  coordinates (270/341, 360/411, 460/491, 115/89) — not re-anchored to the new
   *  page, just frozen where they were. A comment about one page floating over
   *  another is the precise failure R11 exists to prevent: it does not merely look
   *  wrong, it makes the reviewer distrust every pin they see.
   *
   *  `usePathname` re-renders on navigation, which is what turns the route into a
   *  dependency an effect can actually watch. It is already the layout-level
   *  idiom here — the sibling `DevBar` reads the route the same way. */
  const pathname = usePathname();
  const drawerOpen = useDrawerOpen();
  const persona = useOnboardingStore((s) => s.persona);
  const loadState = useOnboardingStore((s) => s.devLoadState);

  const [pins, setPins] = useState<Placed[]>([]);
  /** ═══ THE DEEPLINK TARGET STARTS SELECTED ═══
   *
   *  Not cosmetic — it is the STATIC focus indicator the reduced-motion path
   *  needs. `.focus()` called from script does not set `:focus-visible`
   *  (measured: `matchesFocusVisible: false`), so a focus-ring class alone would
   *  draw nothing for an arriving reviewer. The selected treatment is a real
   *  boxShadow ring that does not depend on the browser's heuristic, and it
   *  doubles as the reason the pin's Copy-link control is already showing. */
  const [selected, setSelected] = useState<string | null>(arrival.commentId);
  /** ═══ ONE CLUSTER OPEN AT A TIME ═══
   *
   *  Keyed by membership (see `cluster.ts`), not by index — an index would move
   *  the expansion onto a different group the moment a comment is added or
   *  resolved. One at a time because two open clusters can fan into each other,
   *  which would put the layer back in the overlapping state R17 exists to
   *  remove. */
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  /** ═══ WHY A DEEPLINK'S CLUSTER IS DERIVED, NOT SET IN AN EFFECT ═══
   *
   *  A link to a comment that happens to be stacked with another must land on a
   *  VISIBLE pin — a collapsed cluster contributes no pin, so the arrival would
   *  scroll to, focus and pulse an element that is not in the document.
   *
   *  The obvious implementation is an effect that expands it on arrival, and this
   *  repo forbids that: `react-hooks/set-state-in-effect`. So the open cluster is
   *  DERIVED — the arrival's cluster is open until the reviewer touches a cluster
   *  themselves, at which point their choice takes over permanently. One less
   *  piece of state to get out of sync, and no effect writing state during a
   *  commit. */
  const [clusterChosen, setClusterChosen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  /* Refs mirror state for the key handler, which is bound once and must not be
     rebuilt on every keystroke in the composer. Written in an effect, never
     during render (`react-hooks/refs`). */
  const draftRef = useRef<Draft | null>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  /* ═══ CLUSTER, THEN DECIDE WHICH ONE IS OPEN — R17 ═══
     Derived every render from the pin set. Fed in COMMENT-NUMBER ORDER so the
     grouping is identical in every browser: greedy clustering is order-dependent,
     and two reviewers who disagree about which pins are "the cluster of three"
     cannot talk about it. `pins` arrives number-ascending from the repo's sort. */
  const clusters = clusterByProximity(
    pins
      .filter((p) => p.visible)
      .map((p) => ({ id: p.comment.id, x: p.x, y: p.y, pin: p })),
    CLUSTER_RADIUS
  );

  /** The cluster holding the deeplink target, if it is stacked with anything. */
  const arrivalCluster = arrival.commentId
    ? clusters.find(
        (c) =>
          c.members.length > 1 &&
          c.members.some((m) => m.id === arrival.commentId)
      )
    : undefined;

  /** What is actually open. The reviewer's choice wins as soon as they make one. */
  const openCluster = clusterChosen ? expandedCluster : (arrivalCluster?.key ?? null);

  const toggleCluster = (key: string) => {
    setClusterChosen(true);
    setExpandedCluster(openCluster === key ? null : key);
  };

  /** ═══ ARRIVAL — STEP 2 AND 3 OF R7 ═══
   *
   *  Step 1 (role/scenario/load) already happened at import, before this
   *  component existed. What is left needs a mounted DOM: open the drawer, and
   *  put the layer into View so the target pin can be shown at all — a deeplink
   *  that lands with the layer Off would show the comment in the list and
   *  nothing on the page.
   *
   *  ONCE. A ref, not state: re-running on a later render would fight a reviewer
   *  who closed the drawer. */
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current || !arrival.commentId) return;
    arrived.current = true;
    setDrawerOpen(true);
    if (mode === "off") setMode("view");
  }, [mode]);

  const clearDraft = useCallback(() => {
    setDraft(null);
    setDirty(false);
    setConfirmDiscard(false);
    setError(null);
  }, []);

  /** ═══ Esc, FROM ANYWHERE ═══
   *
   *  Bound on the WINDOW in the capture phase, so it fires whether focus is in
   *  the composer, on a pin, or somewhere in the product — the brief's "from
   *  anywhere, including with the composer open" is only true if the listener is
   *  not scoped to the layer's own subtree.
   *
   *  The ladder is deliberate: Esc first backs out of the confirmation, then the
   *  draft, then the mode. One press never both discards a comment and disarms —
   *  a reviewer pressing Esc to dismiss a dialog would otherwise lose Place mode
   *  as a side effect. */
  useEffect(() => {
    if (mode === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmDiscard) {
        e.preventDefault();
        setConfirmDiscard(false);
        return;
      }
      if (draftRef.current) {
        e.preventDefault();
        if (dirtyRef.current) setConfirmDiscard(true);
        else clearDraft();
        return;
      }
      /* An expanded cluster is backed out of BEFORE the mode is. Same rule as
         the draft above: one press never does two things, so a reviewer closing
         a fan does not also disarm Place as a side effect. */
      if (openCluster) {
        e.preventDefault();
        setClusterChosen(true);
        setExpandedCluster(null);
        return;
      }
      if (mode === "place") {
        e.preventDefault();
        setMode("view");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, confirmDiscard, clearDraft, openCluster]);

  /* Load and keep pins positioned. */
  useEffect(() => {
    /* No `setPins([])` here — the component returns `null` in Off mode, so stale
       pins are unrenderable, and clearing them would be a synchronous setState in
       an effect body (which this repo forbids) to no visible effect. The next
       transition into View re-fetches. */
    if (mode === "off") return;
    let alive = true;
    const store = annotationStore();

    const project = (comments: Comment[]): Placed[] => {
      return comments
        .filter((c) => !c.deletedAt && c.context.route === pathname)
        .map((c) => {
          const r = resolveAnchor(c.anchor as Anchor);
          /* ═══ AN OPTIMISTIC ECHO IS NOT A NUMBERED COMMENT ═══
             `SharedAnnotationStore` inserts a local echo the instant Save is
             pressed, carrying `number: 0` and a `local-` id until the server
             allocates the real values. Rendering that straight produced a pin
             reading "0" — measured, with two of them on screen at once while the
             store was unreachable. Zero is not a comment number and cannot be
             said out loud, so a pending echo renders in the GHOST treatment:
             reduced opacity, no number. It becomes a numbered pin when the
             reconciliation arrives. */
          const pending = c.number === 0 || c.id.startsWith("local-");
          return {
            comment: c,
            x: r.x,
            y: r.y,
            pending,
            state: (pending
              ? "ghost"
              : r.tier === 3
                ? "lost"
                : c.status === "resolved"
                  ? "resolved"
                  : "unresolved") as PinState,
            // An offscreen pin is positioned but must not be painted.
            visible: r.tier === 3 || !r.offscreen,
          };
        });
    };

    store
      .list()
      .then((cs) => {
        if (alive) setPins(project(cs));
      })
      .catch(() => {
        /* Store unreachable. The layer stays empty rather than guessing — and the
           mode control is what tells the reader, not a pin that isn't there. */
      });

    /* ═══ RE-PROJECT FROM THE STORE, NOT FROM WHAT IS ON SCREEN ═══
       Narrowing from `prev` made the route filter ONE-WAY. The first reposition
       after a navigation correctly dropped the previous page's pins — and because
       every later reposition started from that emptied list, they could never come
       back. Measured: leaving `/admin/person/t13`, scrolling once, then navigating
       back showed 0 of its 4 comments, so the one page guaranteed not to display a
       comment was the page it was written on.

       `snapshot()` is the store's cache read synchronously — no request, which is
       what the subscribe note below is about — so every reposition re-filters the
       full set and the filter stays reversible. */
    const reposition = () => {
      setPins(project(store.snapshot()));
    };
    const handle = observeReposition({ scrollContainers: [], onReposition: reposition });
    const cancelSettle = settleAfter(reposition);
    /* ═══ SUBSCRIBERS READ `snapshot()`, NEVER `list()` ═══
       `list()` is a request. Reacting to "something changed" by making a request
       is what produced anno-04's fetch loop, and even with `list()` no longer
       emitting it would still put a network round trip in front of every
       optimistic echo — defeating the point of the echo. `snapshot()` is the
       cache, synchronously. */
    const unsub = store.subscribe(() => {
      if (alive) setPins(project(store.snapshot()));
    });

    return () => {
      alive = false;
      handle.disconnect();
      cancelSettle();
      unsub();
    };
  }, [mode, pathname]);

  /** ═══ STEP 3: SCROLL, FOCUS, PULSE ONCE ═══
   *
   *  Waits for the pin to actually resolve — on arrival the anchor may still be
   *  settling (anno-00 catalogued six regions whose geometry lands up to 700ms
   *  late), so this runs off the pin list rather than off mount.
   *
   *  ═══ THE PULSE USES THE WEB ANIMATIONS API, NOT A CSS CLASS ═══
   *
   *  There is no `lib/motion.ts` in this repo to draw a constant from — anno-00
   *  established that; durations are inline per component. So the timing is
   *  borrowed from the closest existing precedent: `care-timeline.tsx` flashes a
   *  targeted row for 800ms, which is the same job as this. Driving it from JS
   *  rather than a new keyframe also avoids the risk that an appended
   *  `globals.css` rule never reaches the served bundle — which has bitten this
   *  codebase before.
   *
   *  REDUCED MOTION GETS NO ANIMATION AT ALL, not a faster one: the pin is
   *  focused, so it carries a real focus ring, and that is the static
   *  equivalent. */
  const pulsed = useRef(false);
  useEffect(() => {
    if (pulsed.current || !arrival.commentId) return;
    const target = pins.find((p) => p.comment.id === arrival.commentId && p.visible);
    if (!target) return;
    const el = document.querySelector<HTMLElement>(
      `[data-anno-pin-id="${arrival.commentId}"]`
    );
    if (!el) return;
    pulsed.current = true;

    el.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    el.focus({ preventScroll: true });

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof el.animate !== "function") return;
    el.animate(
      [
        { boxShadow: "0 0 0 0 rgba(123,91,214,0.55)" },
        { boxShadow: "0 0 0 14px rgba(123,91,214,0)" },
      ],
      { duration: 800, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
    );
    /* `openCluster` IS a dependency: a deeplinked comment inside a stack has no
       pin until its cluster opens, so the pulse has to be able to run on the
       render where that happens rather than only on the one where pins arrive. */
  }, [pins, openCluster]);

  /** A click on the capture surface. */
  const onCapture = (e: React.MouseEvent) => {
    if (mode !== "place") return;
    /* THE ELEMENT UNDER THE CURSOR, not the capture surface. `elementFromPoint`
       is asked with the surface temporarily transparent to hit-testing, which is
       the only way to learn what the reviewer was actually pointing at. */
    const surface = e.currentTarget as HTMLElement;
    const prev = surface.style.pointerEvents;
    surface.style.pointerEvents = "none";
    const target = document.elementFromPoint(e.clientX, e.clientY);
    surface.style.pointerEvents = prev;
    if (!target) return;

    const anchor = captureAnchor(target, e.clientX, e.clientY);
    if (!anchor) {
      /* REFUSED, AND SAID SO. anno-02's gate decision restricts placement to
         stable regions, so a click on a task row produces nothing — and silence
         would read as a broken feature. The reason distinguishes the two cases. */
      setRefusal(
        whyRefused(target) === "volatile"
          ? "Can't comment on a single row — try the list or panel around it."
          : "Nothing to anchor to here. Try a panel, card or control."
      );
      window.setTimeout(() => setRefusal(null), 2600);
      return;
    }
    setError(null);
    setDraft({ x: e.clientX, y: e.clientY, anchor, batch: e.altKey });
  };

  const commit = async (body: string) => {
    const d = draftRef.current;
    if (!d) return;
    setSaving(true);
    setError(null);
    try {
      await annotationStore().create({
        authorClientId: getClientId(),
        body,
        anchor: d.anchor,
        context: {
          /* THE SAME VALUE THE PIN IS FILTERED AGAINST. Storing
             `window.location.pathname` here while projecting against the router's
             pathname would let a comment be saved with a route its own page does
             not match — invisible the moment it is written. */
          route: pathname,
          role: annoRoleFromPersona(persona),
          scenario: new URLSearchParams(window.location.search).get("scenario") ?? "",
          loadState,
          viewportWidth: window.innerWidth,
        },
      });
      clearDraft();
      /* ═══ AUTO-RETURN, UNLESS THE REVIEWER ASKED TO STAY ═══
         One comment is the common case, so Place disarms itself and the reviewer
         is not left with the product still uncliclable. Alt-click at placement
         time means "I have several" and suppresses it. */
      if (!d.batch) setMode("view");
    } catch (err) {
      setError(isAnnoError(err) ? err.userMessage : "Couldn't save that comment.");
    } finally {
      setSaving(false);
    }
  };

  /* ═══ OFF MEANS ABSENT — UNLESS THE DRAWER IS OPEN ═══
     The drawer is the KEYBOARD equivalent of the pin layer, so it has to be
     reachable without first arming a visual mode. Off with the drawer open
     renders the drawer and nothing else: no root over the prototype, no pins, no
     capture surface. */
  if (mode === "off") return drawerOpen ? <AnnoDrawer targetCommentId={arrival.commentId} /> : null;

  const armed = mode === "place";

  /* Everything that gets a real pin this frame, at the position it is painted:
     singletons where they resolved, expanded members on their fan. A collapsed
     cluster contributes NO pins — its badge stands for all of them, which is the
     whole mechanism. */
  const painted = clusters.flatMap((c) => {
    if (c.members.length === 1) {
      const m = c.members[0];
      return [{ pin: m.pin, x: m.x, y: m.y }];
    }
    if (openCluster !== c.key) return [];
    const offsets = fanOut(c.members.length, PIN_SEP);
    return c.members.map((m, i) => ({
      pin: m.pin,
      x: c.x + offsets[i].dx,
      y: c.y + offsets[i].dy,
    }));
  });

  return (
    <div
      data-anno-layer={mode}
      /* THE ROOT NEVER TAKES A POINTER EVENT. Everything that does opts in. */
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: LAYER_Z }}
    >
      {/* ── THE CAPTURE SURFACE — Place mode only ─────────────────────── */}
      {armed && (
        <div
          data-anno-capture
          onClick={onCapture}
          className="pointer-events-auto absolute inset-0"
          style={{ cursor: "crosshair" }}
        />
      )}

      {/* ── PINS — singletons, plus the members of an expanded cluster ─── */}
      {painted.map(({ pin: p, x, y }) => (
        <Pin
          key={p.comment.id}
          id={p.comment.id}
          number={p.pending ? null : p.comment.number}
          state={p.state}
          selected={selected === p.comment.id}
          onSelect={() => setSelected((s) => (s === p.comment.id ? null : p.comment.id))}
          style={{ left: x, top: y }}
        />
      ))}

      {/* ── CLUSTER BADGES ────────────────────────────────────────────────
          Rendered AFTER the pins so an expanded fan's collapse control sits
          above its own members where they pass near the centre. */}
      {clusters.map(
        (c) =>
          c.members.length > 1 && (
            <ClusterPin
              key={c.key}
              count={c.members.length}
              expanded={openCluster === c.key}
              onToggle={() => toggleCluster(c.key)}
              style={{ left: c.x, top: c.y }}
            />
          )
      )}

      {/* ── THE GHOST + COMPOSER ──────────────────────────────────────── */}
      {draft && (
        <>
          <Pin number={null} state="ghost" style={{ left: draft.x, top: draft.y }} />
          <AnnoComposer
            x={draft.x}
            y={draft.y}
            saving={saving}
            error={error}
            onSave={commit}
            onCancel={() => (dirty ? setConfirmDiscard(true) : clearDraft())}
            onDirtyChange={setDirty}
          />
        </>
      )}

      {/* ── DISCARD CONFIRMATION — only ever shown for a dirty field ───── */}
      {confirmDiscard && (
        <div
          role="alertdialog"
          aria-label="Discard this comment?"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "pointer-events-auto absolute left-1/2 top-1/2 w-[19rem] -translate-x-1/2 -translate-y-1/2",
            "rounded-[var(--radius-control)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] p-3 shadow-[var(--shadow-card)]"
          )}
        >
          <p
            className="text-[var(--text-primary)]"
            style={{ font: "var(--type-card-title)" }}
          >
            Discard this comment?
          </p>
          <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
            What you have written will be lost.
          </p>
          <div className="mt-3 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="rounded-full px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]"
            >
              {/* THE ACTION NAME PERSISTS: the reader was writing a comment, so
                  the way back says so. */}
              Keep writing
            </button>
            <button
              type="button"
              onClick={clearDraft}
              className="rounded-full bg-[var(--state-error)] px-3 py-1 text-[12px] font-semibold text-white hover:opacity-90"
            >
              Discard comment
            </button>
          </div>
        </div>
      )}

      {/* ── THE ARMED AFFORDANCE ──────────────────────────────────────────
          PERSISTENT, not a toast. While the product is unclickable the reader
          must be able to find out why at any moment, not only in the two seconds
          after they armed it. Bottom-centre, above the dev bar's own 40px. */}
      {armed && !draft && (
        <div
          data-anno-armed
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5",
            "border border-[color:var(--border-contour)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]"
          )}
          style={{ bottom: `calc(var(--dev-bar-h, 0px) + 12px)` }}
        >
          <span
            className="flex items-center gap-2 text-[12px] leading-[16px] text-[var(--text-primary)]"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: "#7b5bd6", boxShadow: "0 0 0 1px #6e6b67" }}
            />
            Placing a comment · Esc to cancel
          </span>
        </div>
      )}

      {/* ═══ COPY LINK ON THE SELECTED PIN ═══
          Appears only for the selected pin — a control on every pin would be
          24px of chrome per comment on top of the prototype. */}
      {(() => {
        /* FROM `painted`, not from `pins`. A comment inside a COLLAPSED cluster
           has no pin on screen, so a chip anchored to its resolved position
           would float over content with nothing to belong to. */
        const sel = painted.find(({ pin }) => pin.comment.id === selected);
        if (!sel) return null;
        return (
          <div
            className="pointer-events-auto absolute flex items-center gap-1.5"
            style={{ left: sel.x + PIN_HIT / 2 + 6, top: sel.y - 12 }}
          >
            <button
              type="button"
              aria-label={`Copy link to comment ${sel.pin.comment.number}`}
              title={`Copy link to comment ${sel.pin.comment.number}`}
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await copyLink(buildCommentLink(sel.pin.comment));
                setCopied(ok ? "ok" : "fail");
                window.setTimeout(() => setCopied(null), 2200);
              }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] leading-[15px]",
                "border border-[color:var(--border-contour)] bg-[var(--surface-card)] text-[var(--text-secondary)]",
                "shadow-[var(--shadow-card)] hover:text-[var(--text-primary)]"
              )}
            >
              {copied === "ok" ? "Link copied" : copied === "fail" ? "Couldn't copy" : "Copy link"}
            </button>
          </div>
        );
      })()}

      {drawerOpen && <AnnoDrawer targetCommentId={arrival.commentId} />}

      {/* ── A REFUSED PLACEMENT, EXPLAINED ────────────────────────────── */}
      {refusal && (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1.5",
            "border border-[color:var(--border-contour)] bg-[var(--band-sand-bg)]"
          )}
          style={{ bottom: `calc(var(--dev-bar-h, 0px) + 52px)` }}
        >
          <span className="text-[12px] leading-[16px] text-[var(--band-sand-fg)]">
            {refusal}
          </span>
        </div>
      )}
    </div>
  );
}
