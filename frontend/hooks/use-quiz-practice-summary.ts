import { useEffect, useState } from "react";
import { getQuizPracticeSummary, type QuizPracticeSummary } from "@/lib/coursekin-api";

export function useQuizPracticeSummary(projectId: string, refreshToken = 0) {
  const [summary, setSummary] = useState<QuizPracticeSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getQuizPracticeSummary(projectId)
      .then((nextSummary) => {
        if (!cancelled) setSummary(nextSummary);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSummary(null);
          setError(err instanceof Error ? err.message : "Could not load practice progress.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshToken]);

  return { summary, isLoading, error };
}
