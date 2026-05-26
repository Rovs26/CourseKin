import { useCallback, useEffect, useState } from "react";
import { listCourseObligations, type CourseObligation } from "@/lib/coursekin-api";

export function useObligations(projectId?: string) {
  const [obligations, setObligations] = useState<CourseObligation[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setObligations([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listCourseObligations(projectId)
      .then((result) => {
        if (!cancelled) setObligations(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load course plan.");
          setObligations([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  return { obligations, isLoading, error, refetch };
}
