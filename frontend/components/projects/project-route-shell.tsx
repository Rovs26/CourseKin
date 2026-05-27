"use client";

import { ProjectHeader } from "@/components/projects/project-header";
import { ProjectSubnav } from "@/components/projects/project-subnav";
import { EmptyState } from "@/components/states/empty-state";
import { useProject } from "@/hooks/use-project";
import { useSources } from "@/hooks/use-sources";

export function ProjectRouteShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);
  const { sources, isLoading: isSourcesLoading, error: sourcesError } = useSources(projectId);

  const isLoading = isProjectLoading || isSourcesLoading;
  const error = projectError ?? sourcesError;

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading course...</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load course"
        description={error}
      />
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Course not found"
        description="This course does not exist in your workspace."
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} sourceCount={sources.length} />
      <ProjectSubnav projectId={project.id} />
      {children}
    </div>
  );
}
