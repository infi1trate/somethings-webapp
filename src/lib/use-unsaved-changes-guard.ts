"use client";

// ═══════════════════════════════════════════════════════════════════════════
// UNSAVED-CHANGES GUARD — every way out of a dirty form, not just the one.
//
// ═══ WHAT WAS THERE, AND WHAT IT COVERED ═══
//
// `/app/profile` had a guard on the Account tab (`page.tsx`): `requestTab`
// intercepted a TAB CHANGE when `accountDirty` and prompted with the app's own
// dialog. That part works and is preserved. It was the only path it covered.
//
// THREE OTHERS DROPPED EDITS SILENTLY, verified by inspection and by grep —
// `beforeunload` and `popstate` appear NOWHERE in `src`:
//
//   1. BROWSER BACK AND SWIPE-BACK. Tab changes use `router.replace`, so they do
//      not push history — which means Back from a dirty Account tab does not
//      return to the previous tab, it LEAVES THE PAGE. The single most likely
//      gesture on a phone was also the least guarded one.
//   2. ANY NAV LINK. The Phase 2 bottom tab bar, the rail, the More sheet — all
//      plain `<Link>`s. Tapping "Home" from a dirty Account tab discarded the
//      edits with no prompt.
//   3. RELOAD, TAB CLOSE, EXTERNAL NAVIGATION. Nothing at all.
//
// ═══ WHY A HOOK AND NOT `onNavigate` ON THE LINKS ═══
//
// Next 16's `<Link>` does take `onNavigate` with a cancellable event, and for a
// single known link that is the neatest tool. It is the wrong one here: the links
// that leave this page live in `AppShell`, `settings/sidebar.tsx` and
// `app-shell/bottom-nav.tsx`, all shared by every route. Threading a guard
// through them would make the app shell know about one page's form state, and
// every future page with a dirty form would widen that prop.
//
// So the interception is a CAPTURE-PHASE listener that exists only while the form
// is dirty. Nothing is installed when there is nothing to lose, and the app shell
// stays ignorant.
//
// ═══ WHY THE BROWSER'S OWN DIALOG FOR ONE PATH ONLY ═══
//
// `beforeunload` cannot be styled and cannot be replaced — the browser owns that
// moment. It is used ONLY for reload/close/external, where there is no
// alternative. Every in-app path (a Link, Back) gets the product's own dialog,
// which is what the existing guard already established.
//
// design-system-gaps row 271.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useRef } from "react";

/** A sentinel pushed onto history so Back has something to land on that is still
 *  this page. Read back off `history.state` to tell our own entry apart from a
 *  genuine one. */
const SENTINEL = "__unsavedGuard";

export function useUnsavedChangesGuard({
  when,
  onBlocked,
}: {
  /** True while there are unsaved changes. Nothing is installed when false. */
  when: boolean;
  /** Called with the intended destination when a navigation was cancelled.
   *  `null` means Back — there is no URL to resume, so the caller decides.
   *  The caller shows its own dialog and, on confirm, performs the navigation. */
  onBlocked: (href: string | null) => void;
}) {
  // The callback is read at event time rather than captured, so a re-render with
  // a new closure does not require tearing the listeners down and rebuilding
  // them — and an in-flight gesture cannot call a stale one.
  //
  // THE ASSIGNMENT IS IN AN EFFECT, not in render. `react-hooks/refs` rejects
  // writing a ref during render, and rightly: render must be pure, and a ref
  // written there is a mutation React cannot see. Same family of rule as the
  // `purity` one that rejects `Date.now()` in render scope.
  const onBlockedRef = useRef(onBlocked);
  useEffect(() => {
    onBlockedRef.current = onBlocked;
  }, [onBlocked]);

  useEffect(() => {
    if (!when) return;

    // ── 3. RELOAD / CLOSE / EXTERNAL ─────────────────────────────────────
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // `preventDefault` is the modern spelling; `returnValue` is what older
      // engines actually honour. Both, because the cost of the redundant line is
      // nothing and the cost of being wrong is a lost form.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    // ── 2. IN-APP LINKS ──────────────────────────────────────────────────
    //
    // CAPTURE PHASE, so this runs before React's own delegated handler and
    // before Next's Link intercepts the click.
    const onClickCapture = (e: MouseEvent) => {
      // Let modified clicks through untouched: cmd/ctrl/shift-click and
      // middle-click open a NEW context, so the dirty form is not going
      // anywhere and blocking them would be wrong.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      if (e.button !== 0) return;

      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      // A new tab does not leave this one.
      if (anchor.target && anchor.target !== "_self") return;

      const url = new URL(anchor.href, window.location.href);
      // External origins are the browser's business — `beforeunload` above
      // already covers them, and a same-page hash is not a navigation.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      e.preventDefault();
      e.stopPropagation();
      onBlockedRef.current(url.pathname + url.search);
    };
    document.addEventListener("click", onClickCapture, true);

    // ── 1. BACK AND SWIPE-BACK ───────────────────────────────────────────
    //
    // There is no cancellable "before back" event in any browser. The standard
    // shape is therefore: while dirty, occupy one extra history entry, so the
    // first Back consumes the SENTINEL instead of leaving. Re-push it and hand
    // the decision to the caller.
    //
    // The tradeoff, stated: this costs one history entry while the form is
    // dirty, so a reader who confirms "leave" then presses Back may need a
    // second press. That is the accepted price of the pattern — the alternative
    // is a gesture that discards work with no prompt at all.
    history.pushState({ ...history.state, [SENTINEL]: true }, "");
    const onPopState = () => {
      // Put the sentinel back so a second Back is also caught while dirty.
      history.pushState({ ...history.state, [SENTINEL]: true }, "");
      onBlockedRef.current(null);
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      // Give the sentinel entry back when the form goes clean, so history is not
      // left with a dead step the reader has to press through.
      if (history.state?.[SENTINEL]) history.back();
    };
  }, [when]);
}
