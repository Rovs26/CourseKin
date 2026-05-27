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
import { routes } from "@/lib/routes";

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
        <p className="text-sm text-slate-500">Loading course overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Unable to load course overview"
        description={error}
      />
    );
  }

  if (!project || !reviewer) {
    return (
      <EmptyState
        title="Course not found"
        description="This course does not exist in your workspace."
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
          <CardTitle className="text-slate-900">Course Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Subject area</p>
            <p className="mt-1 font-semibold text-slate-900">{project.field_of_study}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Course code</p>
            <p className="mt-1 font-semibold text-slate-900">{project.course_code ?? "Not set"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Term</p>
            <p className="mt-1 font-semibold text-slate-900">{project.term ?? "Not set"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Instructor</p>
            <p className="mt-1 font-semibold text-slate-900">{project.instructor ?? "Not set"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
            <p className="text-sm text-slate-500">Class schedule</p>
            <p className="mt-1 font-semibold text-slate-900">{project.meeting_schedule ?? "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span className="text-sm text-slate-500">Total materials</span>
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
          <CardTitle className="text-slate-900">Notebook</CardTitle>
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
            <Link href={routes.coursePlan(project.id)}>Open Plan</Link>
          </Button>
          <Button asChild>
            <Link href={routes.courseNotebook(project.id)}>Open Notebook</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Link href={routes.courseMaterials(project.id)}>Add Material</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <Link href={routes.courseSettings(project.id)}>Course Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
