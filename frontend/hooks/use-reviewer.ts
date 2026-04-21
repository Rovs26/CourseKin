import { useCallback, useEffect, useState } from "react";
import { getReviewer } from "@/lib/reviewflow-api";
import type { ReviewerOutput } from "@/types/reviewer";

export function useReviewer(projectId?: string) {
  const [reviewer, setReviewer] = useState<ReviewerOutput | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setReviewer(null);
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
        const nextReviewer = await getReviewer(id);

        if (!isCancelled) {
          setReviewer(nextReviewer);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load reviewer."
          );
          setReviewer(null);
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
    reviewer,
    isLoading,
    error,
    refetch,
  };
}