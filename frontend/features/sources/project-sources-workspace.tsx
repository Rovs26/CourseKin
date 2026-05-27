"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { EmptyState } from "@/components/states/empty-state";
import { SourceUploadPanel } from "@/components/sources/source-upload-panel";
import { SourceList } from "@/components/sources/source-list";
import { createTextSource, presignAndUploadPDF, createURLSource } from "@/lib/coursekin-api";
import { useProject } from "@/hooks/use-project";
import { useSources } from "@/hooks/use-sources";
import { routes } from "@/lib/routes";
import type { SourcePurpose } from "@/types/source";

export function ProjectSourcesWorkspace({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
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
  const defaultPurpose: SourcePurpose =
    searchParams.get("add") === "syllabus" ? "syllabus" : "study_material";

  const isLoading = isProjectLoading || isSourcesLoading;

  const handleAddText = async (text: string, purpose: SourcePurpose) => {
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
        purpose,
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

  const handleAddPdf = async (file: File, purpose: SourcePurpose) => {
    if (!project || isSubmittingPdf) {
      return;
    }

    setSubmitError(null);
    setIsSubmittingPdf(true);
    setPdfUploadPct(0);

    // Derive a title from the filename (strip extension)
    const title = file.name.replace(/\.pdf$/i, "").trim() || file.name;

    try {
      await presignAndUploadPDF(projectId, file, title, purpose, (pct) => {
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

  const handleAddUrl = async (url: string, purpose: SourcePurpose) => {
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
        purpose,
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
        <p className="text-sm text-slate-500">Loading materials...</p>
      </div>
    );
  }

  if (projectError || sourcesError) {
    return (
      <EmptyState
        title="Unable to load materials"
        description={projectError ?? sourcesError ?? "Something went wrong."}
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

  const isSubmitting = isSubmittingText || isSubmittingPdf || isSubmittingUrl;
  const syllabusMaterials = sources.filter((source) => source.purpose === "syllabus");
  const readySyllabi = syllabusMaterials.filter((source) => source.status === "processed");
  const hasPendingSyllabus = syllabusMaterials.some(
    (source) => source.status === "uploaded" || source.status === "processing"
  );
  const submittingLabel = isSubmittingPdf
    ? pdfUploadPct !== null && pdfUploadPct < 100
      ? `Uploading PDF… ${pdfUploadPct}%`
      : "Extracting text from PDF…"
    : isSubmittingUrl
    ? "Fetching URL..."
    : "Adding pasted text...";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ck-primary)]">
          Materials
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Bring in what this course is based on.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Begin with a syllabus to plan dates, then add notes, readings, and assignment briefs
          for cited help and your study notebook.
        </p>
      </div>

      <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)]">
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex gap-3">
            <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--ck-primary)]" />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {readySyllabi.length > 0
                  ? "Your syllabus is ready for planning"
                  : hasPendingSyllabus
                    ? "Your syllabus is being processed"
                    : "Start with the syllabus"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {readySyllabi.length > 0
                  ? "Open Plan to extract proposed assessments and review every date before it is used."
                  : hasPendingSyllabus
                    ? "When processing finishes, you can extract proposed dates in Plan."
                    : "Classify a PDF, URL, or pasted text as Course syllabus to begin semester planning."}
              </p>
            </div>
          </div>
          {readySyllabi.length > 0 && (
            <Button asChild className="shrink-0">
              <Link href={routes.coursePlan(projectId)}>
                Open Plan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-3">
        <SourceUploadPanel
          key={defaultPurpose}
          defaultPurpose={defaultPurpose}
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
              <div className="space-y-2">
                <p className="text-sm text-red-600">{submitError}</p>
                {submitError.includes("secure file storage") && (
                  <p className="text-sm text-slate-600">
                    For now, choose the Text tab and paste your syllabus content so you can test
                    date extraction while storage upload access is configured.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Course materials</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {sources.length}
          </span>
        </div>

        <div className="mt-4">
          {sources.length > 0 ? (
            <SourceList sources={sources} onSourceDeleted={refetchSources} allowPurposeEditing />
          ) : (
            <EmptyState
              title="No materials yet"
              description="Add a syllabus, PDF, note, or URL to begin this course."
            />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
