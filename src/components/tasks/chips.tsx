"use client";

// ═══ THE BREACH CHIP — ONE PATTERN, SYSTEM-WIDE ═══
//
// Moved out of `domain-tabs.tsx` in arch-A. It was exported from there because
// the tab cards were its first consumer, and the detail pane imported it across —
// so the file holding the four-domain navigator also held the one breach
// treatment every surface is required to share. Scoping Tasks to billing retires
// that navigator, and the chip would have gone with it.
//
// It lives here so Tasks, the pane and Phase B's Monitoring all import the same
// one. The standing rule is "one breach pattern system-wide"; a chip that lives
// inside one surface's navigation is a chip the next surface reimplements.

import { AlertTriangle } from "lucide-react";

/** THE ONE BREACH CHIP, used on the tab, the row and the pane header (§3.3's
 *  alarm-budget rule: "one compact chip pattern everywhere"). Exported so the
 *  other two surfaces consume it rather than each growing a lookalike.
 *
 *  NEVER COLOUR ALONE — icon plus text, always. */
export function BreachChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-[16px]"
      style={{
        backgroundColor: "var(--band-clay-bg)",
        color: "var(--band-clay-fg)",
      }}
    >
      <AlertTriangle className="size-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
