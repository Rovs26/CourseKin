"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/states/empty-state";
import { TurnstileWidget } from "@/components/reviewer/turnstile-widget";
import { useProject } from "@/hooks/use-project";
import { useSources } from "@/hooks/use-sources";
import { useObligations } from "@/hooks/use-obligations";
import {
  downloadConfirmedCalendar,
  extractSyllabusObligations,
  getJob,
  reviewCourseObligation,
  type CourseObligation,
  type ObligationType,
} from "@/lib/coursekin-api";

const OBLIGATION_LABELS: Record<ObligationType, string> = {
  quiz: "Quiz",
  exam: "Exam",
  assignment: "Assignment",
  project: "Project",
  paper: "Short paper",
  reading: "Reading",
  other: "Other",
};

function ObligationEditor({
  item,
  onSaved,
}: {
  item: CourseObligation;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [type, setType] = useState<ObligationType>(item.obligation_type);
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [details, setDetails] = useState(item.details ?? "");
  const [criteria, setCriteria] = useState(item.grading_criteria ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (status: "confirmed" | "dismissed") => {
    setSaving(true);
    setError(null);
    try {
      await reviewCourseObligation(item.project_id, item.id, {
        title,
        obligation_type: type,
        due_date: dueDate || null,
        details: details || null,
        grading_criteria: criteria || null,
        status,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[var(--ck-primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--ck-primary)]">
            {item.status === "proposed" ? "Needs your review" : "Confirmed"}
          </span>
          <span className="text-xs capitalize text-slate-500">
            AI confidence: {item.confidence}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Task or assessment</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as ObligationType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(OBLIGATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Details</Label>
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              className="min-h-[72px]"
            />
          </div>
          {criteria && (
            <div className="space-y-2 md:col-span-2">
              <Label>Criteria or grading notes</Label>
              <Textarea
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                className="min-h-[72px]"
              />
            </div>
          )}
        </div>

        {item.uncertain_fields.length > 0 && item.status === "proposed" && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            Please verify: {item.uncertain_fields.join(", ")}.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save("confirmed")} disabled={saving || !title.trim()}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {item.status === "confirmed" ? "Save Confirmed Item" : "Confirm"}
          </Button>
          <Button variant="outline" onClick={() => save("dismissed")} disabled={saving}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CoursePlanningWorkspace({ projectId }: { projectId: string }) {
  const { project, isLoading: projectLoading, error: projectError } = useProject(projectId);
  const { sources, isLoading: sourcesLoading, error: sourcesError } = useSources(projectId);
  const { obligations, isLoading: obligationsLoading, error: obligationsError, refetch } =
    useObligations(projectId);
  const syllabusSources = sources.filter(
    (source) => source.purpose === "syllabus" && source.status === "processed"
  );
  const [sourceId, setSourceId] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!sourceId && syllabusSources[0]) setSourceId(syllabusSources[0].id);
  }, [sourceId, syllabusSources]);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const job = await getJob(jobId);
        if (cancelled) return;
        if (job.status === "completed") {
          setJobId(null);
          refetch();
          return;
        }
        if (job.status === "failed") {
          setJobId(null);
          setJobError(job.error_message ?? "Syllabus extraction failed.");
          return;
        }
        timer = window.setTimeout(poll, 1500);
      } catch (err) {
        setJobId(null);
        setJobError(err instanceof Error ? err.message : "Could not check extraction.");
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [jobId, refetch]);

  const startExtraction = async () => {
    if (!sourceId || jobId) return;
    setJobError(null);
    try {
      const job = await extractSyllabusObligations(projectId, sourceId, turnstileToken);
      setJobId(job.id);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : "Could not start extraction.");
    }
  };

  const downloadCalendar = async () => {
    setExporting(true);
    try {
      const blob = await downloadConfirmedCalendar(projectId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(project?.course_code || project?.title || "course").replace(/\s+/g, "-")}-deadlines.ics`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setJobError(err instanceof Error ? err.message : "Could not export calendar.");
    } finally {
      setExporting(false);
    }
  };

  if (projectLoading || sourcesLoading || obligationsLoading) {
    return <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading course plan...</p>;
  }
  const error = projectError ?? sourcesError ?? obligationsError;
  if (error || !project) {
    return <EmptyState title="Unable to load planning" description={error ?? "Course not found."} />;
  }

  const visibleItems = obligations.filter((item) => item.status !== "dismissed");
  const confirmedWithDates = obligations.filter(
    (item) => item.status === "confirmed" && item.due_date
  ).length;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--ck-ink)]">Semester planning starts with confirmation</p>
            <p className="mt-1 text-sm text-slate-700">
              CourseKin proposes syllabus tasks. Only items you confirm are included in calendar export.
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 shrink-0 text-[var(--ck-primary)]" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-lg">Syllabus Intake</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {syllabusSources.length === 0 ? (
              <p className="text-sm text-slate-600">
                Add a PDF, URL, or pasted text as <strong>Course syllabus</strong> in Sources first.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Syllabus source</Label>
                  <Select value={sourceId} onValueChange={setSourceId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {syllabusSources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>{source.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TurnstileWidget
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken(undefined)}
                />
                <Button onClick={startExtraction} disabled={!sourceId || Boolean(jobId)} className="w-full">
                  <FileSearch className="mr-2 h-4 w-4" />
                  {jobId ? "Extracting..." : "Extract Proposed Deadlines"}
                </Button>
              </>
            )}
            {jobError && <p className="text-sm text-red-600">{jobError}</p>}
            <Button
              variant="outline"
              onClick={downloadCalendar}
              disabled={!confirmedWithDates || exporting}
              className="w-full"
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : `Export Confirmed Dates (${confirmedWithDates})`}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Obligations and Assessments</h2>
          {visibleItems.length === 0 ? (
            <EmptyState
              title="No proposed obligations yet"
              description="Upload a syllabus and extract proposed deadlines. You will review each item before it enters your plan."
            />
          ) : (
            visibleItems.map((item) => (
              <ObligationEditor key={item.id} item={item} onSaved={refetch} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
