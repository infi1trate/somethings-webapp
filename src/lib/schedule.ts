// Active Hours (mentor availability schedule) — the data model + option lists
// for the record's Schedule tab and the mentor self-view. A mentor's active
// hours are the times they're around for teens; disabling a day = offline that
// day. TODO-DATA: the prototype has one store-backed mentor, so the schedule is
// a single store slice (not keyed per mentor).

export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const WEEKDAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface DaySchedule {
  /** Off = the mentor is offline that day (the time range is ignored). */
  enabled: boolean;
  from: string; // a TIME_OPTIONS value, e.g. "9:00 AM"
  to: string;
}

export interface Schedule {
  timezone: string;
  /** When on, the app follows the browser's timezone (the select is disabled). */
  autoDetect: boolean;
  days: Record<Weekday, DaySchedule>;
}

// 30-minute slots across the day, 12-hour labels ("12:00 AM" … "11:30 PM").
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h24 = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min} ${period}`;
});

// A pragmatic subset of IANA zones (the mock shows America/New_York).
export const TIMEZONE_OPTIONS: string[] = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC",
];

const defaultDay = (): DaySchedule => ({
  enabled: true,
  from: "9:00 AM",
  to: "5:00 PM",
});

export const DEFAULT_SCHEDULE: Schedule = {
  timezone: "America/New_York",
  autoDetect: true,
  days: {
    Monday: defaultDay(),
    Tuesday: defaultDay(),
    Wednesday: defaultDay(),
    Thursday: defaultDay(),
    Friday: defaultDay(),
    Saturday: defaultDay(),
    Sunday: defaultDay(),
  },
};

/** Deep clone so callers get an isolated editable copy (avoids shared refs). */
export function cloneSchedule(s: Schedule): Schedule {
  return {
    timezone: s.timezone,
    autoDetect: s.autoDetect,
    days: Object.fromEntries(
      WEEKDAYS.map((d) => [d, { ...s.days[d] }])
    ) as Record<Weekday, DaySchedule>,
  };
}
