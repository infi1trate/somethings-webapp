// Styled tag renderers for the record's Profile tab — interests get an icon per
// tag (shared iconFor map), languages render as plain pills. Replaces the old
// comma-joined text values so multi-value fields read as distinct tags.

import { iconFor } from "@/lib/interest-icons";
import { cn } from "@/lib/utils";

const TAG =
  "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-contour)] bg-[var(--surface-s1)] px-2.5 py-1 text-[13px] font-medium text-[var(--text-primary)]";

function Empty() {
  return <span className="text-[var(--text-muted)]">Not recorded</span>;
}

export function InterestTags({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return <Empty />;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((name) => {
        const Icon = iconFor(name);
        return (
          <span key={name} className={TAG}>
            <Icon
              className="size-3.5 shrink-0 text-[var(--text-secondary)]"
              aria-hidden
            />
            {name}
          </span>
        );
      })}
    </span>
  );
}

export function PlainTags({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (!items.length) return <Empty />;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((name) => (
        <span key={name} className={TAG}>
          {name}
        </span>
      ))}
    </span>
  );
}
