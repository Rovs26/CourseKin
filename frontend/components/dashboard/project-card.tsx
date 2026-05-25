"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ProjectSummary } from "@/lib/reviewflow-api";
import { cn } from "@/lib/utils";

const reviewerStatusStyles = {
  ready: "bg-emerald-100 text-emerald-700",
  stale: "bg-amber-100 text-amber-700",
  "not-ready": "bg-slate-100 text-slate-700",
  failed: "bg-rose-100 text-rose-700",
};

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

export function ProjectCard({ summary }: { summary: ProjectSummary }) {
  const { project } = summary;

  return (
    <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-slate-200/70">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg text-slate-900">
              {project.title}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Updated {formatDate(project.updated_at ?? project.created_at)}
            </p>
          </div>

          <Badge
            variant="secondary"
            className="border-0 bg-slate-100 capitalize text-slate-700"
          >
            {project.learning_mode.replace("-", " ")}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
              reviewerStatusStyles[summary.reviewer_status]
            )}
          >
            {summary.reviewer_status.replace("-", " ")}
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {summary.source_count} source{summary.source_count === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">Reviewer coverage</span>
            <span className="font-medium text-slate-900">
              {summary.reviewer_coverage_percent}%
            </span>
          </div>
          <Progress value={summary.reviewer_coverage_percent} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 capitalize text-slate-600">
            {project.project_type}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 capitalize text-slate-600">
            {project.age_bracket.replace("-", " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {project.field_of_study}
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          Open Project
          <ArrowRight className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}
