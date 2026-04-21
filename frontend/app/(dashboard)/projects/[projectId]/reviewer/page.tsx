"use client";

import { useParams } from "next/navigation";
import { ReviewerWorkspace } from "@/features/reviewer/reviewer-workspace";

export default function ReviewerPage() {
  const params = useParams<{ projectId: string }>();
  return <ReviewerWorkspace projectId={params.projectId} />;
}