import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import type { Project } from "@/types/project";

export function ProjectHeader({
  project,
  sourceCount,
}: {
  project: Project;
  sourceCount: number;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-6 lg:flex-row lg:items-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {project.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
          {project.course_code && (
            <span className="rounded-full bg-[var(--ck-primary-soft)] px-3 py-1 font-medium text-[var(--ck-primary)]">
              {project.course_code}
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {project.field_of_study}
          </span>
          {project.term && (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {project.term}
            </span>
          )}
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
            {sourceCount} material{sourceCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={routes.courseRoom(project.id)}>Open Room</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.coursePlan(project.id)}>Plan</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.courseMaterials(project.id)}>Add Material</Link>
        </Button>
        <Button asChild>
          <Link href={routes.courseNotebook(project.id)}>Open Notebook</Link>
        </Button>
      </div>
    </div>
  );
}
