import { useEffect, useState } from "react";
import { listPreparationReminders, type PreparationReminder } from "@/lib/coursekin-api";

export function usePreparationReminders() {
  const [reminders, setReminders] = useState<PreparationReminder[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listPreparationReminders()
      .then((result) => {
        if (!cancelled) {
          setReminders(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReminders([]);
          setTotal(0);
          setError(err instanceof Error ? err.message : "Failed to load preparation reminders.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { reminders, total, isLoading, error };
}
