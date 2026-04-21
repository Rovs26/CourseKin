"use client";

import { useMemo } from "react";
import { useReviewer } from "@/hooks/use-reviewer";
import { useSources } from "@/hooks/use-sources";
import type { ReviewerOutput } from "@/types/reviewer";

function createDefaultReviewer(projectId: string): ReviewerOutput {
  return {
    project_id: projectId,
    source_id: null,
    status: "not-ready",
    output_type: "full-reviewer",
    version: 1,
    content_json: null,
  };
}

function getCoveragePercent(
  content: ReviewerOutput["content_json"] | null | undefined
) {
  if (!content) {
    return 0;
  }

  const filledSections = [
    Boolean(content.summary),
    content.key_points.length > 0,
    content.definitions.length > 0,
    content.qa.length > 0,
    content.quiz.length > 0,
    content.flashcards.length > 0,
  ].filter(Boolean).length;

  return Math.round((filledSections / 6) * 100);
}

export function useProjectSummary(projectId: string) {
  const {
    sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
  } = useSources(projectId);

  const {
    reviewer,
    isLoading: isReviewerLoading,
    error: reviewerError,
  } = useReviewer(projectId);

  const safeReviewer = useMemo(
    () => reviewer ?? createDefaultReviewer(projectId),
    [projectId, reviewer]
  );

  return {
    sources,
    sourceCount: sources.length,
    reviewer: safeReviewer,
    coveragePercent: getCoveragePercent(safeReviewer.content_json),
    isLoading: isSourcesLoading || isReviewerLoading,
    error: sourcesError ?? reviewerError,
  };
}