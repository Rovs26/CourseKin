import { useCallback, useEffect, useState } from "react";
import { listProjectSources } from "@/lib/reviewflow-api";
import type { Source } from "@/types/source";

export function useSources(projectId?: string) {
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setSources([]);
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
        const response = await listProjectSources(id);
        const nextSources = [...response.items].sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        );

        if (!isCancelled) {
          setSources(nextSources);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load sources."
          );
          setSources([]);
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
    sources,
    isLoading,
    error,
    refetch,
  };
}