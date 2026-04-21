import { useCallback, useEffect, useState } from "react";
import { getProject } from "@/lib/reviewflow-api";
import type { Project } from "@/types/project";

export function useProject(projectId?: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const id = projectId;
    let isCancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);

      try {
        const nextProject = await getProject(id);

        if (!isCancelled) {
          setProject(nextProject);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load project."
          );
          setProject(null);
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
  }, [projectId, refreshKey]);

  return {
    project,
    isLoading,
    error,
    refetch,
  };
}