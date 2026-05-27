"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/dashboard/project-card";
import { EmptyState } from "@/components/states/empty-state";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

export default function ProjectsPage() {
  const { summaries, isLoading, error } = useProjectSummaries();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Courses
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep each class, its materials, its deadlines, and its study notebook together.
          </p>
        </div>

        <Button asChild className="rounded-xl">
          <Link href={routes.newCourse}>Add Course</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading courses...</p>
      ) : error ? (
        <EmptyState title="Unable to load courses" description={error} />
      ) : summaries.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <ProjectCard key={summary.project.id} summary={summary} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No courses yet"
          description="Add a course, then upload a syllabus or class material to begin."
        />
      )}
    </div>
  );
}
