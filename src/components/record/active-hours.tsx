"use client";

// Active Hours — the mentor availability schedule editor. Rendered on the
// record's Schedule tab (staff-editable: lead + supervisor) and the mentor
// self-view. Timezone + auto-detect + a per-day enable/from/to, committed with
// an explicit Save (the editor holds a local draft; nothing writes until Save).
//
// App language, not the mock's blue: the Switch ON state is the primary fill,
// Save is the standard primary button.

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { useMounted } from "@/lib/use-mounted";
import {
  cloneSchedule,
  TIME_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAYS,
  type Schedule,
  type Weekday,
} from "@/lib/schedule";
import { touchTarget } from "@/lib/touch-target";
import { cn } from "@/lib/utils";

export function ActiveHoursEditor({ editable = true }: { editable?: boolean }) {
  const mounted = useMounted();
  const schedule = useOnboardingStore((s) => s.schedule);
  const setSchedule = useOnboardingStore((s) => s.setSchedule);

  // Mount-gate so the form seeds from the hydrated (localStorage) schedule, not
  // the SSR default — remounting via key when the stored identity changes.
  if (!mounted) {
    return (
      <div className="h-64 animate-pulse rounded-[var(--radius-elevated)] bg-[var(--surface-s1)]" />
    );
  }
  return (
    <ActiveHoursForm
      initial={schedule}
      editable={editable}
      onSave={setSchedule}
    />
  );
}

function TimeSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      {/* ═══ 40px VISUAL, 44px TARGET (Phase 6, product-owner decision) ═══

          The compact height is DELIBERATE and stays — `ui/select.tsx` defaults
          these to `h-12`, and this surface overrides to `h-10` because the
          Schedule tab stacks fourteen of them and 4px per row is 56px of page.
          Asked before changing; the answer was keep the visual, extend the
          target.

          `touchTarget(40)` is a transparent `::after` at ±2px. VERTICAL ONLY,
          which is what makes it safe for the start/end pair: the two triggers
          sit side by side, and a horizontal extension would let a tap aimed at
          the end time land on the start time. */}
      <SelectTrigger
        className={cn(touchTarget(40), "h-10 w-[124px] max-w-full")}
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Exported so a FIXTURE person's Schedule tab reuses this exact editor with
 *  their own schedule + save target — the store-bound wrapper above is only for
 *  the one live mentor. Same control, so the two records can't drift. */
export function ActiveHoursForm({
  initial,
  editable,
  onSave,
}: {
  initial: Schedule;
  editable: boolean;
  onSave: (s: Schedule) => void;
}) {
  const [draft, setDraft] = useState<Schedule>(() => cloneSchedule(initial));
  const [baseline, setBaseline] = useState<Schedule>(() =>
    cloneSchedule(initial)
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const patchDay = (day: Weekday, patch: Partial<Schedule["days"][Weekday]>) =>
    setDraft((d) => ({
      ...d,
      days: { ...d.days, [day]: { ...d.days[day], ...patch } },
    }));

  const save = () => {
    onSave(cloneSchedule(draft));
    setBaseline(cloneSchedule(draft));
    toast.success("Active hours saved");
  };

  return (
    <div className="rounded-[var(--radius-elevated)] border border-[color:var(--border-contour)] bg-[var(--surface-card)] px-[var(--surface-pad-x)] py-[var(--surface-pad-y)] shadow-[var(--shadow-card)]">
      <h2 className="font-display text-[18px] font-bold leading-[24px] tracking-tight text-[var(--text-primary)]">
        Active Hours
      </h2>
      <p
        className="mt-1 max-w-prose text-[var(--text-secondary)]"
        style={{ font: "var(--type-helper)", lineHeight: 1.5 }}
      >
        Set active hours for each day — the times this mentor is available for
        mentoring. Disabling a day means they&apos;re offline that day.
      </p>

      {/* Timezone */}
      <div className="mt-6">
        <label
          htmlFor="tz"
          className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]"
        >
          Timezone
        </label>
        <Select
          value={draft.timezone}
          onValueChange={(v) => setDraft((d) => ({ ...d, timezone: v }))}
          disabled={!editable || draft.autoDetect}
        >
          {/* Same decision as the time pickers above. */}
          <SelectTrigger
            id="tz"
            className={cn(touchTarget(40), "h-10 w-[280px] max-w-full")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONE_OPTIONS.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-3 flex items-center gap-2.5">
          <Switch
            id="auto-tz"
            checked={draft.autoDetect}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, autoDetect: v }))}
            disabled={!editable}
            aria-label="Automatically detect timezone"
          />
          <label
            htmlFor="auto-tz"
            className="cursor-pointer text-sm font-medium text-[var(--text-primary)]"
          >
            Automatically detect timezone
          </label>
        </div>
      </div>

      {/* Per-day rows */}
      <div className="mt-6 space-y-1">
        {WEEKDAYS.map((day) => {
          const d = draft.days[day];
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-xl py-2"
            >
              <span className="w-24 shrink-0 text-sm font-medium text-[var(--text-primary)]">
                {day}
              </span>
              <Switch
                checked={d.enabled}
                onCheckedChange={(v) => patchDay(day, { enabled: v })}
                disabled={!editable}
                aria-label={`${day} active`}
              />
              <div
                className={cn(
                  "flex items-center gap-3 transition-opacity",
                  !d.enabled && "opacity-40"
                )}
              >
                <TimeSelect
                  value={d.from}
                  onChange={(v) => patchDay(day, { from: v })}
                  disabled={!editable || !d.enabled}
                  label={`${day} start time`}
                />
                <span className="text-[var(--text-muted)]" aria-hidden>
                  –
                </span>
                <TimeSelect
                  value={d.to}
                  onChange={(v) => patchDay(day, { to: v })}
                  disabled={!editable || !d.enabled}
                  label={`${day} end time`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {editable && (
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={!dirty} className="gap-2">
            <Save className="size-4" aria-hidden />
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
