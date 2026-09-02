"use client";

// ONE COMMENT IN THE DRAWER — R8 lifecycle, R13 context display.
//
// ═══ EVERY PIN ACTION IS REACHABLE HERE, WITHOUT A POINTER ═══
//
// This row is the keyboard equivalent of a pin (SC 2.1.1), so it carries the
// full lifecycle: edit, resolve/unresolve, delete. All as real buttons, in one
// tab sequence, with no hover-to-reveal — a control that only appears on hover
// is a control a keyboard reviewer does not have.
//
// ═══ CONTEXT IS COMPACT, THEN COMPLETE (R13) ═══
//
// The row shows route + relative time, because that is what someone scanning a
// list needs. Expanding reveals role, scenario, load state, viewport width and
// the absolute timestamp — the things you need when a comment says "this looked
// wrong" and you have to reproduce the state it was written in.
//
// DISPLAY ONLY. R14's "the state you are in does not match the state this was
// written in" affordance is deliberately NOT built here.
//
// ═══ THE WHOLE ROW IS A LINK TO THE COMMENT ═══
//
// Clicking anywhere that is not a control takes you to the page and harness state
// the comment was written in. It is a REAL `<a href>` — an overlay covering the
// row, which is the pattern `ui/data-view.tsx` already uses for a navigable row —
// so middle-click, cmd-click and "copy link address" all behave the way a link is
// supposed to, and the destination is visible in the status bar before you commit
// to it. A div with an onClick would have none of that.
//
// The overlay sits ABOVE the text and BELOW the controls: `z-[1]` on the link,
// `z-[2]` on anything interactive. So the body text is part of the link's target
// and the action buttons are not, without either needing to know about the other.
//
// The body is therefore no longer a button. It was one, and what it did — toggle
// the drawer's selection — was both invisible and redundant: the chevron beside
// it already discloses the full text, and selection now happens by arriving at
// the comment. One fewer control that did not say what it was for.

import { useState } from "react";
import { Check, ChevronDown, Link2, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { BODY_MAX, resolveDisplayName, type Comment, type Reviewer } from "@/lib/anno/types";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** Relative, for the row. Absolute lives in the expansion — a reviewer scanning
 *  wants "2h ago", a reviewer reproducing wants the timestamp. */
function ago(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export type RowAction =
  | { kind: "edit"; body: string }
  | { kind: "resolve" }
  | { kind: "unresolve" }
  | { kind: "delete" }
  | { kind: "restore" };

export function CommentRow({
  comment,
  reviewers,
  now,
  selected,
  /** True while this row's soft delete is inside its undo window. */
  pendingDelete,
  /** True when the store says it is gone but this tab still had it on screen. */
  removedElsewhere,
  busy,
  error,
  href,
  onNavigate,
  onAction,
  onCopyLink,
  copied,
}: {
  comment: Comment;
  reviewers: readonly Reviewer[];
  now: number;
  selected: boolean;
  pendingDelete?: boolean;
  removedElsewhere?: boolean;
  busy?: boolean;
  error?: string | null;
  /** Where this comment lives, as a deeplink. `null` suppresses navigation —
   *  used for a comment on a route that no longer exists, and for one inside its
   *  delete-undo window, where leaving the page would strand the undo. */
  href: string | null;
  /** Given the chance to handle the click in-page. Calls `preventDefault()` when
   *  it does; otherwise the link is followed normally. */
  onNavigate: (e: React.MouseEvent) => void;
  /** ═══ RETURNS WHETHER IT COMMITTED ═══
   *
   *  Not `void`. The anno-05 verification caught what fire-and-forget costs: the
   *  row closed its editor the instant Save was pressed, so when the store
   *  rejected the write the error rendered against a row that had already thrown
   *  the reviewer's text away. Measured — `draftPreserved: false`.
   *
   *  With a resolved boolean the row can keep the editor open, keep the draft in
   *  the field, and show the error next to the text it failed to save. */
  onAction: (a: RowAction) => Promise<boolean>;
  onCopyLink?: () => void;
  /** `"ok"` after a successful copy, `"fail"` when the clipboard refused. */
  copied?: "ok" | "fail" | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  const resolved = comment.status === "resolved";
  /** R8's "edited-by-author". The timestamps are the only record of it — there is
   *  no edit log in Appendix A — so a second-granularity difference is the test.
   *  A save that changes nothing does not move `updatedAt` by a whole second. */
  const edited =
    Math.floor(new Date(comment.updatedAt).getTime() / 1000) >
    Math.floor(new Date(comment.createdAt).getTime() / 1000);
  const author = resolveDisplayName(comment.authorClientId, reviewers);

  /* ═══ DELETED BY SOMEONE ELSE ═══
     Not an error and not a crash — the other reviewer was allowed to do that.
     The row stays, says what happened, and drops its actions, because acting on
     a comment that no longer exists is the one thing that WOULD error. */
  if (removedElsewhere) {
    return (
      <li
        data-anno-row={comment.number}
        data-anno-row-state="removed-elsewhere"
        className="border-b border-[color:var(--border-subtle)] px-3 py-2.5"
      >
        <p className="text-[12px] leading-[16px] text-[var(--text-muted)]">
          <span className="font-semibold">Comment {comment.number}</span> was deleted
          by another reviewer.
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-[16px] text-[var(--text-muted)] line-through">
          {comment.body}
        </p>
      </li>
    );
  }

  return (
    <li
      data-anno-row={comment.number}
      data-anno-row-id={comment.id}
      data-anno-row-state={
        pendingDelete ? "pending-delete" : resolved ? "resolved" : "open"
      }
      className={cn(
        "relative border-b border-[color:var(--border-subtle)] px-3 py-2.5",
        selected && "bg-[var(--surface-s1)]",
        pendingDelete && "opacity-60",
        href && !editing && "hover:bg-[var(--tint-hover)]"
      )}
    >
      {/* ═══ THE ROW LINK ═══
          Suppressed while editing: navigating away mid-edit would discard the
          reviewer's text, and this repo has already paid for that once (see the
          note on `onAction` returning a boolean). */}
      {href && !editing && (
        <a
          href={href}
          onClick={onNavigate}
          data-anno-row-link
          aria-label={`Go to comment ${comment.number} on ${comment.context.route}`}
          className={cn("absolute inset-0 z-[1] rounded-sm", RING)}
        />
      )}
      <div className="relative flex items-start gap-2">
        {/* ═══ THE NUMBER, AND THE RESOLVED MARK ON THE SAME CHIP ═══
            Fill vs outline plus a check — the same shape language as the pin, so
            the drawer and the layer cannot disagree, and both survive greyscale
            (SC 1.4.1). */}
        <span
          aria-hidden
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: resolved ? "transparent" : "#7b5bd6",
            border: resolved ? "2px solid #7b5bd6" : "2px solid #ffffff",
            boxShadow: "0 0 0 1px #6e6b67",
            color: resolved ? "#7b5bd6" : "#ffffff",
            font: "700 10px/1 ui-sans-serif, system-ui, sans-serif",
            opacity: resolved ? 0.7 : 1,
          }}
        >
          {resolved ? <Check className="size-3" strokeWidth={3} /> : comment.number}
        </span>

        <div className="min-w-0 flex-1">
          {editing ? (
            <>
              <label className="relative z-[2] block">
                <span className="sr-only">Edit comment {comment.number}</span>
                <textarea
                  autoFocus
                  rows={3}
                  value={draft}
                  maxLength={BODY_MAX}
                  onChange={(e) => setDraft(e.target.value)}
                  className={cn(
                    "w-full resize-none rounded-[var(--radius-inset)] border border-[color:var(--border-subtle)] bg-[var(--surface-s1)] px-2 py-1.5",
                    "text-[var(--text-primary)]",
                    RING
                  )}
                  style={{ font: "var(--type-body)" }}
                />
              </label>
              <div className="relative z-[2] mt-1.5 flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(false);
                  }}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--tint-hover)]",
                    RING
                  )}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || draft.trim().length === 0}
                  onClick={() => {
                    /* CLOSE ONLY ON SUCCESS. On failure the editor stays, the
                       draft stays in the field, and the error appears beneath
                       it — the reviewer's words are never the thing that is
                       lost when the network is. */
                    void onAction({ kind: "edit", body: draft.trim() }).then((ok) => {
                      if (ok) setEditing(false);
                    });
                  }}
                  className={cn(
                    "rounded-full bg-[var(--text-primary)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--text-inverse)] disabled:opacity-50",
                    RING
                  )}
                >
                  {/* The action name, again — see the composer. */}
                  {busy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </>
          ) : (
            <div
              className={cn(
                /* `py-1` FOR SC 2.5.8, not for looks. Measured at 299×20 — the
                   line-height alone — which fails the 24×24 minimum. Padding
                   rather than `touchTarget()` because this box's height varies
                   with the clamp (20px for one line, ~80px for four), and the
                   helper's pseudo-element insets are keyed to fixed heights. */
                /* `py-1` was here FOR SC 2.5.8 when this was a button measuring
                   299×20. It is no longer a target, so the padding is now purely
                   the row's internal rhythm — kept because removing it would
                   reflow every row for no reason. */
                "block w-full py-1 text-left text-[var(--text-primary)]",
                /* ═══ CLAMPED UNTIL EXPANDED ═══
                   A body may be 1000 characters. Unclamped, one of them measured
                   554px — 81% of the drawer's scroller — so a single comment hid
                   every other comment in the review. Four lines is enough to
                   recognise a note you wrote and to read a short one whole; the
                   expansion that already reveals the captured context now
                   reveals the rest of the body with it, so there is one
                   disclosure control rather than two. */
                !expanded && "line-clamp-4",
                resolved && "opacity-70"
              )}
              style={{ font: "var(--type-body)" }}
            >
              {comment.body}
            </div>
          )}

          {/* ── COMPACT CONTEXT ────────────────────────────────────────── */}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-[15px] text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-secondary)]">{author}</span>
            <span aria-hidden>·</span>
            <span>{ago(comment.createdAt, now)}</span>
            {edited && (
              <>
                <span aria-hidden>·</span>
                {/* NAMED AS THE AUTHOR'S OWN EDIT. Anyone can edit any comment in
                    this prototype, so "edited" without a subject would be a
                    claim nobody can check. */}
                <span>edited by {author}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span className="truncate font-mono">{comment.context.route}</span>
          </p>

          {expanded && (
            <dl
              data-anno-context
              className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] leading-[15px]"
            >
              {[
                ["Route", comment.context.route],
                ["Role", comment.context.role],
                ["Scenario", comment.context.scenario || "—"],
                ["Load state", comment.context.loadState],
                ["Viewport", `${comment.context.viewportWidth}px`],
                ["Written", new Date(comment.createdAt).toLocaleString()],
                ...(edited
                  ? ([["Edited", new Date(comment.updatedAt).toLocaleString()]] as const)
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="col-span-2 grid grid-cols-subgrid">
                  <dt className="text-[var(--text-muted)]">{k}</dt>
                  <dd className="truncate font-mono text-[var(--text-secondary)]">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {error && (
            <p className="mt-1 text-[11px] leading-[15px] text-[var(--state-error)]">
              {error}
            </p>
          )}

          {/* ── ACTIONS. Always present, never hover-revealed. ───────────
              `z-[2]` puts every control above the row link, so a press on Resolve
              resolves rather than navigating. `w-fit` so the cluster claims only
              its own width and the empty space beside it still belongs to the
              link. */}
          <div className="relative z-[2] mt-1.5 flex w-fit items-center gap-0.5">
            {onCopyLink && (
              <RowButton
                label={`Copy link to comment ${comment.number}`}
                onClick={onCopyLink}
                icon={<Link2 className="size-3.5" />}
              />
            )}
            {/* THE CONFIRMATION STATES WHAT HAPPENED, and only ever after it
                actually happened — `copied` is set from the clipboard's own
                result, not from the click. */}
            {copied === "ok" && (
              <span className="text-[11px] leading-[15px] text-[var(--text-secondary)]">
                Link copied
              </span>
            )}
            {copied === "fail" && (
              <span className="text-[11px] leading-[15px] text-[var(--state-error)]">
                Couldn&apos;t copy — select the link and copy it manually
              </span>
            )}
            <RowButton
              label={expanded ? "Hide details" : "Show full comment and details"}
              onClick={() => setExpanded((v) => !v)}
              icon={
                <ChevronDown
                  className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
                />
              }
            />
            {pendingDelete ? (
              <RowButton
                label="Undo delete"
                onClick={() => onAction({ kind: "restore" })}
                icon={<Undo2 className="size-3.5" />}
                disabled={busy}
              />
            ) : (
              <>
                <RowButton
                  label={`Edit comment ${comment.number}`}
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                  icon={<Pencil className="size-3.5" />}
                  disabled={busy || editing}
                />
                <RowButton
                  label={
                    resolved
                      ? `Reopen comment ${comment.number}`
                      : `Resolve comment ${comment.number}`
                  }
                  onClick={() => onAction({ kind: resolved ? "unresolve" : "resolve" })}
                  icon={
                    resolved ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />
                  }
                  disabled={busy}
                />
                <RowButton
                  label={`Delete comment ${comment.number}`}
                  onClick={() => onAction({ kind: "delete" })}
                  icon={<Trash2 className="size-3.5" />}
                  disabled={busy}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/** Icon-only, but NAMED — `aria-label` and `title` from one string so a pointer
 *  reader and a screen reader cannot be told different things. 28px visual, which
 *  `touchTarget` extends to 44. */
function RowButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-7 items-center justify-center rounded-full text-[var(--text-secondary)] transition-colors",
        "hover:bg-[var(--tint-hover)] hover:text-[var(--text-primary)] disabled:opacity-40 disabled:hover:bg-transparent",
        RING
      )}
    >
      {icon}
    </button>
  );
}
