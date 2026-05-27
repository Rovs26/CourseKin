import { CourseStreamWorkspace } from "@/features/stream/course-stream-workspace";

export default async function ProjectStreamPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <CourseStreamWorkspace projectId={projectId} />;
}
