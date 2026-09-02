"use client";

// AttentionCard (elevated pass) — the record's "needs attention" alert: an icon
// in a soft-filled circle, a stylized headline + detail, and a plain text-link
// action (NOT a filled button — the record's ONE filled button is the header
// Message, and the strip never carries one, whatever the severity). Colors come
// from the tokenized alert families (--alert-*), critical being a warm coral-red
// (not plain red). Two variants: "card" (the Overview hero alert) and "band"
// (the compact cross-tab chrome mirror).

import type { CSSProperties } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, ArrowRight, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AttentionSeverity = "critical" | "warm" | "warning";

export interface AttentionAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

const FAMILY: Record<
  AttentionSeverity,
  { bg: string; border: string; fg: string; accent: string }
> = {
  critical: {
    bg: "var(--alert-critical-bg)",
    border: "var(--alert-critical-border)",
    fg: "var(--alert-critical-fg)",
    accent: "var(--alert-critical-accent)",
  },
  warm: {
    bg: "var(--alert-warm-bg)",
    border: "var(--alert-warm-border)",
    fg: "var(--alert-warm-fg)",
    accent: "var(--alert-warm-accent)",
  },
  warning: {
    bg: "var(--alert-warning-bg)",
    border: "var(--alert-warning-border)",
    fg: "var(--alert-warning-fg)",
    accent: "var(--alert-warning-accent)",
  },
};

function AttentionIcon({
  severity,
  className,
  style,
}: {
  severity: AttentionSeverity;
  className?: string;
  style?: CSSProperties;
}) {
  const props = { className, style, "aria-hidden": true } as const;
  if (severity === "warning") return <Clock3 {...props} />;
  if (severity === "critical") return <AlertTriangle {...props} />;
  return <AlertCircle {...props} />;
}

const RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus-ring)]";

/** A plain text link, never a filled button (the one-filled-button rule). The
 *  word always travels with the color (WCAG 1.4.1) — severity never carries
 *  meaning on its own; the label does. Text uses the family's `fg` ink
 *  (≥7:1 on the tint) with an underline as the affordance. */
function ActionLink({ action, fg }: { action: AttentionAction; fg: string }) {
  const cls = cn(
    "inline-flex min-h-9 shrink-0 items-center gap-1 rounded-sm text-[13px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70",
    RING
  );
  const inner = (
    <>
      {action.label}
      <ArrowRight className="size-3.5" aria-hidden />
    </>
  );
  return action.href ? (
    <Link href={action.href} className={cls} style={{ color: fg }}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={action.onClick} className={cls} style={{ color: fg }}>
      {inner}
    </button>
  );
}

export function AttentionCard({
  severity,
  line,
  moreCount = 0,
  action,
  variant = "card",
  className,
}: {
  severity: AttentionSeverity;
  line: string;
  moreCount?: number;
  action?: AttentionAction | null;
  variant?: "card" | "band";
  className?: string;
}) {
  const fam = FAMILY[severity];
  // The line reads "Headline · detail" — split the first middot so the headline
  // carries weight and the cause reads quietly under it.
  const [headline, ...rest] = line.split(" · ");
  const detail = rest.join(" · ");
  const moreText = moreCount > 0 ? ` · and ${moreCount} more` : "";

  if (variant === "band") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-surface)] border px-4 py-3 shadow-[var(--shadow-card)]",
          className
        )}
        style={{ backgroundColor: fam.bg, borderColor: fam.border, color: fam.fg }}
      >
        <AttentionIcon
          severity={severity}
          className="size-4 shrink-0"
          style={{ color: fam.accent }}
        />
        <p className="min-w-0 flex-1 text-[13px] leading-[18px]">
          {line}
          {moreText && <span className="opacity-80">{moreText}</span>}
        </p>
        {action && <ActionLink action={action} fg={fam.fg} />}
      </div>
    );
  }

  return (
    <section
      aria-label="Attention"
      data-record-section="attention"
      data-anno-ref="attention-card"
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius-elevated)] border px-5 py-4 shadow-[var(--shadow-alert)] sm:flex-row sm:items-center",
        className
      )}
      style={{ backgroundColor: fam.bg, borderColor: fam.border, color: fam.fg }}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: `color-mix(in oklab, ${fam.accent} 16%, white)`,
          color: fam.accent,
        }}
      >
        <AttentionIcon severity={severity} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-[20px]">{headline}</p>
        {(detail || moreText) && (
          <p className="mt-0.5 text-[13px] leading-[18px] opacity-85">
            {detail}
            {moreText}
          </p>
        )}
      </div>
      {action && <ActionLink action={action} fg={fam.fg} />}
    </section>
  );
}
