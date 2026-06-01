"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";
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
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
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

  const showWhatsNext = counts.total === 0;

  return (
    <div className="space-y-6">
      <OnboardingTour />
      {showWhatsNext ? (
        <Card className="rounded-3xl border border-white/50 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ck-primary)]" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  What&apos;s next: bring in your syllabus
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Add the syllabus PDF or paste text. We extract dates and topics so Plan can build your term.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href={`${routes.courseMaterials(project.id)}?add=syllabus&firstRun=1`}>
                Add syllabus
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
    </div>
  );
}
