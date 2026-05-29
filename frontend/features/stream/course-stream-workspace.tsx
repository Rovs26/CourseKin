"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookmarkPlus, BookOpenCheck, CheckCircle2, CircleAlert, Lightbulb, MessageCircleQuestion, NotebookPen, Paperclip, ShieldCheck, Sparkles } from "lucide-react";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import { TurnstileWidget } from "@/components/reviewer/turnstile-widget";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCourseStream } from "@/hooks/use-course-stream";
import { useObligations } from "@/hooks/use-obligations";
import { useSources } from "@/hooks/use-sources";
import {
  convertStreamEntryToCard,
  createCourseStreamEntry,
  deleteCourseStreamEntry,
  requestCourseAnswer,
  requestCourseworkCoaching,
  updateCourseConfusionStatus,
  updateCourseStreamEntry,
  type CoachingMode,
  type CourseAnswerMode,
  type CourseStreamEntry,
  type CourseStreamCaptureType,
  type CourseStreamEntryType,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";
import type { Source } from "@/types/source";

const ENTRY_LABELS: Record<CourseStreamEntryType, string> = {
  note: "Note",
  question: "Question",
  reflection: "Reflection",
  coaching: "Coursework guidance",
};

const ANSWER_MODE_LABELS: Record<CourseAnswerMode, string> = {
  standard: "Standard explanation",
  simplified: "Plain language",
  step_by_step: "Step by step",
  example_first: "Example first",
};

const COACHING_MODE_LABELS: Record<CoachingMode, string> = {
  assignment_plan: "Assignment checklist",
  draft_feedback: "Short draft feedback",
  office_hours: "Office-hours preparation",
};

const PURPOSE_LABELS = {
  study_material: "Study material",
  syllabus: "Syllabus",
  lecture_notes: "Lecture notes",
  assignment_brief: "Assignment brief",
} as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MaterialSelector({
  sources,
  selectedSourceIds,
  onChange,
}: {
  sources: Source[];
  selectedSourceIds: string[];
  onChange: (nextIds: string[]) => void;
}) {
  const toggleSource = (sourceId: string) => {
    if (selectedSourceIds.includes(sourceId)) {
      onChange(selectedSourceIds.filter((id) => id !== sourceId));
      return;
    }
    if (selectedSourceIds.length < 10) {
      onChange([...selectedSourceIds, sourceId]);
    }
  };

  return (
    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
      {sources.map((source) => (
        <label
          key={source.id}
          className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50"
        >
          <input
            type="checkbox"
            checked={selectedSourceIds.includes(source.id)}
            onChange={() => toggleSource(source.id)}
            className="mt-0.5 h-4 w-4 accent-[var(--ck-primary)]"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-800">{source.title}</span>
            <span className="text-xs text-slate-500">{PURPOSE_LABELS[source.purpose]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function StreamEntryCard({
  entry,
  projectId,
  sources,
  turnstileToken,
  turnstileReady,
  onSaved,
}: {
  entry: CourseStreamEntry;
  projectId: string;
  sources: Source[];
  turnstileToken?: string;
  turnstileReady: boolean;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [entryType, setEntryType] = useState<CourseStreamCaptureType>(
    entry.entry_type as CourseStreamCaptureType
  );
  const [content, setContent] = useState(entry.content);
  const [linkedSourceIds, setLinkedSourceIds] = useState(
    entry.linked_sources.map((source) => source.id)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingAnswer, setIsRequestingAnswer] = useState(false);
  const [answerMode, setAnswerMode] = useState<CourseAnswerMode>(entry.answer_mode ?? "standard");
  const [error, setError] = useState<string | null>(null);
  const [savingToNotebook, setSavingToNotebook] = useState(false);
  const [savedToNotebook, setSavedToNotebook] = useState(false);

  const saveToNotebook = async () => {
    setSavingToNotebook(true);
    setError(null);
    try {
      await convertStreamEntryToCard(projectId, entry.id);
      setSavedToNotebook(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save to notebook.");
    } finally {
      setSavingToNotebook(false);
    }
  };

  useEffect(() => {
    setAnswerMode(entry.answer_mode ?? "standard");
  }, [entry.answer_mode]);

  const save = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateCourseStreamEntry(projectId, entry.id, {
        entry_type: entryType,
        content,
        linked_source_ids: linkedSourceIds,
      });
      setIsEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this room entry?")) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteCourseStreamEntry(projectId, entry.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete entry.");
      setIsSaving(false);
    }
  };

  const setConfusionStatus = async (status: "open" | "resolved") => {
    setIsSaving(true);
    setError(null);
    try {
      await updateCourseConfusionStatus(projectId, entry.id, status);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update question status.");
    } finally {
      setIsSaving(false);
    }
  };

  const answerFromCourse = async () => {
    setIsRequestingAnswer(true);
    setError(null);
    try {
      await requestCourseAnswer(projectId, entry.id, answerMode, turnstileToken);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare an answer.");
    } finally {
      setIsRequestingAnswer(false);
    }
  };

  const hasProcessedMaterial = entry.linked_sources.some((source) => source.status === "processed");
  const answerInProgress = entry.answer_status === "queued" || entry.answer_status === "generating";

  return (
    <div
      id={`stream-entry-${entry.id}`}
      className={
        entry.entry_type === "question"
          ? "rounded-2xl border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] p-4"
          : entry.entry_type === "reflection"
            ? "rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
            : "rounded-2xl border border-slate-200 bg-white p-4"
      }
    >
      {isEditing ? (
        <div className="space-y-3">
          <Select value={entryType} onValueChange={(value) => setEntryType(value as CourseStreamCaptureType)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="reflection">Reflection</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            maxLength={10000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-[96px]"
          />
          {sources.length > 0 && (
            <div className="space-y-2">
              <Label>Related course materials</Label>
              <MaterialSelector
                sources={sources}
                selectedSourceIds={linkedSourceIds}
                onChange={setLinkedSourceIds}
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={save} disabled={isSaving || !content.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEntryType(entry.entry_type as CourseStreamCaptureType);
                setContent(entry.content);
                setLinkedSourceIds(entry.linked_sources.map((source) => source.id));
                setError(null);
                setIsEditing(false);
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              {entry.entry_type === "question" ? (
                <MessageCircleQuestion className="h-4 w-4 text-[var(--ck-primary)]" />
              ) : entry.entry_type === "reflection" ? (
                <Lightbulb className="h-4 w-4 text-amber-700" />
              ) : (
                <NotebookPen className="h-4 w-4 text-slate-500" />
              )}
              {ENTRY_LABELS[entry.entry_type]}
            </span>
            <time className="text-xs text-slate-500" dateTime={entry.created_at}>
              {formatTimestamp(entry.created_at)}
            </time>
          </div>
          {entry.entry_type === "question" && (
            <span
              className={
                entry.confusion_status === "resolved"
                  ? "mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  : "mt-3 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
              }
            >
              {entry.confusion_status === "resolved" ? "Resolved" : "Open confusion"}
            </span>
          )}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{entry.content}</p>
          {entry.linked_sources.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <BookOpenCheck className="h-3.5 w-3.5" />
                Related course material
              </p>
              <div className="flex flex-wrap gap-2">
                {entry.linked_sources.map((source) => (
                  <span
                    key={source.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    <Paperclip className="h-3 w-3" />
                    {source.title} - {PURPOSE_LABELS[source.purpose]}
                  </span>
                ))}
              </div>
            </div>
          )}
          {entry.entry_type === "question" && entry.answer_status === "answered" && entry.answer_content && (
            <div className="mt-4 rounded-xl border border-[var(--ck-primary-border)] bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--ck-primary)]">
                <Sparkles className="h-3.5 w-3.5" />
                Cited answer from selected materials
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {entry.answer_content}
              </p>
              <EvidenceCitations evidence={entry.answer_evidence ?? undefined} />
              <p className="mt-3 text-xs text-slate-500">
                Style: {ANSWER_MODE_LABELS[entry.answer_mode ?? "standard"]}. Scope: attached
                course materials only. No web sources were used.
              </p>
            </div>
          )}
          {entry.entry_type === "question" && entry.answer_status === "insufficient_evidence" && (
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              The attached course materials do not provide enough cited evidence for a reliable answer.
            </p>
          )}
          {entry.entry_type === "question" && entry.answer_status === "failed" && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Answer generation failed. You can review the linked material and try again.
            </p>
          )}
          {entry.entry_type === "question" && answerInProgress && (
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Preparing a citation-grounded answer from your attached course material...
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.entry_type === "question" && !answerInProgress && (
              <>
                <Select value={answerMode} onValueChange={(value) => setAnswerMode(value as CourseAnswerMode)}>
                  <SelectTrigger className="h-9 w-[175px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANSWER_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={answerFromCourse}
                  disabled={isSaving || isRequestingAnswer || !hasProcessedMaterial || !turnstileReady}
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  {entry.answer_status === "answered" ? "Update cited answer" : "Get cited answer"}
                </Button>
              </>
            )}
            {entry.entry_type === "question" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfusionStatus(entry.confusion_status === "resolved" ? "open" : "resolved")
                }
                disabled={isSaving || answerInProgress}
              >
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                {entry.confusion_status === "resolved" ? "Reopen" : "Mark Resolved"}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={isSaving}>
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={saveToNotebook}
              disabled={isSaving || savingToNotebook || savedToNotebook}
              title="Save this entry as a study card in your Notebook"
            >
              <BookmarkPlus className="mr-2 h-3.5 w-3.5" />
              {savedToNotebook
                ? "In notebook"
                : savingToNotebook
                  ? "Saving..."
                  : "Save to notebook"}
            </Button>
            <Button variant="outline" size="sm" onClick={remove} disabled={isSaving}>
              {isSaving ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CoachingEntryCard({
  entry,
  projectId,
  onSaved,
}: {
  entry: CourseStreamEntry;
  projectId: string;
  onSaved: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const output = entry.coaching_output;
  const obligation = entry.coaching_context?.obligation;
  const inProgress = entry.coaching_status === "queued" || entry.coaching_status === "generating";

  const remove = async () => {
    if (!window.confirm("Delete this coursework guidance request?")) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCourseStreamEntry(projectId, entry.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete guidance request.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          <Sparkles className="h-3.5 w-3.5" />
          {COACHING_MODE_LABELS[entry.coaching_mode ?? "office_hours"]}
        </span>
        <time className="text-xs text-slate-500" dateTime={entry.created_at}>
          {formatTimestamp(entry.created_at)}
        </time>
      </div>
      {obligation && (
        <p className="mt-3 text-xs text-slate-600">
          Confirmed task: <span className="font-medium text-slate-800">{obligation.title}</span>
        </p>
      )}
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{entry.content}</p>
      {entry.linked_sources.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Materials: {entry.linked_sources.map((source) => source.title).join(", ")}
        </p>
      )}
      {inProgress && (
        <p className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-600">
          Preparing citation-grounded guidance from the selected course material...
        </p>
      )}
      {entry.coaching_status === "ready" && output && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Guidance, not a submission
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {output.guidance}
          </p>
          {output.next_steps.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Next steps</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {output.next_steps.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          {output.rubric_checks.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Rubric checks</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {output.rubric_checks.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          {output.questions_for_instructor.length > 0 && (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Questions for your instructor</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {output.questions_for_instructor.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </>
          )}
          <EvidenceCitations evidence={entry.coaching_evidence ?? undefined} />
          <p className="mt-3 text-xs text-slate-500">{output.limitation_note}</p>
          <p className="mt-1 text-xs text-slate-500">Scope: selected course materials only. No web sources were used.</p>
        </div>
      )}
      {entry.coaching_status === "insufficient_evidence" && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          The selected material does not provide enough cited evidence for useful guidance.
        </p>
      )}
      {entry.coaching_status === "failed" && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          This guidance request could not be prepared. Check the selected material and try a new request.
        </p>
      )}
      {!entry.coaching_status && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Linked material was removed. Create a new guidance request with current course evidence.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <Button variant="outline" size="sm" className="mt-4" onClick={remove} disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
}

function CourseworkCoachPanel({
  projectId,
  sources,
  turnstileToken,
  turnstileReady,
  onSubmitted,
}: {
  projectId: string;
  sources: Source[];
  turnstileToken?: string;
  turnstileReady: boolean;
  onSubmitted: () => void;
}) {
  const { obligations } = useObligations(projectId);
  const [mode, setMode] = useState<CoachingMode>("assignment_plan");
  const [obligationId, setObligationId] = useState("");
  const [content, setContent] = useState("");
  const [linkedSourceIds, setLinkedSourceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processedSources = sources.filter((source) => source.status === "processed");
  const confirmedObligations = obligations.filter((item) => item.status === "confirmed");
  const eligibleAssignments = confirmedObligations.filter((item) =>
    ["assignment", "paper", "project"].includes(item.obligation_type)
  );
  const selectedObligation = confirmedObligations.find((item) => item.id === obligationId);
  const assignmentMode = mode !== "office_hours";
  const availableObligations = assignmentMode ? eligibleAssignments : confirmedObligations;
  const rubricReady =
    !assignmentMode ||
    Boolean(selectedObligation?.grading_criteria) ||
    processedSources.some(
      (source) => linkedSourceIds.includes(source.id) && source.purpose === "assignment_brief"
    );
  const canSubmit =
    Boolean(content.trim()) &&
    linkedSourceIds.length > 0 &&
    (!assignmentMode || Boolean(obligationId)) &&
    rubricReady &&
    turnstileReady;

  useEffect(() => {
    if (obligationId && !availableObligations.some((item) => item.id === obligationId)) {
      setObligationId("");
    }
  }, [availableObligations, obligationId]);

  const submit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await requestCourseworkCoaching(projectId, {
        coaching_mode: mode,
        content,
        obligation_id: obligationId || undefined,
        linked_source_ids: linkedSourceIds,
        turnstile_token: turnstileToken,
      });
      setContent("");
      setLinkedSourceIds([]);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare coursework guidance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="h-fit rounded-2xl shadow-sm">
      <CardHeader><CardTitle className="text-lg">Coursework guidance</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
          Guidance for light assignments, short papers, and office hours only. CourseKin will not
          write a final submission, slide deck, thesis-level work, or group paper.
        </p>
        <div className="space-y-2">
          <Label>Help type</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as CoachingMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(COACHING_MODE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{assignmentMode ? "Confirmed assignment or short paper" : "Related confirmed task (optional)"}</Label>
          <Select value={obligationId} onValueChange={(value) => setObligationId(value === "none" ? "" : value)}>
            <SelectTrigger><SelectValue placeholder="Select a task" /></SelectTrigger>
            <SelectContent>
              {!assignmentMode && <SelectItem value="none">No specific task</SelectItem>}
              {availableObligations.map((item) => (
                <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignmentMode && availableObligations.length === 0 && (
            <p className="text-xs text-amber-700">
              Confirm an assignment, short paper, or project in Plan first.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{mode === "draft_feedback" ? "Paste your short draft or blocker" : "What would you like help preparing?"}</Label>
          <Textarea
            value={content}
            maxLength={6000}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              mode === "draft_feedback"
                ? "Paste a short draft excerpt and describe the feedback you need."
                : mode === "office_hours"
                  ? "What is confusing or blocking you before meeting your instructor?"
                  : "What part of this assignment needs a checklist or plan?"
            }
            className="min-h-[120px]"
          />
        </div>
        <div className="space-y-2">
          <Label>Evidence to use</Label>
          {processedSources.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              Add and process course material before requesting guidance.
            </p>
          ) : (
            <MaterialSelector
              sources={processedSources}
              selectedSourceIds={linkedSourceIds}
              onChange={setLinkedSourceIds}
            />
          )}
          {assignmentMode && obligationId && !rubricReady && (
            <p className="text-xs text-amber-700">
              Add grading criteria in Plan or select a processed assignment brief.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button className="w-full" onClick={submit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Preparing guidance..." : "Prepare guidance"}
        </Button>
        <p className="text-xs leading-5 text-slate-500">
          Only your request and selected material excerpts are sent for AI generation when you press
          Prepare guidance.
        </p>
      </CardContent>
    </Card>
  );
}

export function CourseStreamWorkspace({ projectId }: { projectId: string }) {
  const { entries, total, isLoading, error, refetch } = useCourseStream(projectId);
  const { sources, isLoading: sourcesLoading, error: sourcesError } = useSources(projectId);
  const [entryType, setEntryType] = useState<CourseStreamCaptureType>("note");
  const [content, setContent] = useState("");
  const [linkedSourceIds, setLinkedSourceIds] = useState<string[]>([]);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const openQuestions = entries.filter(
    (entry) => entry.entry_type === "question" && entry.confusion_status !== "resolved"
  );
  const processedMaterialCount = sources.filter((source) => source.status === "processed").length;
  const answeredQuestionCount = entries.filter(
    (entry) => entry.entry_type === "question" && entry.answer_status === "answered"
  ).length;
  const readyGuidanceCount = entries.filter(
    (entry) => entry.entry_type === "coaching" && entry.coaching_status === "ready"
  ).length;
  const hasPendingGeneration = entries.some(
    (entry) =>
      entry.answer_status === "queued" ||
      entry.answer_status === "generating" ||
      entry.coaching_status === "queued" ||
      entry.coaching_status === "generating"
  );
  const turnstileReady =
    !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || Boolean(turnstileToken);

  useEffect(() => {
    if (!hasPendingGeneration) return;
    const timer = window.setTimeout(refetch, 1500);
    return () => window.clearTimeout(timer);
  }, [hasPendingGeneration, refetch]);

  const addEntry = async () => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await createCourseStreamEntry(projectId, {
        entry_type: entryType,
        content,
        linked_source_ids: linkedSourceIds,
      });
      setContent("");
      setLinkedSourceIds([]);
      refetch();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save entry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--ck-ink)]">Room</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--ck-ink)]">
                Keep the story of this class in one place.
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-700">
                Capture notes, questions, reflections, and supporting material. Ask for a cited
                answer or bounded coursework guidance only when it helps you move forward.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-[var(--ck-primary)]" />
              <Button asChild size="sm">
                <Link href={routes.courseNotebook(projectId)}>
                  Open Notebook
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--ck-primary-border)] bg-white/70 p-3">
              <p className="text-xs font-medium text-slate-500">Processed materials</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ck-ink)]">{processedMaterialCount}</p>
              <p className="text-xs text-slate-600">Ready for cited help or Notebook use</p>
            </div>
            <div className="rounded-xl border border-[var(--ck-primary-border)] bg-white/70 p-3">
              <p className="text-xs font-medium text-slate-500">Cited answers</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ck-ink)]">{answeredQuestionCount}</p>
              <p className="text-xs text-slate-600">{openQuestions.length} questions still open</p>
            </div>
            <div className="rounded-xl border border-[var(--ck-primary-border)] bg-white/70 p-3">
              <p className="text-xs font-medium text-slate-500">Guidance notes</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--ck-ink)]">{readyGuidanceCount}</p>
              <p className="text-xs text-slate-600">For assignments or office hours</p>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-600">
            Notebook builds from materials you choose. Room entries stay here unless you
            deliberately use their linked materials in Notebook. Live capture and shared rooms
            remain future work.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Confusion Inbox</CardTitle>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
            {openQuestions.length} open
          </span>
        </CardHeader>
        <CardContent>
          {openQuestions.length === 0 ? (
            <p className="text-sm text-slate-600">
              No open questions. Add a question whenever something from class needs clarification.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {openQuestions.map((entry) => (
                <a
                  key={entry.id}
                  href={`#stream-entry-${entry.id}`}
                  className="max-w-full truncate rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 hover:border-amber-300"
                >
                  {entry.content}
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
        <Card className="h-fit rounded-2xl shadow-sm">
          <CardHeader><CardTitle className="text-lg">Capture from class</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Entry type</Label>
              <Select value={entryType} onValueChange={(value) => setEntryType(value as CourseStreamCaptureType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="reflection">Reflection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What should this room remember?</Label>
              <Textarea
                value={content}
                maxLength={10000}
                onChange={(event) => setContent(event.target.value)}
                placeholder={
                  entryType === "question"
                    ? "What do you want to clarify later?"
                    : entryType === "reflection"
                      ? "What became clearer today, and where are you still uncertain?"
                    : "Record a concept, example, or reminder from class."
                }
                className="min-h-[180px]"
              />
              <p className="text-right text-xs text-slate-500">{content.length}/10000</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Related course materials</Label>
                <Link
                  href={routes.courseMaterials(projectId)}
                  className="text-xs font-medium text-[var(--ck-primary)] hover:underline"
                >
                  Add material
                </Link>
              </div>
              {sourcesLoading ? (
                <p className="text-xs text-slate-500">Loading materials...</p>
              ) : sourcesError ? (
                <p className="text-xs text-red-600">{sourcesError}</p>
              ) : sources.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                  Add a PDF, URL, or pasted note in Materials, then reference it from this entry.
                </p>
              ) : (
                <MaterialSelector
                  sources={sources}
                  selectedSourceIds={linkedSourceIds}
                  onChange={setLinkedSourceIds}
                />
              )}
            </div>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <Button className="w-full" onClick={addEntry} disabled={isSubmitting || !content.trim()}>
              {isSubmitting ? "Saving..." : "Add to Room"}
            </Button>
            <p className="text-xs leading-5 text-slate-500">
              Saving an entry stores it in this private workspace. It is not sent to AI unless a
              cited-answer or guidance request is made by you.
            </p>
            <TurnstileWidget
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken(undefined)}
            />
          </CardContent>
        </Card>
        <CourseworkCoachPanel
          projectId={projectId}
          sources={sources}
          turnstileToken={turnstileToken}
          turnstileReady={turnstileReady}
          onSubmitted={refetch}
        />
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-lg">Room timeline</CardTitle>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              {total} entr{total === 1 ? "y" : "ies"}
            </span>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading course room...</p>
            ) : error ? (
              <EmptyState title="Unable to load course room" description={error} />
            ) : entries.length === 0 ? (
              <EmptyState
                title="Nothing captured yet"
                description="Add a note, question, or reflection after class to start building this course memory."
              />
            ) : (
              <div className="space-y-3">
                {total > entries.length && (
                  <p className="text-xs text-slate-500">
                    Showing the latest {entries.length} of {total} entries.
                  </p>
                )}
                {entries.map((entry) => (
                  entry.entry_type === "coaching" ? (
                    <CoachingEntryCard
                      key={entry.id}
                      entry={entry}
                      projectId={projectId}
                      onSaved={refetch}
                    />
                  ) : (
                    <StreamEntryCard
                      key={entry.id}
                      entry={entry}
                      projectId={projectId}
                      sources={sources}
                      turnstileToken={turnstileToken}
                      turnstileReady={turnstileReady}
                      onSaved={refetch}
                    />
                  )
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
