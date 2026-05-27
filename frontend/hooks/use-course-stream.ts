import { useCallback, useEffect, useState } from "react";
import { listCourseStreamEntries, type CourseStreamEntry } from "@/lib/coursekin-api";

export function useCourseStream(projectId: string) {
  const [entries, setEntries] = useState<CourseStreamEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await listCourseStreamEntries(projectId);
        if (!isCancelled) {
          setEntries(response.items);
          setTotal(response.total);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to load course room.");
          setEntries([]);
          setTotal(0);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    run();
    return () => {
      isCancelled = true;
    };
  }, [projectId, refreshKey]);

  return { entries, total, isLoading, error, refetch };
}
