"use client";

import { useEffect, useMemo, useState } from "react";
import { getReviewer, listProjectSources } from "@/lib/reviewflow-api";
import { useMockProjects } from "@/hooks/use-mock-projects";
import type { Project } from "@/types/project";
import type { ReviewerOutput } from "@/types/reviewer";
import type { Source } from "@/types/source";

export type ProjectSummary = {
  project: Project;
  sources: Source[];
  sourceCount: number;
  reviewer: ReviewerOutput;
  coveragePercent: number;
  activityAt: string;
};

function createDefaultReviewer(projectId: string): ReviewerOutput {
  return {
    project_id: projectId,
    source_id: null,
    status: "not-ready",
    output_type: "full-reviewer",
    version: 1,
    content_json: null,
  };
}

function getCoveragePercent(
  content: ReviewerOutput["content_json"] | null | undefined
) {
  if (!content) {
    return 0;
  }

  const filledSections = [
    Boolean(content.summary),
    content.key_points.length > 0,
    content.definitions.length > 0,
    content.qa.length > 0,
    content.quiz.length > 0,
    content.flashcards.length > 0,
  ].filter(Boolean).length;

  return Math.round((filledSections / 6) * 100);
}

export function useProjectSummaries() {
  const { projects, isReady: isProjectsReady, error: projectsError } = useMockProjects();
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isProjectsReady) {
      return;
    }

    if (projectsError) {
      setError(projectsError);
      setSummaries([]);
      setIsLoading(false);
      return;
    }

    if (projects.length === 0) {
      setSummaries([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSummaries = await Promise.all(
          projects.map(async (project) => {
            try {
              const [sourcesResponse, reviewerResponse] = await Promise.all([
                listProjectSources(project.id),
                getReviewer(project.id),
              ]);

              const sources = [...sourcesResponse.items].sort((a, b) =>
                b.created_at.localeCompare(a.created_at)
              );

              const reviewer = reviewerResponse ?? createDefaultReviewer(project.id);
              const latestSourceAt = sources[0]?.updated_at ?? sources[0]?.created_at;
              const activityAt =
                latestSourceAt ??
                reviewer.updated_at ??
                project.updated_at ??
                project.created_at;

              return {
                project,
                sources,
                sourceCount: sources.length,
                reviewer,
                coveragePercent: getCoveragePercent(reviewer.content_json),
                activityAt,
              } satisfies ProjectSummary;
            } catch {
              const reviewer = createDefaultReviewer(project.id);

              return {
                project,
                sources: [],
                sourceCount: 0,
                reviewer,
                coveragePercent: 0,
                activityAt: project.updated_at ?? project.created_at,
              } satisfies ProjectSummary;
            }
          })
        );

        if (!isCancelled) {
          setSummaries(nextSummaries);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load project summaries."
          );
          setSummaries([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    run();

    return () => {
      isCancelled = true;
    };
  }, [isProjectsReady, projects, projectsError]);

  const summariesByProjectId = useMemo(
    () =>
      Object.fromEntries(
        summaries.map((summary) => [summary.project.id, summary])
      ) as Record<string, ProjectSummary>,
    [summaries]
  );

  return {
    projects,
    summaries,
    summariesByProjectId,
    isLoading: !isProjectsReady || isLoading,
    error: projectsError ?? error,
  };
}