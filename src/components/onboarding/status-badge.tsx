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
  invited: "bg-muted text-muted-foreground",
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
