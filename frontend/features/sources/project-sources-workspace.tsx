"use client";

import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { SourceUploadPanel } from "@/components/sources/source-upload-panel";
import { SourceList } from "@/components/sources/source-list";
import { createTextSource, presignAndUploadPDF, createURLSource } from "@/lib/coursekin-api";
import { useProject } from "@/hooks/use-project";
import { useSources } from "@/hooks/use-sources";

export function ProjectSourcesWorkspace({ projectId }: { projectId: string }) {
  const { project, isLoading: isProjectLoading, error: projectError } = useProject(projectId);
  const {
    sources,
    isLoading: isSourcesLoading,
    error: sourcesError,
    refetch: refetchSources,
  } = useSources(projectId);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const [isSubmittingPdf, setIsSubmittingPdf] = useState(false);
  const [pdfUploadPct, setPdfUploadPct] = useState<number | null>(null);
  const [isSubmittingUrl, setIsSubmittingUrl] = useState(false);

  const isLoading = isProjectLoading || isSourcesLoading;

  const handleAddText = async (text: string) => {
    if (!project || isSubmittingText) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingText(true);

    try {
      const normalizedText = text.trim();
      const title =
        normalizedText.length > 48
          ? `${normalizedText.slice(0, 48).trim()}...`
          : normalizedText;

      await createTextSource({
        project_id: projectId,
        title,
        text: normalizedText,
        content: normalizedText,
      });

      await refetchSources();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to add text source."
      );
    } finally {
      setIsSubmittingText(false);
    }
  };

  const handleAddPdf = async (file: File) => {
    if (!project || isSubmittingPdf) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingPdf(true);
    setPdfUploadPct(0);

    // Derive a title from the filename (strip extension)
    const title = file.name.replace(/\.pdf$/i, "").trim() || file.name;

    try {
      await presignAndUploadPDF(projectId, file, title, (pct) => {
        setPdfUploadPct(pct);
      });
      await refetchSources();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to upload PDF."
      );
    } finally {
      setIsSubmittingPdf(false);
      setPdfUploadPct(null);
    }
  };

  const handleAddUrl = async (url: string) => {
    if (!project || isSubmittingUrl) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingUrl(true);

    try {
      await createURLSource({
        project_id: projectId,
        title: url,
        url,
      });
      await refetchSources();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to add URL source."
      );
    } finally {
      setIsSubmittingUrl(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading sources...</p>
      </div>
    );
  }

  if (projectError || sourcesError) {
    return (
      <EmptyState
        title="Unable to load sources"
        description={projectError ?? sourcesError ?? "Something went wrong."}
      />
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project does not exist in the current workspace."
      />
    );
  }

  const isSubmitting = isSubmittingText || isSubmittingPdf || isSubmittingUrl;
  const submittingLabel = isSubmittingPdf
    ? pdfUploadPct !== null && pdfUploadPct < 100
      ? `Uploading PDF… ${pdfUploadPct}%`
      : "Extracting text from PDF…"
    : isSubmittingUrl
    ? "Fetching URL..."
    : "Adding text source...";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <SourceUploadPanel
          onAddPdf={handleAddPdf}
          onAddUrl={handleAddUrl}
          onAddText={handleAddText}
        />

        {(submitError || isSubmitting) && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            {isSubmitting ? (
              <p className="text-sm text-slate-500">{submittingLabel}</p>
            ) : null}

            {submitError ? (
              <p className="text-sm text-red-600">{submitError}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Current Sources</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {sources.length}
          </span>
        </div>

        <div className="mt-4">
          {sources.length > 0 ? (
            <SourceList sources={sources} />
          ) : (
            <EmptyState
              title="No sources yet"
              description="Add a text source, PDF, or URL to start building this reviewer."
            />
          )}
        </div>
      </div>
    </div>
  );
}
