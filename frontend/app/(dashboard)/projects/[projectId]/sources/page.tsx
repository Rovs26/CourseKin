"use client";

import { useParams } from "next/navigation";
import { ProjectSourcesWorkspace } from "@/features/sources/project-sources-workspace";

export default function ProjectSourcesPage() {
  const params = useParams<{ projectId: string }>();
  return <ProjectSourcesWorkspace projectId={params.projectId} />;
}