import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types/project";

export function ProjectHeader({
  project,
  sourceCount,
}: {
  project: Project;
  sourceCount: number;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-6 shadow-sm lg:flex-row lg:items-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          {project.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
            {project.project_type}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
            {project.age_bracket.replace("-", " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
            {project.learning_mode.replace("-", " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {project.field_of_study}
          </span>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">
            {sourceCount} source{sourceCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/projects/${project.id}/sources`}>Manage Sources</Link>
        </Button>
        <Button asChild>
          <Link href={`/projects/${project.id}/reviewer`}>Open Reviewer</Link>
        </Button>
      </div>
    </div>
  );
}