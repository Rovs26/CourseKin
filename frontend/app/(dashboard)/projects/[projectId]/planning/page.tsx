import { CoursePlanningWorkspace } from "@/features/planning/course-planning-workspace";

export default async function ProjectPlanningPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <CoursePlanningWorkspace projectId={projectId} />;
}
