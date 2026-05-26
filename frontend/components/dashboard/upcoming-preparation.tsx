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
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <BellRing className="h-5 w-5 text-[var(--ck-primary)]" />
          Upcoming Preparation
        </CardTitle>
        <p className="text-sm text-slate-500">
          In-app prompts from the preparation sessions you planned.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading reminders...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : reminders.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Nothing is due soon. Build a preparation runway inside a course plan to see prompts here.
          </p>
        ) : (
          <>
            {reminders.slice(0, 5).map((item) => (
              <Link
                key={item.milestone_id}
                href={routes.projectPlanning(item.project_id)}
                className="block rounded-xl border bg-slate-50 p-4 transition-colors hover:bg-[var(--ck-primary-soft)]"
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
