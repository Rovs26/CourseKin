import { ExamListWorkspace } from "@/features/exams/exam-list-workspace";

export default async function ProjectExamsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ExamListWorkspace projectId={projectId} />;
}
