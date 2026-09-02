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
import { annotationStore } from "@/lib/anno";
import { isAnnoError } from "@/lib/anno/errors";
import { annoRoleFromPersona, type Comment } from "@/lib/anno/types";
import { captureAnchor, resolveAnchor, whyRefused, type Anchor } from "@/lib/anno/anchor";
import { observeReposition, settleAfter } from "@/lib/anno/observe";
import { getClientId } from "@/lib/anno/identity";
import { setDrawerOpen, setMode, useAnnoMode, useDrawerOpen } from "@/lib/anno/mode";
import { arrival, buildCommentLink, copyLink } from "@/lib/anno/deeplink";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { Pin, type PinState } from "@/components/anno/pin";
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
      if (mode === "place") {
        e.preventDefault();
        setMode("view");
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, confirmDiscard, clearDraft]);

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
      const route = window.location.pathname;
      return comments
        .filter((c) => !c.deletedAt && c.context.route === route)
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

    const reposition = () => {
      setPins((prev) => project(prev.map((p) => p.comment)));
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
  }, [mode]);

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
  }, [pins]);

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
          route: window.location.pathname,
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

      {/* ── PINS ──────────────────────────────────────────────────────── */}
      {pins.map(
        (p) =>
          p.visible && (
            <Pin
              key={p.comment.id}
              id={p.comment.id}
              number={p.pending ? null : p.comment.number}
              state={p.state}
              selected={selected === p.comment.id}
              onSelect={() => setSelected((s) => (s === p.comment.id ? null : p.comment.id))}
              style={{ left: p.x, top: p.y }}
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
        const sel = pins.find((p) => p.comment.id === selected && p.visible);
        if (!sel) return null;
        return (
          <div
            className="pointer-events-auto absolute flex items-center gap-1.5"
            style={{ left: sel.x + 18, top: sel.y - 12 }}
          >
            <button
              type="button"
              aria-label={`Copy link to comment ${sel.comment.number}`}
              title={`Copy link to comment ${sel.comment.number}`}
              onClick={async (e) => {
                e.stopPropagation();
                const ok = await copyLink(buildCommentLink(sel.comment));
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
