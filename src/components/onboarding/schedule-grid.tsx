"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type Weekday, type WeeklySchedule } from "@/lib/types";

const DAY_LABELS: Record<Weekday, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const TIME_OPTIONS = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 7; h <= 22; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? "AM" : "PM";
      out.push({ value, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
    }
  }
  return out;
})();

interface Props {
  value: WeeklySchedule;
  onChange: (next: WeeklySchedule) => void;
}

export function ScheduleGrid({ value, onChange }: Props) {
  const patchDay = (day: Weekday, patch: Partial<WeeklySchedule[Weekday]>) =>
    onChange({ ...value, [day]: { ...value[day], ...patch } });

  return (
    <div className="divide-y rounded-lg border">
      {WEEKDAYS.map((day) => {
        const slot = value[day];
        return (
          <div
            key={day}
            className={cn(
              "flex flex-wrap items-center gap-3 px-4 py-3",
              !slot.enabled && "text-muted-foreground"
            )}
          >
            <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2.5">
              <Checkbox
                checked={slot.enabled}
                onCheckedChange={(c) => patchDay(day, { enabled: c === true })}
              />
              <span className="text-sm font-medium text-foreground">
                {DAY_LABELS[day]}
              </span>
            </label>

            {slot.enabled ? (
              <div className="flex items-center gap-2">
                <TimeSelect
                  value={slot.start}
                  onValueChange={(v) => patchDay(day, { start: v })}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <TimeSelect
                  value={slot.end}
                  onValueChange={(v) => patchDay(day, { end: v })}
                />
              </div>
            ) : (
              <span className="text-sm">Unavailable</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TimeSelect({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[120px]" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
