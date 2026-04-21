"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectSummaries } from "@/hooks/use-project-summaries";

function formatDate(iso?: string) {
  if (!iso) {
    return "Unknown";
  }

  const [year, month, day] = iso.split("T")[0].split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return `${months[Number(month) - 1]} ${Number(day)}, ${year}`;
}

export function RecentActivity() {
  const { summaries, isLoading, error } = useProjectSummaries();

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Loading activity...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const activities = [...summaries]
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt))
    .slice(0, 4)
    .map((summary) => {
      let detail = "Project created";

      if (summary.reviewer.status === "stale") {
        detail = "Reviewer needs refresh";
      } else if (summary.reviewer.status === "ready") {
        detail = "Reviewer ready";
      } else if (summary.sourceCount > 0) {
        detail = `${summary.sourceCount} source${summary.sourceCount === 1 ? "" : "s"} added`;
      }

      return {
        id: summary.project.id,
        title: summary.project.title,
        detail,
        time: formatDate(summary.activityAt),
      };
    });

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center justify-between rounded-2xl border bg-slate-50 p-4"
            >
              <div>
                <p className="font-medium text-slate-900">{activity.title}</p>
                <p className="text-sm text-slate-500">{activity.detail}</p>
              </div>
              <p className="text-sm text-slate-400">{activity.time}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No recent activity yet.</p>
        )}
      </CardContent>
    </Card>
  );
}