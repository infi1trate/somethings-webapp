import { cn } from "@/lib/utils";

interface PhonePreviewShellProps {
  children?: React.ReactNode;
  /** Accessible name for the whole preview (§6 sweep) — e.g.
   *  "Live preview — what teens see". The bezel/notch stay decorative. */
  label?: string;
  className?: string;
}

// Phone-preview SHELL only (Phase 0) — build-spec §2 anatomy: 360px device,
// dark gradient bezel radius 48 → screen radius 40, notch pill. Strictly a
// frame: no content binding here (Phase 1 binds the live teen-facing preview).
// The preview is passive output — never an editing surface.
export function PhonePreviewShell({
  children,
  label,
  className,
}: PhonePreviewShellProps) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cn(
        "w-[360px] shrink-0 rounded-[var(--radius-preview-frame)] bg-gradient-to-b from-[#404040] to-[#171717] p-[6px] shadow-[0_18px_50px_rgba(31,30,29,0.4)]",
        className
      )}
    >
      <div className="rounded-[43px] bg-[#0a0a0a] p-[3px]">
        <div className="relative h-[736px] overflow-hidden rounded-[var(--radius-preview-screen)] bg-white">
          <div
            aria-hidden
            className="absolute left-1/2 top-[10px] z-10 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black"
          />
          {children ?? (
            <div className="flex h-full items-center justify-center px-8 text-center text-[14px] leading-[20px] text-[var(--text-muted)]">
              No content bound — preview binding lands in Phase 1.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
