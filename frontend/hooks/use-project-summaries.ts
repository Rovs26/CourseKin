"use client";

import { useCallback, useEffect, useState } from "react";
import { listProjectSummaries, type ProjectSummary } from "@/lib/coursekin-api";

export function useProjectSummaries() {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
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
        const response = await listProjectSummaries();
        const nextSummaries = [...response.items].sort((a, b) =>
          b.activity_at.localeCompare(a.activity_at)
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
  }, [refreshKey]);

  return {
    projects: summaries.map((summary) => summary.project),
    summaries,
    isLoading,
    error,
    refetch,
  };
}
