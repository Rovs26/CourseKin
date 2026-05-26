"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UsageOverview } from "@/components/dashboard/usage-overview";
import { UpcomingPreparation } from "@/components/dashboard/upcoming-preparation";
import { EmptyState } from "@/components/states/empty-state";
import { useUser } from "@clerk/nextjs";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

export default function DashboardPage() {
  const { user } = useUser();
  const { summaries, isLoading, error } = useProjectSummaries();
  const visibleSummaries = summaries.slice(0, 3);
  const firstName = user?.firstName ?? "there";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your projects and study materials in one place.
          </p>
        </div>
        <Button asChild size="lg" className="rounded-xl">
          <Link href={routes.newProject}>New Project</Link>
        </Button>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Projects</h2>

        {isLoading ? (
          <p className="text-sm text-slate-500">Loading projects...</p>
        ) : error ? (
          <EmptyState title="Unable to load projects" description={error} />
        ) : visibleSummaries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleSummaries.map((summary) => (
              <ProjectCard key={summary.project.id} summary={summary} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start building reviewers."
          />
        )}
      </section>

      <UpcomingPreparation />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RecentActivity summaries={summaries} isLoading={isLoading} error={error} />
        <UsageOverview summaries={summaries} isLoading={isLoading} error={error} />
      </div>
    </div>
  );
}
