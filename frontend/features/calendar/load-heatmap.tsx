"use client";

import { useEffect, useMemo, useState } from "react";
import { Flag, LayoutGrid } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalendarAgenda, type CalendarAgendaItem } from "@/lib/coursekin-api";

const WEEKS = 6;
const DEADLINE_MINUTES = 90; // weight a deadline carries toward a week's load

const glassSurfaceSubtle =
  "rounded-3xl border border-white/40 bg-white/50 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl";

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function weekLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(d);
}

type CourseRow = {
  projectId: string;
  label: string;
  cells: { minutes: number; deadlines: number }[];
};

function loadTint(minutes: number, max: number): string {
  if (minutes <= 0) return "bg-slate-100/70 text-slate-300";
  const ratio = max > 0 ? minutes / max : 0;
  if (ratio > 0.75) return "bg-[var(--ck-primary)] text-white";
  if (ratio > 0.5) return "bg-[var(--ck-primary)]/70 text-white";
  if (ratio > 0.25) return "bg-[var(--ck-primary)]/40 text-[var(--ck-ink)]";
  return "bg-[var(--ck-primary-soft)] text-[var(--ck-ink)]";
}

export function LoadHeatmap() {
  const [items, setItems] = useState<CalendarAgendaItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStarts = useMemo(() => {
    const first = startOfWeek(new Date());
    return Array.from({ length: WEEKS }, (_, i) => {
      const d = new Date(first);
      d.setDate(d.getDate() + i * 7);
      return d;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const start = weekStarts[0];
      const end = new Date(weekStarts[WEEKS - 1]);
      end.setDate(end.getDate() + 6);
      try {
        const agenda = await getCalendarAgenda(isoDate(start), isoDate(end));
        if (!cancelled) setItems(agenda.items);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [weekStarts]);

  const { rows, maxLoad } = useMemo(() => {
    if (!items) return { rows: [] as CourseRow[], maxLoad: 0 };
    const weekStartTimes = weekStarts.map((d) => d.getTime());
    const byCourse = new Map<string, CourseRow>();

    const weekIndexFor = (dateStr: string): number => {
      const t = startOfWeek(new Date(`${dateStr}T00:00:00`)).getTime();
      return weekStartTimes.indexOf(t);
    };

    for (const item of items) {
      const wi = weekIndexFor(item.date);
      if (wi < 0) continue;
      let row = byCourse.get(item.project_id);
      if (!row) {
        row = {
          projectId: item.project_id,
          label: item.course_code || item.project_title,
          cells: Array.from({ length: WEEKS }, () => ({ minutes: 0, deadlines: 0 })),
        };
        byCourse.set(item.project_id, row);
      }
      if (item.item_type === "deadline") {
        row.cells[wi].deadlines += 1;
        row.cells[wi].minutes += DEADLINE_MINUTES;
      } else {
        row.cells[wi].minutes += item.estimated_minutes ?? 30;
      }
    }

    const allRows = [...byCourse.values()].sort((a, b) => a.label.localeCompare(b.label));
    const max = Math.max(
      0,
      ...allRows.flatMap((r) => r.cells.map((c) => c.minutes))
    );
    return { rows: allRows, maxLoad: max };
  }, [items, weekStarts]);

  if (loading) {
    return <Skeleton className="h-48 w-full rounded-3xl" />;
  }
  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className={`${glassSurfaceSubtle} overflow-hidden p-5`}>
      <div className="mb-4 flex items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-[var(--ck-primary)]" />
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Workload across courses</h3>
          <p className="text-xs text-slate-500">
            Study load by week for the next {WEEKS} weeks. Darker means a heavier week.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-32" />
              {weekStarts.map((d, i) => (
                <th
                  key={i}
                  className="px-1 pb-1 text-center text-[11px] font-medium text-slate-500"
                >
                  {weekLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectId}>
                <td className="pr-2 text-right text-xs font-medium text-slate-700">
                  <span className="line-clamp-1">{row.label}</span>
                </td>
                {row.cells.map((cell, i) => {
                  const hours = cell.minutes / 60;
                  return (
                    <td key={i} className="p-0">
                      <div
                        title={`${row.label} · ${weekLabel(weekStarts[i])}: ${
                          hours >= 1 ? `${hours.toFixed(1)}h` : `${cell.minutes}m`
                        } planned${cell.deadlines ? `, ${cell.deadlines} deadline(s)` : ""}`}
                        className={`relative flex h-10 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${loadTint(
                          cell.minutes,
                          maxLoad
                        )}`}
                      >
                        {cell.minutes > 0 && (hours >= 1 ? `${Math.round(hours)}h` : `${cell.minutes}m`)}
                        {cell.deadlines > 0 && (
                          <Flag className="absolute right-1 top-1 h-3 w-3 text-rose-500" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Flag className="h-3 w-3 text-rose-500" />
        Deadline that week
      </p>
    </Card>
  );
}
