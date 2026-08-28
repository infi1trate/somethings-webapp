import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProfileStatus } from "@/lib/types";

const LABELS: Record<ProfileStatus, string> = {
  invited: "Invited",
  pending: "Draft",
  in_review: "In review",
  published: "Published",
  rejected: "Needs changes",
};

const STYLES: Record<ProfileStatus, string> = {
  // ═══ THE ONE THAT DID NOT USE ITS PAIR (gap row 286) ═══
  //
  // Every other row here is a `--status-*-bg` / `--status-*-fg` pair. `invited`
  // reached for the generic muted pair instead, and it was the only one that
  // failed: `--muted` IS `--status-neutral-bg` (#dcdcdc), so the badge was
  // `--muted-foreground` on it — 3.86:1 for 12px text, under the 4.5 floor.
  // Six nodes across the wizard steps (B3, B8, B12).
  //
  // The background is unchanged, because `--muted` already resolves to the same
  // #dcdcdc. Only the ink moves, to the fill's own paired token
  // `--status-neutral-fg` (#525252, 5.70:1) — which the design system already
  // supplied. Nothing invented, and the row now reads like its four siblings.
  invited:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  pending: "bg-secondary text-secondary-foreground",
  in_review: "bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]",
  published: "bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  rejected: "bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)]",
};

export function StatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn("rounded-full font-medium", STYLES[status])}
    >
      {LABELS[status]}
    </Badge>
  );
}
