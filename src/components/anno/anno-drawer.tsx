"use client";

// THE DRAWER — R6. The keyboard-accessible equivalent of the pin layer.
//
// ═══ WHY THIS IS P0 AND NOT A CONVENIENCE ═══
//
// Every action available on a pin must be reachable without a pointer (SC 2.1.1).
// A pin is a 24px target positioned over arbitrary content; it is not a viable
// keyboard surface. So the drawer is not "the list view" — it is the accessible
// half of the feature, and anything that can only be done by clicking a pin is a
// defect.
//
// ═══ OVERLAY, NOT A SPLIT — LOCKED DECISION ═══
//
// It sits over the right edge and never reflows the prototype. That is the whole
// point: a drawer that pushes the layout changes the thing being reviewed, so
// every comment written with it open would describe a layout nobody else sees.
//
// ═══ GROUPED BY PAGE, NEWEST FIRST WITHIN A GROUP ═══
//
// A review is per-page work. Newest-first inside a group because the recent
// comment is the one still being discussed; oldest-first would bury it.
//
// Comments whose route is no longer served get their own group. They are still
// readable and still deletable — a comment about a page that has since been
// deleted is often the most important one in the list, and hiding it would be
// the wrong kind of tidy.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { annotationStore } from "@/lib/anno";
import { isAnnoError } from "@/lib/anno/errors";
import type { Comment, Reviewer } from "@/lib/anno/types";
import { getClientId } from "@/lib/anno/identity";
import { setDrawerOpen } from "@/lib/anno/mode";
import { arrival, buildCommentLink, copyLink } from "@/lib/anno/deeplink";
import { useFocusTrap } from "@/lib/anno/use-focus-trap";
import { CommentRow, type RowAction } from "@/components/anno/comment-row";
import { IdentityPopover } from "@/components/anno/identity-popover";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** One step above the layer so the drawer is never under a pin. */
const DRAWER_Z = 61;

/** The undo window. 10s per the brief — long enough to notice a mistake, short
 *  enough that the row is not stuck in limbo while a reviewer reads on. */
const UNDO_MS = 10_000;

export type DrawerFilter = "unresolved" | "all" | "mine";

const FILTER_LABEL: Record<DrawerFilter, string> = {
  unresolved: "Unresolved",
  all: "All",
  mine: "Mine",
};

/** ═══ WHY "known routes" IS A PROP AND NOT A LOOKUP ═══
 *
 *  Next has no client-side registry of served routes, so whether a path still
 *  exists cannot be asked at runtime. The honest test available is "is it a route
 *  this app renders" — matched against the same list the app's own navigation
 *  uses. Anything not matching is grouped as gone, which is right for a deleted
 *  page and would be a false positive for a route added after this list. Noted
 *  rather than silently approximated. */
const KNOWN_PREFIXES = [
  "/app",
  "/admin",
  "/onboarding",
  "/hub",
  "/invite",
  "/gate",
  "/dev",
];

function routeStillExists(route: string): boolean {
  return route === "/" || KNOWN_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`));
}

type Group = { key: string; label: string; gone: boolean; comments: Comment[] };

/** ═══ THE SORT KEY IS TOTAL, NOT JUST `createdAt` ═══
 *
 *  `createdAt` alone leaves ties, and ties are exactly what two reviewers
 *  commenting on the same element at the same moment produce. Relying on
 *  `Array.prototype.sort` being stable would make the order depend on the order
 *  the server happened to return — which is `number` ASCENDING, so a tied pair
 *  would come out oldest-first inside a newest-first list.
 *
 *  So `number` descending is the explicit tiebreak. It is monotonic and
 *  server-allocated (anno-01: atomic `INCR`), which makes it the only field that
 *  can never tie — and it means the sort is a total order: two reviewers, two
 *  browsers, any arrival order, same list. */
function byNewest(a: Comment, b: Comment): number {
  const t = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return t !== 0 ? t : b.number - a.number;
}

export function AnnoDrawer({ targetCommentId }: { targetCommentId?: string | null }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  /** ═══ A DEEPLINK OVERRIDES THE DEFAULT FILTER ═══
   *  The target must be visible "regardless of its resolved status", and the
   *  default filter hides resolved comments. Opening on `all` is the only way a
   *  link to a resolved comment lands on something. A reviewer who then changes
   *  the filter is choosing to; the link never quietly fails. */
  const [filter, setFilter] = useState<DrawerFilter>(() =>
    targetCommentId ? "all" : "unresolved"
  );
  const [selected, setSelected] = useState<string | null>(targetCommentId ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  /** Ids inside their undo window — rendered struck through rather than removed,
   *  so undo has something to point at. */
  const [pendingDelete, setPendingDelete] = useState<string[]>([]);
  /** Ids this tab had on screen that the store says are now gone. */
  const [removedElsewhere, setRemovedElsewhere] = useState<string[]>([]);
  /** Mount-fixed clock, so twenty rows agree what "2h ago" means. */
  const [now] = useState(() => Date.now());

  const panelRef = useRef<HTMLDivElement>(null);
  const store = annotationStore();
  const isLocal = store.kind === "local";
  const me = getClientId();

  const close = useCallback(() => setDrawerOpen(false), []);
  /** The toggle is looked up at teardown rather than captured, because the dev
      bar re-renders while the drawer is open and a held reference could be to a
      node that is no longer in the document. */
  const toggle = useCallback(
    () => document.querySelector<HTMLElement>("[data-anno-drawer-toggle]"),
    []
  );
  useFocusTrap(panelRef, true, close, toggle);

  const load = useCallback(() => {
    const s = annotationStore();
    return Promise.all([s.list(), s.reviewers().catch(() => [] as Reviewer[])])
      .then(([cs, rs]) => {
        /* ═══ DELETED-BY-SOMEONE-ELSE IS COMPUTED, NOT PUSHED ═══
           Anything this tab is currently showing that comes back deleted, and is
           not in our own undo window, was removed by another reviewer. Detected
           by diffing rather than by a message, because there is no channel — and
           the requirement is only that this tab must not crash or blank. */
        setComments((prev) => {
          if (prev) {
            const goneNow = prev
              .filter((p) => !p.deletedAt)
              .filter((p) => cs.find((c) => c.id === p.id)?.deletedAt)
              .map((p) => p.id);
            const mine = new Set(pendingDelete);
            const theirs = goneNow.filter((id) => !mine.has(id));
            if (theirs.length) setRemovedElsewhere((r) => [...new Set([...r, ...theirs])]);
          }
          return cs;
        });
        setReviewers(rs);
        setStoreError(null);
      })
      .catch((e) => {
        setStoreError(
          isAnnoError(e)
            ? e.userMessage
            : "Couldn't load comments. Check the store and reopen this panel."
        );
      });
  }, [pendingDelete]);

  useEffect(() => {
    let alive = true;
    const s = annotationStore();
    void load();
    const unsub = s.subscribe(() => {
      if (alive) setComments(s.snapshot());
    });
    return () => {
      alive = false;
      unsub();
    };
    // `load` changes with `pendingDelete`; re-subscribing on that is harmless and
    // keeps the diff above working against the current undo set.
  }, [load]);

  /** Bring the deeplinked row into view. Runs when the list arrives rather than
   *  on mount — on mount there is no row yet. `block: "center"` because the row
   *  is the reason the reviewer is here. */
  const scrolledTo = useRef(false);
  useEffect(() => {
    if (!targetCommentId || scrolledTo.current || !comments) return;
    const el = panelRef.current?.querySelector<HTMLElement>(
      `[data-anno-row-id="${targetCommentId}"]`
    );
    if (!el) return;
    scrolledTo.current = true;
    el.scrollIntoView({ block: "center", behavior: "auto" });
  }, [targetCommentId, comments]);

  const onCopy = async (c: Comment) => {
    const ok = await copyLink(buildCommentLink(c));
    /* STATES WHAT HAPPENED. A failure says so rather than showing the success
       confirmation — the clipboard is unavailable on insecure origins and in
       some webviews, and a false "Link copied" is worse than none. */
    setCopied(ok ? c.id : `fail:${c.id}`);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const act = async (c: Comment, a: RowAction): Promise<boolean> => {
    setBusyId(c.id);
    setRowError(null);
    try {
      const s = annotationStore();
      if (a.kind === "edit") await s.update(c.id, { body: a.body });
      else if (a.kind === "resolve") await s.update(c.id, { status: "resolved" });
      else if (a.kind === "unresolve") await s.update(c.id, { status: "open" });
      else if (a.kind === "restore") {
        await s.restore(c.id);
        setPendingDelete((p) => p.filter((id) => id !== c.id));
      } else if (a.kind === "delete") {
        await s.softDelete(c.id);
        setPendingDelete((p) => [...p, c.id]);
        /* ═══ THE UNDO TOAST — sonner, the repo's own pattern ═══
           anno-00 found the codebase has toasts but NO undo anywhere; this
           establishes it. The action label repeats the verb the reviewer just
           used, and the toast's own lifetime IS the undo window, so the row
           stops being struck through at the same moment the offer expires. */
        toast(`Comment ${c.number} deleted`, {
          duration: UNDO_MS,
          action: {
            label: "Undo",
            onClick: () => {
              void annotationStore()
                .restore(c.id)
                .then(() => {
                  setPendingDelete((p) => p.filter((id) => id !== c.id));
                  void load();
                })
                .catch(() =>
                  toast(`Couldn't bring comment ${c.number} back — the store refused.`)
                );
            },
          },
          onAutoClose: () => setPendingDelete((p) => p.filter((id) => id !== c.id)),
          onDismiss: () => setPendingDelete((p) => p.filter((id) => id !== c.id)),
        });
      }
      await load();
      return true;
    } catch (e) {
      setRowError({
        id: c.id,
        message: isAnnoError(e) ? e.userMessage : "That didn't save. Try again.",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  /* ── FILTER, THEN GROUP ─────────────────────────────────────────────── */
  const visible = useMemo(() => {
    const cs = (comments ?? []).filter(
      (c) => !c.deletedAt || pendingDelete.includes(c.id) || removedElsewhere.includes(c.id)
    );
    if (filter === "all") return cs;
    if (filter === "mine") return cs.filter((c) => c.authorClientId === me);
    return cs.filter((c) => c.status === "open");
  }, [comments, filter, me, pendingDelete, removedElsewhere]);

  const groups = useMemo<Group[]>(() => {
    const byRoute = new Map<string, Comment[]>();
    for (const c of visible) {
      const k = c.context.route;
      byRoute.set(k, [...(byRoute.get(k) ?? []), c]);
    }
    const live: Group[] = [];
    const gone: Comment[] = [];
    for (const [route, cs] of byRoute) {
      const sorted = [...cs].sort(byNewest);
      if (routeStillExists(route)) live.push({ key: route, label: route, gone: false, comments: sorted });
      else gone.push(...sorted);
    }
    live.sort((a, b) => a.label.localeCompare(b.label));
    /* The gone group LAST — it is a footnote to the review, not its headline. */
    if (gone.length)
      live.push({
        key: "__gone__",
        label: "Page no longer exists",
        gone: true,
        comments: gone.sort(byNewest),
      });
    return live;
  }, [visible]);

  const total = (comments ?? []).filter((c) => !c.deletedAt).length;

  return (
    <div
      ref={panelRef}
      data-anno-drawer
      role="dialog"
      aria-modal="true"
      aria-label="Comments"
      className={cn(
        "pointer-events-auto fixed inset-y-0 right-0 flex w-[22rem] max-w-[92vw] flex-col",
        "border-l border-[color:var(--border-contour)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]"
      )}
      style={{ zIndex: DRAWER_Z, bottom: "var(--dev-bar-h, 0px)" }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] px-3 py-2.5">
        <h2 className="min-w-0 flex-1 text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
          Comments
        </h2>
        <button
          type="button"
          aria-label="Close comments"
          title="Close comments"
          onClick={close}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
            RING
          )}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* ═══ STORE HONESTY — PERSISTENT, NOT A TOOLTIP ═══
          R10's requirement. A local store must SAY it is local, in the body, for
          as long as it is in use — because a device-only comment looks identical
          to a shared one in a screenshot. */}
      {isLocal && (
        <p
          data-anno-local-notice
          className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--band-sand-bg)] px-3 py-2 text-[11px] leading-[15px] text-[var(--band-sand-fg)]"
        >
          <span className="font-semibold">These comments are on this device only.</span>{" "}
          No other reviewer can see them, and clearing your browser data deletes them.
        </p>
      )}

      {/* ═══ WHAT THE DEEPLINK COULD NOT DO ═══
          One place, at the top, for every arrival failure. Each says what
          happened and what still works — never "something went wrong". */}
      {arrival.isDeeplink && comments !== null && (
        <>
          {targetCommentId && !comments.some((c) => c.id === targetCommentId) && (
            <p
              data-anno-notice="comment-missing"
              className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--band-amber-bg)] px-3 py-2 text-[11px] leading-[15px] text-[var(--band-amber-fg)]"
            >
              <span className="font-semibold">That comment no longer exists.</span> It was
              deleted after the link was made. You are on the right page — everything else
              from the link was applied.
            </p>
          )}
          {targetCommentId &&
            (() => {
              const t = comments.find((c) => c.id === targetCommentId);
              if (!t || routeStillExists(t.context.route)) return null;
              return (
                <p
                  data-anno-notice="route-missing"
                  className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--band-amber-bg)] px-3 py-2 text-[11px] leading-[15px] text-[var(--band-amber-fg)]"
                >
                  <span className="font-semibold">
                    The page this comment was written on no longer exists.
                  </span>{" "}
                  It is below under <span className="font-semibold">Page no longer exists</span>,
                  where you can still read and delete it — there is nothing to pin it to.
                </p>
              );
            })()}
          {arrival.ignored.length > 0 && (
            <p
              data-anno-notice="params-ignored"
              className="shrink-0 border-b border-[color:var(--border-subtle)] bg-[var(--band-sand-bg)] px-3 py-2 text-[11px] leading-[15px] text-[var(--band-sand-fg)]"
            >
              {/* NAMES THE PARAMETER AND ITS VALUE. "Some settings were ignored"
                  would leave the reader unable to fix the link. */}
              <span className="font-semibold">
                {arrival.ignored.length === 1 ? "One link setting" : `${arrival.ignored.length} link settings`}{" "}
                {arrival.ignored.length === 1 ? "was" : "were"} ignored.
              </span>{" "}
              {arrival.ignored
                .map((i) => `${i.param}=${i.value} — ${i.reason}`)
                .join("; ")}
              . The default is in use instead.
            </p>
          )}
        </>
      )}

      {/* ── FILTERS ────────────────────────────────────────────────────── */}
      <div
        role="radiogroup"
        aria-label="Filter comments"
        className="flex shrink-0 items-center gap-1 border-b border-[color:var(--border-subtle)] px-3 py-2"
      >
        {(["unresolved", "all", "mine"] as DrawerFilter[]).map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors",
                on
                  ? "bg-[var(--text-primary)] text-[var(--text-inverse)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                RING
              )}
            >
              {FILTER_LABEL[f]}
            </button>
          );
        })}
      </div>

      {/* ── BODY: the five states ──────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {storeError ? (
          <div data-anno-drawer-state="unreachable" className="px-3 py-6">
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              Can&apos;t reach the comment store
            </p>
            {/* SAYS WHAT HAPPENED AND WHAT TO DO. Never "something went wrong". */}
            <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              {storeError}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className={cn(
                "mt-3 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--text-inverse)]",
                RING
              )}
            >
              Try again
            </button>
          </div>
        ) : comments === null ? (
          <div data-anno-drawer-state="loading" className="px-3 py-6">
            <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
              Loading comments…
            </p>
            <div aria-hidden className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-[var(--radius-inset)] bg-[var(--surface-s2)] motion-safe:animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : total === 0 ? (
          /* ═══ EMPTY IS AN INVITATION ═══ */
          <div data-anno-drawer-state="empty" className="px-3 py-6">
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              No comments yet
            </p>
            <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              Switch the layer to <span className="font-semibold">Place</span> and click
              anything in the prototype to leave the first one.
            </p>
          </div>
        ) : visible.length === 0 ? (
          /* ═══ FILTERED-EMPTY NAMES THE FILTER AND OFFERS TO CLEAR IT ═══ */
          <div data-anno-drawer-state="filtered-empty" className="px-3 py-6">
            <p className="text-[var(--text-primary)]" style={{ font: "var(--type-card-title)" }}>
              Nothing matches {FILTER_LABEL[filter]}
            </p>
            <p className="mt-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              {total === 1 ? "There is 1 comment" : `There are ${total} comments`}, but the{" "}
              <span className="font-semibold">{FILTER_LABEL[filter]}</span> filter is hiding{" "}
              {total === 1 ? "it" : "them"}.
            </p>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "mt-3 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--text-inverse)]",
                RING
              )}
            >
              Show all comments
            </button>
          </div>
        ) : (
          <div data-anno-drawer-state="populated">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <h3
                  className={cn(
                    "sticky top-0 z-[1] border-b border-[color:var(--border-subtle)] px-3 py-1.5 text-[11px] font-semibold leading-[15px]",
                    g.gone
                      ? "bg-[var(--band-amber-bg)] text-[var(--band-amber-fg)]"
                      : "bg-[var(--surface-s1)] text-[var(--text-secondary)]"
                  )}
                >
                  <span className={g.gone ? "" : "font-mono"}>{g.label}</span>
                  <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                    {g.comments.length}
                  </span>
                </h3>
                <ul>
                  {g.comments.map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      reviewers={reviewers}
                      now={now}
                      selected={selected === c.id}
                      pendingDelete={pendingDelete.includes(c.id)}
                      removedElsewhere={removedElsewhere.includes(c.id)}
                      busy={busyId === c.id}
                      error={rowError?.id === c.id ? rowError.message : null}
                      onSelect={() => setSelected((s) => (s === c.id ? null : c.id))}
                      onAction={(a) => act(c, a)}
                      onCopyLink={() => void onCopy(c)}
                      copied={copied === c.id ? "ok" : copied === `fail:${c.id}` ? "fail" : null}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ── WHO AM I ───────────────────────────────────────────────────── */}
      <IdentityPopover reviewers={reviewers} onSaved={() => void load()} />
    </div>
  );
}
