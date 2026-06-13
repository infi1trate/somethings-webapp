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
  in_review: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  rejected: "bg-orange-100 text-orange-800",
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
