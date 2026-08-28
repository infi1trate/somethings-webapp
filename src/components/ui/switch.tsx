"use client";

// Switch — the design system's toggle, a thin wrapper over radix-ui's Switch
// (accessible role=switch, keyboard-operable). App language: the ON track is
// the primary foreground fill (matching the "active = filled" idiom used by
// StatusPill etc.), not the mock's blue; OFF is the inactive-state token.

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { touchTarget } from "@/lib/touch-target"
import { cn } from "@/lib/utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // ═══ TARGET SIZE (Phase 6) ═══
        //
        // MEASURED at 320px on Settings › Notifications: 44×24. The width was
        // fine (the row's padding pads it out); the HEIGHT is the switch's own
        // 24px and nothing was extending it. 24px clears the SC 2.5.8 floor but
        // sits well under the 44px `03-DEFINITION-OF-DONE.md` asks for, and a
        // switch is a MUTATION control — a mis-tap silently changes a
        // notification preference, with no undo and no confirmation.
        //
        // FIXED IN THE PRIMITIVE, not at the call site, because every switch in
        // the product has the same 24px height by construction: the notification
        // rows under all four personas, and anything added later. The visual is
        // untouched — `touchTarget(24)` is a transparent `::after`, so the pill
        // stays a 44×24 pill.
        //
        // THE WIDTH GREW 40 → 44 (`w-10` → `w-11`), which is a real 4px visual
        // change and the only one in this file. `touchTarget` is VERTICAL-only by
        // design (so adjacent controls cannot overlap hit areas), so it could
        // bring the height to 44 but not the width — and 40×44 still fails.
        // 44 is also what `notifications-section.tsx`'s ToggleSwitch has always
        // been, so this CONVERGES the two switch implementations rather than
        // adding a third size. The thumb travel moves with it: 44 − 20 thumb − 2
        // padding = 22px, matching that component exactly.
        touchTarget(24),
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-foreground data-[state=unchecked]:bg-[var(--state-inactive)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-[var(--surface-card)] shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[22px]" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
