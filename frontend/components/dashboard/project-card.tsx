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
import type { ProjectSummary } from "@/lib/coursekin-api";
import { courseVisual } from "@/lib/course-visuals";
import { cn } from "@/lib/utils";

const reviewerStatusStyles = {
  ready: "bg-emerald-100 text-emerald-700",
  stale: "bg-amber-100 text-amber-700",
  "not-ready": "bg-slate-100 text-slate-700",
  failed: "bg-rose-100 text-rose-700",
};

const reviewerStatusLabels = {
  ready: "Notebook ready",
  stale: "Notebook needs update",
  "not-ready": "Start notebook",
  failed: "Needs attention",
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
  const { Icon, tile } = courseVisual(project.field_of_study, project.title);

  return (
    <Card className="group rounded-3xl border-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-16px_rgba(15,23,42,0.28)]">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl",
                tile
              )}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg text-slate-900">
                {project.title}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Updated {formatDate(project.updated_at ?? project.created_at)}
              </p>
            </div>
          </div>

          {project.course_code && (
            <Badge variant="secondary" className="border-0 bg-slate-100 text-slate-700">
              {project.course_code}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              reviewerStatusStyles[summary.reviewer_status]
            )}
          >
            {reviewerStatusLabels[summary.reviewer_status]}
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {summary.source_count} source{summary.source_count === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">Notebook coverage</span>
            <span className="font-medium text-slate-900">
              {summary.reviewer_coverage_percent}%
            </span>
          </div>
          <Progress value={summary.reviewer_coverage_percent} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {project.term && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              {project.term}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            {project.field_of_study}
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <Link
          href={`/projects/${project.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ck-primary)] transition-colors hover:text-[var(--ck-primary-hover)]"
        >
          Open Course
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
