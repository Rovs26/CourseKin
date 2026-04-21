"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { UsageOverview } from "@/components/dashboard/usage-overview";
import { EmptyState } from "@/components/states/empty-state";
import { useUser } from "@clerk/nextjs";
import { useMockProjects } from "@/hooks/use-mock-projects";
import { routes } from "@/lib/routes";

export default function DashboardPage() {
  const { user } = useUser();
  const { projects, isReady } = useMockProjects();
  const visibleProjects = isReady ? projects : [];
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

        {visibleProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No projects yet"
            description="Create your first project to start building reviewers."
          />
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <RecentActivity />
        <UsageOverview />
      </div>
    </div>
  );
}
