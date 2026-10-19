"use client";

// ═══════════════════════════════════════════════════════════════════════════
// A SUPPORT THREAD, INSIDE THE PANEL (SUP-4)
//
// Opening a row replaces the list with the thread in the same 420px panel.
//
// ═══ THE HEADER ═══ Back (to the list, which keeps its scroll and its open
// sections), the contact's 32px avatar with presence, name 16/24, role 12/16
// tertiary, an overflow button, and the panel's close. Back is required: a
// two-level panel with no way up is a modal trap (Nielsen H3). CLOSE STAYS
// although the pack's header list omits it: standing rule 5 names "an
// explicit close button in the panel header" as a dismissal, and the thread
// header is the panel header now (flagged).
//
// ═══ THE MESSAGES ═══ 16 padding, 16 between. Outgoing periwinkle
// (`--bubble-outgoing`), radius 16/16/4/16; incoming `surface-sunken`, radius
// 16/16/16/4. 14px at 1.4, at most 370 wide. The time sits under a run's last
// bubble in `text-tertiary` (the Figma's #909090 is 3.5:1 and fails, Appendix
// A). The list is `role="log"`, polite, so what arrives is announced.
//
// ═══ UNHAPPY PATHS ═══ A send shows at once as "Sending…"; a failure stays
// in the thread as the bubble with "Not sent" and Retry, never a toast. A
// long message is clamped with Show more / Show less. Offline, the composer is
// disabled and says why.

import { useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Camera,
  Lightbulb,
  Mic,
  MoreHorizontal,
  Plus,
  Smile,
  Sticker,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RecordAvatar } from "@/components/record/record-avatar";
import { OfflineBanner } from "@/components/support/support-list";
import { setSupportOpen } from "@/lib/support/panel";
import {
  getDraft,
  retrySupportMessage,
  sendSupportMessage,
  setDraft,
  type SendStatus,
} from "@/lib/support/outbox";
import { isLongMessage, runBreaks, type SupportThreadData } from "@/lib/support/threads";
import { supportMessageTime, supportStampAbsolute } from "@/lib/support/relative-time";
import { cn } from "@/lib/utils";

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";
/** The panel header's icon button, as in the list state. */
const ICON_BTN =
  "flex size-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-subtle)]";
/** A composer toolbar glyph: a 40×40 target, no border. */
const TOOL_BTN = "flex size-10 shrink-0 items-center justify-center rounded-full";

/** Standing rule 3: what is not built is disabled, named, and says so. */
const inert = {
  "aria-disabled": true,
  tabIndex: -1,
  title: "Coming soon.",
  onClick: (e: React.MouseEvent) => e.preventDefault(),
} as const;

export interface ThreadMessage {
  id: string;
  at: number;
  mine: boolean;
  text: string;
  author?: string;
  /** Present on what this session sent. */
  status?: SendStatus;
}

function Tool({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button type="button" {...inert} aria-label={`${label} (coming soon)`} className={cn(TOOL_BTN, "cursor-default")}>
      <Icon aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
    </button>
  );
}

export function SupportThread({
  data,
  messages,
  now,
  online,
  onBack,
}: {
  data: SupportThreadData;
  messages: ThreadMessage[];
  now: number;
  online: boolean;
  onBack: () => void;
}) {
  const { row } = data;
  /* A PERSON BY FIRST NAME, A GROUP BY ITS WHOLE NAME (SUP-6). Measured:
     "Message Fall" — the first word of "Fall 2026 cohort". Only a person has
     presence, so presence is what says this is a person. */
  const first = row.shortName ?? (row.presence ? row.name.split(" ")[0] : row.name);
  const logRef = useRef<HTMLOListElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [text, setText] = useState(() => getDraft(row.id));
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  /* ═══ FOCUS AND SCROLL ON ARRIVAL ═══ Focus to the thread's name (a
     landmark, not a tab stop), and the log to its newest message. DOM work,
     in a layout effect so the first paint is already at the bottom. */
  useLayoutEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [row.id]);
  const count = messages.length;
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, row.id]);

  const breaks = runBreaks(messages);
  const canSend = online && text.trim().length > 0;
  const send = () => {
    if (!canSend) return;
    sendSupportMessage(row.id, text.trim());
    setText("");
    if (inputRef.current) inputRef.current.style.height = "";
  };

  return (
    <div data-support-thread={row.id} className="flex min-h-0 flex-1 flex-col">
      {/* ── HEADER, THREAD STATE ─────────────────────────────────────────── */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] pr-3 pl-3">
        <button
          type="button"
          data-support-back
          onClick={onBack}
          /* TODO-COPY */
          aria-label="Back to Support"
          className={cn(ICON_BTN, "transition-colors hover:bg-[var(--tint-hover)]", RING)}
        >
          <ArrowLeft aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
        </button>
        <span className="relative ml-1 shrink-0">
          <RecordAvatar name={row.name} size={32} />
          {row.presence === "online" && (
            <span
              aria-hidden
              data-presence-dot
              className="absolute -right-px -bottom-px size-[9px] rounded-full bg-[var(--status-online)] shadow-[0_0_0_1px_var(--surface-canvas)]"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            ref={titleRef}
            tabIndex={-1}
            id="support-thread-title"
            /* Composed: a hidden suffix inside the heading was read with a
               stray space before its comma (SUP-6). TODO-COPY. */
            aria-label={`${row.name}${row.presence === "online" ? ", online" : ""}`}
            /* `font-sans`: every h2 takes the display face globally, and the
               name is Body/Large-Regular, as on the row it was opened from. */
            className="truncate rounded-sm font-sans text-[16px] leading-[24px] text-[var(--text-primary)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]"
          >
            {row.name}
            {/* TODO-COPY */}
            {row.presence === "online" && <span className="sr-only">, online</span>}
          </h2>
          <p data-support-role className="truncate text-[12px] leading-[16px] text-[var(--text-tertiary)]">
            {data.role}
          </p>
        </div>
        <button type="button" {...inert} aria-label="More options (coming soon)" className={cn(ICON_BTN, "cursor-default")}>
          <MoreHorizontal aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          data-support-close
          aria-label="Close support"
          onClick={() => setSupportOpen(false)}
          className={cn(ICON_BTN, "transition-colors hover:bg-[var(--tint-hover)]", RING)}
        >
          <X aria-hidden className="size-5 text-[var(--icon-secondary)]" strokeWidth={1.75} />
        </button>
      </header>

      {!online && <OfflineBanner />}

      {/* ── MESSAGES ─────────────────────────────────────────────────────── */}
      {messages.length === 0 ? (
        <div data-support-thread-empty className="flex min-h-0 flex-1 items-center justify-center px-6">
          <p className="text-center text-[14px] leading-[20px] text-[var(--text-secondary)]">
            {/* TODO-COPY */}
            No messages yet. Say hello to {first}.
          </p>
        </div>
      ) : (
        <ol
          ref={logRef}
          role="log"
          aria-live="polite"
          /* TODO-COPY */
          aria-label={`Messages with ${row.name}`}
          data-support-log
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {messages.map((m, i) => {
            const { first: runFirst, last: runLast } = breaks[i];
            const long = isLongMessage(m.text);
            const open = expanded.has(m.id);
            const bodyId = `support-msg-${m.id}`;
            return (
              <li
                key={m.id}
                data-support-message={m.mine ? "out" : "in"}
                data-status={m.status}
                className={cn("flex flex-col gap-1", m.mine ? "items-end" : "items-start")}
              >
                {runFirst && m.author && !m.mine && (
                  <span className="px-1 text-[12px] leading-[16px] text-[var(--text-secondary)]">{m.author}</span>
                )}
                <div
                  data-support-bubble
                  className={cn(
                    "max-w-[370px] px-3 py-2 text-[14px] leading-[1.4] break-words whitespace-pre-wrap",
                    m.mine
                      ? "rounded-[16px_16px_4px_16px] bg-[var(--bubble-outgoing)] text-[var(--bubble-outgoing-fg)]"
                      : "rounded-[16px_16px_16px_4px] bg-[var(--surface-sunken)] text-[var(--text-primary)]"
                  )}
                >
                  {/* TODO-COPY: who said it, for the announced log — unless the
                      visible author label over this bubble already says. */}
                  {!(runFirst && m.author && !m.mine) && (
                    <span className="sr-only">{m.mine ? "You: " : m.author ? `${m.author}: ` : `${first}: `}</span>
                  )}
                  <span id={bodyId} data-support-body-text className={cn("block", long && !open && "line-clamp-6")}>
                    {m.text}
                  </span>
                </div>
                {long && (
                  <button
                    type="button"
                    data-support-more
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() =>
                      setExpanded((s) => {
                        const n = new Set(s);
                        if (n.has(m.id)) n.delete(m.id);
                        else n.add(m.id);
                        return n;
                      })
                    }
                    className={cn(
                      "min-h-6 rounded-sm px-1 text-[12px] leading-[16px] text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--text-primary)]",
                      RING
                    )}
                  >
                    {/* TODO-COPY */}
                    {open ? "Show less" : "Show more"}
                  </button>
                )}
                {m.status === "pending" ? (
                  <span data-support-sending className="px-1 text-[12px] leading-[16px] text-[var(--text-tertiary)]">
                    {/* TODO-COPY */}
                    Sending…
                  </span>
                ) : m.status === "failed" ? (
                  <span data-support-failed className="flex items-center gap-1 px-1 text-[12px] leading-[16px] text-[var(--state-error)]">
                    <AlertCircle aria-hidden className="size-3.5" strokeWidth={2} />
                    {/* TODO-COPY */}
                    Not sent.
                    <button
                      type="button"
                      data-support-retry-send
                      onClick={() => retrySupportMessage(m.id)}
                      className={cn("min-h-6 rounded-sm px-1 font-semibold underline underline-offset-2", RING)}
                    >
                      Retry
                    </button>
                  </span>
                ) : (
                  runLast && (
                    <time
                      dateTime={new Date(m.at).toISOString()}
                      title={supportStampAbsolute(m.at)}
                      data-support-time
                      className="px-1 text-[12px] leading-[16px] tabular-nums text-[var(--text-tertiary)]"
                    >
                      {supportMessageTime(m.at, now)}
                    </time>
                  )
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* ── COMPOSER ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-2">
        <div
          data-support-composer
          /* ═══ THE RING IS ON THE CARD (SUP-6) ═══ The textarea is borderless
             inside it, so it had no focus indicator at all — measured
             `outline: none`. The card takes the ring while its field has focus;
             the toolbar's buttons keep their own. */
          className="flex flex-col gap-4 rounded-[20px] border border-[color:var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-[var(--shadow-composer)] has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-[color:var(--focus-ring)]"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            disabled={!online}
            aria-describedby={!online ? "support-composer-offline" : undefined}
            /* TODO-COPY */
            aria-label={`Message ${row.name}`}
            placeholder={`Message ${first}`}
            onChange={(e) => {
              setText(e.target.value);
              setDraft(row.id, e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line, as chat's composer.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-[120px] min-h-6 w-full resize-none bg-transparent text-[14px] leading-[20px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)] disabled:cursor-not-allowed"
          />
          {!online && (
            <p id="support-composer-offline" data-support-composer-offline className="-mt-2 text-[12px] leading-[16px] text-[var(--text-secondary)]">
              {/* TODO-COPY */}
              Sending is off while you&apos;re offline.
            </p>
          )}
          <div className="-m-2 flex items-center">
            <Tool icon={Mic} label="Record a voice note" />
            <Tool icon={Camera} label="Add a photo" />
            <Tool icon={Smile} label="Add an emoji" />
            <Tool icon={Sticker} label="Add a GIF" />
            <Tool icon={Lightbulb} label="Suggest a reply" />
            <Tool icon={Plus} label="More attachments" />
            <button
              type="button"
              data-support-send
              onClick={send}
              disabled={!canSend}
              /* TODO-COPY */
              aria-label="Send"
              className={cn(
                TOOL_BTN,
                "ml-auto transition-colors",
                canSend
                  ? "bg-[var(--bubble-outgoing)] text-[var(--bubble-outgoing-fg)]"
                  : "bg-[var(--surface-sunken-strong)] text-[var(--text-tertiary)]",
                RING
              )}
            >
              <ArrowUp aria-hidden className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
