"use client";

import Link from "next/link";
import { BellRing, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePreparationReminders } from "@/hooks/use-preparation-reminders";
import { routes } from "@/lib/routes";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

const urgencyStyles = {
  overdue: "bg-rose-100 text-rose-700",
  today: "bg-amber-100 text-amber-800",
  upcoming: "bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]",
};

function urgencyLabel(urgency: "overdue" | "today" | "upcoming") {
  if (urgency === "overdue") return "Past plan date";
  if (urgency === "today") return "Today";
  return "Upcoming";
}

export function UpcomingPreparation() {
  const { reminders, total, isLoading, error } = usePreparationReminders();

  return (
    <Card className="rounded-3xl border-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <span className="grid size-9 place-items-center rounded-2xl bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]">
            <BellRing className="size-4" />
          </span>
          Next up
        </CardTitle>
        <p className="text-sm text-slate-500">
          Planned study sessions from your confirmed course dates.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading reminders...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : reminders.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Nothing planned yet. Confirm syllabus dates in a course plan to build your schedule.
          </p>
        ) : (
          <>
            {reminders.slice(0, 5).map((item) => (
              <Link
                key={item.milestone_id}
                href={routes.projectPlanning(item.project_id)}
                className="block rounded-2xl border border-white/60 bg-slate-50 p-4 transition-colors hover:bg-[var(--ck-primary-soft)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.milestone_title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.course_code || item.project_title} / {item.obligation_title}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${urgencyStyles[item.urgency]}`}>
                    {urgencyLabel(item.urgency)}
                  </span>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {displayDate(item.scheduled_date)} / {item.estimated_minutes} minutes
                </p>
              </Link>
            ))}
            {total > 5 && (
              <p className="text-xs text-slate-500">
                {total - 5} more preparation prompt(s) are waiting in your course plans.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
