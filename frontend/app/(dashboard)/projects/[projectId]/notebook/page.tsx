import { CourseNotebookWorkspace } from "@/features/notebook/course-notebook-workspace";

export default async function ProjectNotebookPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <CourseNotebookWorkspace projectId={projectId} />;
}
