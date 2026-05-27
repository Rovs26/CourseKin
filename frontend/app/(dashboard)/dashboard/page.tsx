"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { UpcomingPreparation } from "@/components/dashboard/upcoming-preparation";
import { EmptyState } from "@/components/states/empty-state";
import { useUser } from "@clerk/nextjs";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

export default function DashboardPage() {
  const { user } = useUser();
  const { summaries, isLoading, error } = useProjectSummaries();
  const visibleSummaries = summaries.slice(0, 4);
  const firstName = user?.firstName ?? "there";

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

      <UpcomingPreparation />

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
          <p className="text-sm text-slate-500">Loading courses...</p>
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
