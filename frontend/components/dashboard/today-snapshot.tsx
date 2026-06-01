"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, Flame, Layers, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getNotebookReviewQueue,
  getTaskStats,
  listPreparationReminders,
  type PreparationReminder,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";

type Snapshot = {
  dueCards: number;
  tasksToday: number;
  streakDays: number;
  nextSession: PreparationReminder | null;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

export function TodaySnapshot() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [queue, stats, reminders] = await Promise.allSettled([
        getNotebookReviewQueue(50),
        getTaskStats(),
        listPreparationReminders(),
      ]);
      if (cancelled) return;
      const reminderItems =
        reminders.status === "fulfilled" ? reminders.value.items : [];
      const nextSession =
        reminderItems.find((item) => item.urgency !== "overdue") ??
        reminderItems[0] ??
        null;
      setData({
        dueCards: queue.status === "fulfilled" ? queue.value.due_now : 0,
        tasksToday: stats.status === "fulfilled" ? stats.value.due_today : 0,
        streakDays:
          stats.status === "fulfilled" ? stats.value.streak.current_streak_days : 0,
        nextSession,
      });
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    );
  }
  if (!data) return null;

  const tiles = [
    {
      key: "cards",
      icon: Layers,
      value: data.dueCards,
      label: data.dueCards === 1 ? "card due" : "cards due",
      href: routes.calendar,
      tile: "bg-violet-100 text-violet-700",
    },
    {
      key: "tasks",
      icon: ListChecks,
      value: data.tasksToday,
      label: data.tasksToday === 1 ? "task today" : "tasks today",
      href: routes.calendar,
      tile: "bg-sky-100 text-sky-700",
    },
    {
      key: "streak",
      icon: Flame,
      value: data.streakDays,
      label: data.streakDays === 1 ? "day streak" : "day streak",
      href: routes.calendar,
      tile: "bg-orange-100 text-orange-600",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.key}
              href={tile.href}
              className="group flex items-center gap-4 rounded-3xl border border-white/60 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.28)]"
            >
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tile.tile}`}
              >
                <Icon className="size-6" />
              </span>
              <div>
                <p className="text-3xl font-semibold leading-none text-slate-900">
                  {tile.value}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">{tile.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {data.nextSession && (
        <Card className="overflow-hidden rounded-3xl border-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]">
          <Link
            href={routes.projectPlanning(data.nextSession.project_id)}
            className="group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[var(--ck-primary-soft)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]">
                <CalendarClock className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  Next: {data.nextSession.milestone_title}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {data.nextSession.course_code || data.nextSession.project_title} ·{" "}
                  {data.nextSession.urgency === "today"
                    ? "Today"
                    : displayDate(data.nextSession.scheduled_date)}{" "}
                  · {data.nextSession.estimated_minutes} min
                </p>
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Card>
      )}
    </div>
  );
}
