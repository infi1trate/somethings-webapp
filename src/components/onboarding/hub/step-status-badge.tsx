import {
  AlertCircle,
  Check,
  Circle,
  Clock,
  Loader2,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Every state a hub step can be in — the Profile step's review sub-states plus
 *  the generic completion states of the other four. */
export type StepCardState =
  | "not_started"
  | "draft"
  | "in_progress"
  | "in_review"
  | "returned"
  | "done"
  | "approved";

interface BadgeSpec {
  label: string;
  Icon: LucideIcon;
  /** bg + text — both clear WCAG AA (≥4.5:1). */
  className: string;
}

// Status is NEVER conveyed by colour alone — each badge pairs a tinted pill with
// an icon AND a text label (WCAG 1.4.1). All pairs clear AA: the *-800 inks on
// their *-100 tints (~6–7:1), and near-black `foreground` on the warm neutrals.
const SPECS: Record<StepCardState, BadgeSpec> = {
  not_started: {
    label: "Not started",
    Icon: Circle,
    className: "bg-muted text-foreground",
  },
  draft: {
    label: "Draft",
    Icon: PencilLine,
    className: "bg-secondary text-foreground",
  },
  in_progress: {
    label: "In progress",
    Icon: Loader2,
    className: "bg-[var(--status-info-bg)] text-[var(--status-info-fg)]",
  },
  in_review: {
    label: "In review",
    Icon: Clock,
    className: "bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]",
  },
  returned: {
    label: "Needs changes",
    Icon: AlertCircle,
    className: "bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)]",
  },
  done: {
    label: "Done",
    Icon: Check,
    className: "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  },
  approved: {
    label: "Approved",
    Icon: Check,
    className: "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  },
};

/** Consistent status pill used by every step card (and reusable elsewhere). */
export function StepStatusBadge({
  state,
  className,
}: {
  state: StepCardState;
  className?: string;
}) {
  const { label, Icon, className: tint } = SPECS[state];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tint,
        className
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
