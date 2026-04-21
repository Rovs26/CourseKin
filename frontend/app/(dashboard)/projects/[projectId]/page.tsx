"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { useProject } from "@/hooks/use-project";
import { useReviewer } from "@/hooks/use-reviewer";
import { useSources } from "@/hooks/use-sources";

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);
  const { sources, isLoading: isSourcesLoading, error: sourcesError } = useSources(projectId);
  const { reviewer, isLoading: isReviewerLoading, error: reviewerError } = useReviewer(projectId);

  const isLoading = isProjectLoading || isSourcesLoading || isReviewerLoading;
  const error = projectError ?? sourcesError ?? reviewerError;

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading project overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load project overview"
        description={error}
      />
    );
  }

  if (!project || !reviewer) {
    return (
      <EmptyState
        title="Project not found"
        description="This project does not exist in the current workspace."
      />
    );
  }

  const counts = {
    total: sources.length,
    processed: sources.filter((s) => s.status === "processed").length,
    processing: sources.filter((s) => s.status === "processing").length,
    uploaded: sources.filter((s) => s.status === "uploaded").length,
    failed: sources.filter((s) => s.status === "failed").length,
  };

  const coverage = [
    {
      label: "Summary",
      value:
        reviewer.status === "stale"
          ? "Stale"
          : reviewer.content_json?.summary
          ? "Ready"
          : "Empty",
    },
    {
      label: "Key Points",
      value: `${reviewer.content_json?.key_points.length ?? 0} items`,
    },
    {
      label: "Definitions",
      value: `${reviewer.content_json?.definitions.length ?? 0} items`,
    },
    {
      label: "Q&A",
      value: `${reviewer.content_json?.qa.length ?? 0} items`,
    },
    {
      label: "Quiz",
      value: `${reviewer.content_json?.quiz.length ?? 0} items`,
    },
    {
      label: "Flashcards",
      value: `${reviewer.content_json?.flashcards.length ?? 0} items`,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Project Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Type</p>
            <p className="mt-1 font-semibold capitalize text-slate-900">
              {project.project_type}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Age Bracket</p>
            <p className="mt-1 font-semibold capitalize text-slate-900">
              {project.age_bracket.replace("-", " ")}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Learning Mode</p>
            <p className="mt-1 font-semibold capitalize text-slate-900">
              {project.learning_mode.replace("-", " ")}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Field</p>
            <p className="mt-1 font-semibold text-slate-900">{project.field_of_study}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
            <p className="text-sm text-slate-500">Source Mode</p>
            <p className="mt-1 font-semibold capitalize text-slate-900">
              {project.source_mode.replace("-", " ")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Source Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Total Sources</span>
            <span className="font-medium text-slate-900">{counts.total}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Processed</span>
            <span className="font-medium text-emerald-700">{counts.processed}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Processing</span>
            <span className="font-medium text-amber-700">{counts.processing}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Uploaded</span>
            <span className="font-medium text-slate-700">{counts.uploaded}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Failed</span>
            <span className="font-medium text-rose-700">{counts.failed}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Reviewer Coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {coverage.map((item) => (
            <div key={item.label} className="rounded-2xl border bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-1 font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild>
            <Link href={`/projects/${project.id}/reviewer`}>Open Reviewer</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Link href={`/projects/${project.id}/sources`}>Manage Sources</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Link href={`/projects/${project.id}/settings`}>Open Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}