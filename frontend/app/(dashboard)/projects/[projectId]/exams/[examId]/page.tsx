import { ExamSessionWorkspace } from "@/features/exams/exam-session-workspace";

export default async function ExamSessionPage({
  params,
}: {
  params: Promise<{ projectId: string; examId: string }>;
}) {
  const { projectId, examId } = await params;

  return <ExamSessionWorkspace projectId={projectId} examId={examId} />;
}
