"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { EmptyState } from "@/components/states/empty-state";
import { useMockProjects } from "@/hooks/use-mock-projects";
import { routes } from "@/lib/routes";

export default function ProjectsPage() {
  const { projects, isReady } = useMockProjects();
  const visibleProjects = isReady ? projects : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Projects
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your reviewer workspaces and continue where you left off.
          </p>
        </div>

        <Button asChild className="rounded-xl">
          <Link href={routes.newProject}>Create New Project</Link>
        </Button>
      </div>

      {visibleProjects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No projects yet"
          description="Create a project to start your first reviewer workspace."
        />
      )}
    </div>
  );
}