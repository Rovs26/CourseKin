"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ReviewerTabs,
  type ReviewerSectionKey,
} from "@/components/reviewer/reviewer-tabs";
import { SourceList } from "@/components/sources/source-list";
import { RightPanel } from "@/components/layout/right-panel";
import { PracticeSummary } from "@/components/reviewer/practice-summary";
import { EmptyState } from "@/components/states/empty-state";
import {
  GenerationOptionsPanel,
  MultiSourcePanel,
  type GenerationOptions,
  type SectionOwnership,
} from "@/components/reviewer/generation-options-panel";
import {
  generateReviewerJob,
  getJob,
  batchGenerateReviewer,
  type JobStage,
  type ReviewerSectionId,
  type SourceGenerationConfig,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";
import { useProject } from "@/hooks/use-project";
import { useReviewer } from "@/hooks/use-reviewer";
import { useSources } from "@/hooks/use-sources";
import { getTemplateConfig } from "@/lib/templates";
import type { Source } from "@/types/source";

type GenerationMode = "full" | "section" | null;
type OptionsView = "single" | "multi" | null;

function formatLabel(value: string) {
  return value.replace("-", " ").replace("_", " ");
}

/** Build section ownership map: section_id -> source title(s).
 *  _meta.sources values can be a string (legacy) or list of strings (multi-source). */
function buildSectionOwnership(
  reviewerContent: Record<string, unknown> | null,
  sources: Source[]
): SectionOwnership {
  if (!reviewerContent) return {};

  const meta = reviewerContent._meta as
    | { sources?: Record<string, string | string[]> }
    | undefined;
  if (!meta?.sources) return {};

  const sourceMap = new Map(sources.map((s) => [s.id, s.title]));
  const ownership: SectionOwnership = {};

  for (const [section, sourceIds] of Object.entries(meta.sources)) {
    const ids = Array.isArray(sourceIds) ? sourceIds : [sourceIds];
    const titles = ids.map((id) => sourceMap.get(id)).filter(Boolean) as string[];
    if (titles.length > 0) {
      ownership[section as ReviewerSectionId] = titles.join(", ");
    }
  }

  return ownership;
}

export function ReviewerWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);
  const {
    sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
  } = useSources(projectId);
  const {
    reviewer,
    isLoading: isReviewerLoading,
    error: reviewerError,
    refetch: refetchReviewer,
  } = useReviewer(projectId);

  const [generationMode, setGenerationMode] = useState<GenerationMode>(null);
  const [activeSection, setActiveSection] = useState<ReviewerSectionKey | null>(null);
  const [currentStage, setCurrentStage] = useState<
    Exclude<JobStage, "failed"> | null
  >(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [pendingJobIds, setPendingJobIds] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [optionsView, setOptionsView] = useState<OptionsView>(null);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [practiceRefreshToken, setPracticeRefreshToken] = useState(0);

  const templateConfig = getTemplateConfig(project?.template_id);
  const isLoading = isProjectLoading || isSourcesLoading || isReviewerLoading;
  const canGenerate = sources.some((s) => s.status === "processed");
  const isGenerating = currentJobId !== null;
  const reviewerContent = reviewer?.content_json ?? null;
  const reviewerStatus = reviewer?.status ?? "not-ready";
  const isReviewerVisible =
    reviewerStatus !== "not-ready" &&
    reviewerStatus !== "failed" &&
    Boolean(reviewerContent);

  const sectionOwnership = buildSectionOwnership(
    reviewerContent as Record<string, unknown> | null,
    sources
  );

  // Poll current job
  useEffect(() => {
    if (!currentJobId) return;

    let isCancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const job = await getJob(currentJobId);
        if (isCancelled) return;

        if (job.stage !== "failed") {
          setCurrentStage(job.stage);
        }

        if (job.status === "completed") {
          // Check if there are more pending batch jobs
          if (pendingJobIds.length > 0) {
            const [nextId, ...rest] = pendingJobIds;
            setBatchProgress((prev) =>
              prev ? { ...prev, done: prev.done + 1 } : null
            );
            setPendingJobIds(rest);
            setCurrentJobId(nextId);
            return;
          }

          await Promise.all([refetchSources(), refetchReviewer()]);

          if (!isCancelled) {
            setCurrentStage("completed");
            setCurrentJobId(null);
            setPendingJobIds([]);
            setBatchProgress(null);
            setGenerationMode(null);
            setJobError(null);
          }
          return;
        }

        if (job.status === "failed") {
          if (!isCancelled) {
            setCurrentJobId(null);
            setPendingJobIds([]);
            setBatchProgress(null);
            setGenerationMode(null);
            setCurrentStage(null);
            setJobError(job.error_message ?? "Job failed.");
          }
          return;
        }

        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        if (!isCancelled) {
          setCurrentJobId(null);
          setPendingJobIds([]);
          setBatchProgress(null);
          setGenerationMode(null);
          setCurrentStage(null);
          setJobError(
            err instanceof Error ? err.message : "Failed to poll job."
          );
        }
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [currentJobId, pendingJobIds, refetchReviewer, refetchSources]);

  // Single source: open options panel for one source
  const handleShowSingleSource = (source: Source) => {
    setSelectedSource(source);
    setOptionsView("single");
    setJobError(null);
  };

  // Multi-source: open multi-source panel
  const handleShowMultiSource = () => {
    setOptionsView("multi");
    setJobError(null);
  };

  // Single-source generate — uses batch endpoint when reviewer exists to avoid race conditions
  const handleGenerate = async (options: GenerationOptions) => {
    const sourceId = selectedSource?.id;
    if (!canGenerate || isGenerating || !sourceId) return;

    setOptionsView(null);
    setJobError(null);
    setGenerationMode("full");
    setActiveSection(null);

    try {
      if (isReviewerVisible) {
        // Use batch endpoint even for single source — prevents race conditions
        const result = await batchGenerateReviewer({
          project_id: projectId,
          sources: [{
            source_id: sourceId,
            sections: options.sections,
            counts: options.counts,
            merge_mode: options.merge_mode,
          }],
          turnstile_token: options.turnstile_token,
        });
        const [firstId, ...rest] = result.job_ids;
        setBatchProgress({ done: 0, total: result.total_sources });
        setPendingJobIds(rest);
        setCurrentStage("generating");
        setCurrentJobId(firstId);
      } else {
        const job = await generateReviewerJob({
          project_id: projectId,
          source_id: sourceId,
          job_type: "generate-reviewer",
          sections: options.sections,
          counts: options.counts,
          merge_mode: options.merge_mode,
          turnstile_token: options.turnstile_token,
        });
        setCurrentStage(job.stage === "failed" ? null : (job.stage as Exclude<JobStage, "failed">));
        setCurrentJobId(job.id);
      }
    } catch (err) {
      setGenerationMode(null);
      setCurrentStage(null);
      setJobError(
        err instanceof Error ? err.message : "Failed to start building the notebook."
      );
    }
  };

  // Multi-source batch generate
  const handleBatchGenerate = async (configs: SourceGenerationConfig[], turnstileToken?: string) => {
    if (!canGenerate || isGenerating || configs.length === 0) return;

    setOptionsView(null);
    setJobError(null);
    setGenerationMode("full");
    setActiveSection(null);

    try {
      const result = await batchGenerateReviewer({
        project_id: projectId,
        sources: configs,
        turnstile_token: turnstileToken,
      });

      const [firstId, ...rest] = result.job_ids;
      setBatchProgress({ done: 0, total: result.total_sources });
      setPendingJobIds(rest);
      setCurrentStage("generating");
      setCurrentJobId(firstId);
    } catch (err) {
      setGenerationMode(null);
      setCurrentStage(null);
      setBatchProgress(null);
      setJobError(
        err instanceof Error ? err.message : "Failed to start building the notebook."
      );
    }
  };

  const handleExportReviewer = () => {
    if (!project || !reviewer || !reviewerContent) return;
    router.push(routes.projectExport(projectId));
  };

  const stageTitle =
    currentStage === "completed"
      ? activeSection
        ? "Section updated"
        : "Notebook ready"
      : currentStage
      ? batchProgress
        ? `Material ${batchProgress.done + 1}/${batchProgress.total}: ${formatLabel(currentStage)}...`
        : `${formatLabel(currentStage)}...`
      : null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading notebook...</p>
      </div>
    );
  }

  if (projectError || sourcesError || reviewerError) {
    return (
      <EmptyState
        title="Unable to load notebook"
        description={
          projectError ??
          sourcesError ??
          reviewerError ??
          "Something went wrong."
        }
      />
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Course not found"
        description="This course does not exist in your workspace."
      />
    );
  }

  const processedCount = sources.filter((s) => s.status === "processed").length;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] shadow-sm">
        <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <BookOpenCheck className="mt-1 h-7 w-7 shrink-0 text-[var(--ck-primary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--ck-ink)]">Notebook</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--ck-ink)]">
                Build study material you can trace back to class.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-700">
                Choose processed materials to create cited summaries, questions, quizzes, and
                flashcards. Notes and questions saved in Room remain there unless you deliberately
                use their linked materials here.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={routes.courseRoom(projectId)}>Open Room</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={routes.courseMaterials(projectId)}>
                Add material
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <Card className="h-fit rounded-2xl shadow-sm">
        <CardContent className="space-y-6 p-4">
          {templateConfig && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Template
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-900">
                {templateConfig.name}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Materials
              </h2>
              {processedCount >= 2 && (
                <button
                  onClick={handleShowMultiSource}
                  disabled={isGenerating}
                  className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-40"
                >
                  Combine
                </button>
              )}
            </div>
            <div className="mt-3">
              <SourceList
                sources={sources}
                onGenerateFromSource={handleShowSingleSource}
                onSourceDeleted={refetchSources}
                isGenerating={isGenerating}
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Sections
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {(
                [
                  { key: "summary" as const, label: "Summary" },
                  { key: "key_points" as const, label: "Key Points" },
                  { key: "definitions" as const, label: "Definitions" },
                  { key: "qa" as const, label: "Q&A" },
                  { key: "quiz" as const, label: "Quiz" },
                  { key: "flashcards" as const, label: "Flashcards" },
                ] as const
              ).map((section) => {
                const owner = sectionOwnership[section.key];
                return (
                  <div
                    key={section.key}
                    className="rounded-xl bg-slate-50 px-3 py-2 font-medium text-slate-700"
                  >
                    <span>{section.label}</span>
                    {owner && (
                      <span className="ml-2 text-[10px] font-normal text-slate-400">
                        from {owner}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {/* Single-source options */}
        {optionsView === "single" && selectedSource && (
          <GenerationOptionsPanel
            onGenerate={handleGenerate}
            onCancel={() => {
              setOptionsView(null);
              setSelectedSource(null);
            }}
            isRegenerating={isReviewerVisible}
            defaultSections={templateConfig?.sections}
            defaultCounts={templateConfig?.counts}
            sourceName={selectedSource.title}
            sectionOwnership={isReviewerVisible ? sectionOwnership : undefined}
          />
        )}

        {/* Multi-source options */}
        {optionsView === "multi" && (
          <MultiSourcePanel
            sources={sources}
            onBatchGenerate={handleBatchGenerate}
            onCancel={() => setOptionsView(null)}
            defaultSections={templateConfig?.sections}
            defaultCounts={templateConfig?.counts}
            sectionOwnership={isReviewerVisible ? sectionOwnership : undefined}
          />
        )}

        {stageTitle && !optionsView && (
          <Card className="rounded-2xl border-slate-200 bg-slate-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900">
                {stageTitle}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                {batchProgress
                  ? `Processing material ${batchProgress.done + 1} of ${batchProgress.total}`
                  : generationMode === "section"
                  ? "Updating selected sections"
                  : "Building your notebook"}
              </p>
              {batchProgress && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all"
                    style={{
                      width: `${((batchProgress.done + 0.5) / batchProgress.total) * 100}%`,
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {jobError && !optionsView && (
          <Card className="rounded-2xl border-red-200 bg-red-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-red-900">
                Job failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-800">{jobError}</p>
            </CardContent>
          </Card>
        )}

        {reviewerStatus === "stale" && reviewerContent && !isGenerating && !optionsView && (
          <Card className="rounded-2xl border-amber-200 bg-amber-50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900">
                Notebook needs an update
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800">
                New material was added. Update the notebook to include it.
              </p>
            </CardContent>
          </Card>
        )}

        {isReviewerVisible && reviewerContent && !optionsView && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleExportReviewer}
              disabled={isGenerating}
            >
              Export Notebook
            </Button>
          </div>
        )}

        {isReviewerVisible && (reviewerContent?.quiz?.length ?? 0) > 0 && !optionsView && (
          <PracticeSummary projectId={projectId} refreshToken={practiceRefreshToken} />
        )}

        {!optionsView && (
          isReviewerVisible && reviewerContent ? (
            <ReviewerTabs
              content={reviewerContent}
              projectId={projectId}
              reviewerVersion={reviewer!.version}
              onRegenerateSection={() => handleShowMultiSource()}
              isRegeneratingSection={generationMode === "section" && isGenerating}
              onQuizAttemptSaved={() => setPracticeRefreshToken((value) => value + 1)}
            />
          ) : (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-6">
                <EmptyState
                  title="Notebook not started"
                  description="Choose course material to build a cited study notebook."
                />
                {processedCount >= 2 ? (
                  <Button
                    onClick={handleShowMultiSource}
                    disabled={!canGenerate || isGenerating}
                    className="w-full rounded-xl"
                  >
                    {!canGenerate
                      ? "Add Materials First"
                      : isGenerating
                      ? "Building..."
                      : "Build from Multiple Materials"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const firstProcessed = sources.find((s) => s.status === "processed");
                      if (firstProcessed) handleShowSingleSource(firstProcessed);
                    }}
                    disabled={!canGenerate || isGenerating}
                    className="w-full rounded-xl"
                  >
                    {!canGenerate
                      ? "Add Materials First"
                      : isGenerating
                      ? "Building..."
                      : "Build Notebook"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>

      <RightPanel
        project={project}
        onGenerateReviewer={
          processedCount >= 2
            ? handleShowMultiSource
            : () => {
                const firstProcessed = sources.find((s) => s.status === "processed");
                if (firstProcessed) handleShowSingleSource(firstProcessed);
              }
        }
        onExportReviewer={handleExportReviewer}
        canGenerate={canGenerate}
        isGenerating={isGenerating}
        currentStage={currentStage}
        hasReviewer={Boolean(reviewerContent)}
      />
      </div>
    </div>
  );
}
