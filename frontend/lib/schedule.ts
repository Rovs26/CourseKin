// Helpers for the "Add a course" structured term picker and schedule builder.
// Both ultimately serialize to the plain strings stored on the project
// (`term`, `meeting_schedule`), so the API contract is unchanged.

export const SEMESTERS = [
  "First Semester",
  "Second Semester",
  "Summer / Intersession",
] as const;

export type Semester = (typeof SEMESTERS)[number];

// Academic-year options spanning the current year ± a small window, e.g.
// "2026-2027". The first label is the most likely current AY.
export function academicYearOptions(now: Date = new Date()): string[] {
  const base = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let offset = 0; offset <= 2; offset += 1) {
    years.push(`${base + offset}-${base + offset + 1}`);
  }
  return years;
}

export function formatTerm(semester: string, academicYear: string): string {
  if (!semester || !academicYear) return "";
  return `${semester}, AY ${academicYear}`;
}

export const DAY_OPTIONS = [
  { short: "M", label: "Mon" },
  { short: "T", label: "Tue" },
  { short: "W", label: "Wed" },
  { short: "Th", label: "Thu" },
  { short: "F", label: "Fri" },
  { short: "Sa", label: "Sat" },
  { short: "Su", label: "Sun" },
] as const;

export interface ScheduleBlock {
  days: string[]; // e.g. ["Mon", "Wed"]
  start: string; // "HH:MM" 24h from <input type="time">
  end: string;
  room: string;
}

export function emptyBlock(): ScheduleBlock {
  return { days: [], start: "", end: "", room: "" };
}

// "13:30" -> "1:30 PM"
function to12Hour(value: string): string {
  if (!value) return "";
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (Number.isNaN(h)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${period}`;
}

export function formatScheduleBlock(block: ScheduleBlock): string {
  const days = block.days.join("/");
  const time =
    block.start && block.end
      ? `${to12Hour(block.start)}–${to12Hour(block.end)}`
      : "";
  const core = [days, time].filter(Boolean).join(" ");
  if (!core) return "";
  return block.room.trim() ? `${core} · ${block.room.trim()}` : core;
}

export function formatSchedule(blocks: ScheduleBlock[]): string {
  return blocks
    .map(formatScheduleBlock)
    .filter(Boolean)
    .join("; ");
}
