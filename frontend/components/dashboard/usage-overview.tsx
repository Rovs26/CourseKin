"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useProjectSummaries } from "@/hooks/use-project-summaries";

export function UsageOverview() {
  const { projects, summaries, isLoading, error } = useProjectSummaries();

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Loading usage...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Usage Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const totalProjects = projects.length;
  const projectCap = 30;
  const usagePercent = Math.min(100, Math.round((totalProjects / projectCap) * 100));

  const allSources = summaries.flatMap((summary) => summary.sources);
  const processedSources = allSources.filter(
    (source) => source.status === "processed"
  ).length;

  const readyReviewers = summaries.filter(
    (summary) => summary.reviewer.status === "ready"
  ).length;

  const staleReviewers = summaries.filter(
    (summary) => summary.reviewer.status === "stale"
  ).length;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">Usage Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-semibold text-slate-900">
              {totalProjects}
            </span>
            <span className="pb-1 text-slate-500">/ {projectCap} projects</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Live workspace usage snapshot
          </p>
        </div>

        <Progress value={usagePercent} className="h-3" />

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Sources</p>
            <p className="mt-1 font-semibold text-slate-900">{allSources.length}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Processed</p>
            <p className="mt-1 font-semibold text-slate-900">{processedSources}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Ready</p>
            <p className="mt-1 font-semibold text-slate-900">{readyReviewers}</p>
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
          {staleReviewers} stale reviewer{staleReviewers === 1 ? "" : "s"} need refresh
        </div>
      </CardContent>
    </Card>
  );
}