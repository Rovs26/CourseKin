import { useCallback, useEffect, useState } from "react";
import { getPreparationRunway, type PreparationRunway } from "@/lib/coursekin-api";

export function usePreparationRunway(
  projectId: string,
  dailyCapacityMinutes: number,
  refreshToken: number
) {
  const [runway, setRunway] = useState<PreparationRunway | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getPreparationRunway(projectId, dailyCapacityMinutes)
      .then((result) => {
        if (!cancelled) setRunway(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRunway(null);
          setError(err instanceof Error ? err.message : "Failed to load preparation runway.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, dailyCapacityMinutes, refreshKey, refreshToken]);

  return { runway, isLoading, error, refetch, setRunway };
}
