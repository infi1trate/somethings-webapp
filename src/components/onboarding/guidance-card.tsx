import { Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuidanceCardProps {
  /** Eyebrow label — names this as help ("Examples from other mentors", etc.). */
  label?: string;
  /** Decorative eyebrow icon; defaults to Sparkles. Pass null for no icon. */
  icon?: LucideIcon | null;
  /** Optional control pinned to the header's right edge (e.g. a "Show another"
   *  cycle button) — keeps a card-level action out of the body content. */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

// The shared "guidance / help" surface for the profile-building steps (bio, audio
// intro, vibe). Deliberately SECONDARY: a tinted, BORDER-LESS panel so it can't be
// mistaken for an input field (white + visible border) or for already-entered
// content (white card + shadow) — that ambiguity was the competing-regions bug.
//
// Tokens only (per design review — reuse existing, no new token): `bg-muted` for
// the surface and `text-foreground/70` for the eyebrow. The old recipe
// (`bg-muted/40` + `text-muted-foreground`) both under-differentiated AND failed
// WCAG AA on the eyebrow (~4.0:1); `text-foreground/70` measures ~5.7:1 on muted.
// The fill (not a border) defines the card, so there's no 1.4.11 border-contrast
// requirement to meet. The brand eyebrow icon stays decorative (aria-hidden).
export function GuidanceCard({
  label,
  icon: Icon = Sparkles,
  action,
  className,
  children,
}: GuidanceCardProps) {
  return (
    <div className={cn("rounded-xl bg-muted px-3.5 py-3", className)}>
      {(label || action) && (
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {label ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              {Icon && <Icon className="size-3.5 text-brand" aria-hidden />}
              {label}
            </span>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
