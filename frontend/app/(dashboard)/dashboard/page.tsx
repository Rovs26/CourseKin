"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CalendarRange, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/dashboard/project-card";
import { TodaySnapshot } from "@/components/dashboard/today-snapshot";
import { UpcomingPreparation } from "@/components/dashboard/upcoming-preparation";
import { StudyAssistant } from "@/features/planner/study-assistant";
import { EmptyState } from "@/components/states/empty-state";
import { useUser } from "@clerk/nextjs";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

export default function DashboardPage() {
  const { user } = useUser();
  const { summaries, isLoading, error } = useProjectSummaries();
  const visibleSummaries = summaries.slice(0, 4);
  const firstName = user?.firstName ?? "there";

  const showGettingStarted = !isLoading && !error && summaries.length === 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ck-primary)]">
            Today
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Good to see you, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Check what is coming up, continue a course, or add a syllabus to plan ahead.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-xl">
          <Link href={routes.newCourse}>Add Course</Link>
        </Button>
      </div>

      {showGettingStarted ? (
        <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-violet-50 via-white to-sky-50 p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]">
          <div className="absolute inset-0 -z-10 bg-white/40 backdrop-blur-2xl" />
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-violet-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                Get started in three steps
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                A short setup so CourseKin can plan your term and keep your notebook tidy.
              </p>
              <ol className="mt-4 grid gap-3 sm:grid-cols-3">
                <li className="rounded-2xl border border-white/60 bg-white/70 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
                    <BookOpen className="h-4 w-4" />
                    1. Add a course
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    Course name, code, term. Two minutes.
                  </p>
                </li>
                <li className="rounded-2xl border border-white/60 bg-white/70 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
                    <Sparkles className="h-4 w-4" />
                    2. Upload syllabus
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    We extract dates and topics for review.
                  </p>
                </li>
                <li className="rounded-2xl border border-white/60 bg-white/70 p-3 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
                    <CalendarRange className="h-4 w-4" />
                    3. Plan the term
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    Confirm dates, get study sessions on your calendar.
                  </p>
                </li>
              </ol>
              <Button asChild className="mt-5">
                <Link href={routes.newCourse}>
                  Add your first course
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          <TodaySnapshot />
          <div className="grid gap-6 lg:grid-cols-2">
            <UpcomingPreparation />
            <StudyAssistant compact />
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your courses</h2>
          {summaries.length > visibleSummaries.length && (
            <Link href={routes.courses} className="text-sm font-medium text-[var(--ck-primary)]">
              See all courses
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Unable to load courses" description={error} />
        ) : visibleSummaries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleSummaries.map((summary) => (
              <ProjectCard key={summary.project.id} summary={summary} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No courses yet"
            description="Add your first course, then bring in a syllabus or class material."
          />
        )}
      </section>
    </div>
  );
}
