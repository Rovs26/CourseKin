import type { Project } from "@/types/project";
import type {
  ReviewerCitation,
  ReviewerEvidenceItem,
  ReviewerFeedbackRating,
  ReviewerOutput,
  ReviewerStatus,
} from "@/types/reviewer";
import type { Source, SourcePurpose } from "@/types/source";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_COURSEKIN_API_URL ??
  process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "/api"
).replace(/\/+$/, "");

// ── Auth token injection ───────────────────────────────────────────────────────
// Call setTokenGetter() once with useAuth().getToken from Clerk.
// apiRequest will call it before every request and attach the Bearer token.
// This avoids threading a token parameter through every API call site.
let _getToken: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobStage =
  | "queued"
  | "extracting"
  | "cleaning"
  | "chunking"
  | "retrieving"
  | "generating"
  | "saving"
  | "completed"
  | "failed";

export interface Job {
  id: string;
  project_id: string;
  source_id: string | null;
  job_type: string;
  status: JobStatus;
  stage: JobStage;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

type ListResponse<T> = {
  items: T[];
  total: number;
};

export type ProjectSummary = {
  project: Project;
  source_count: number;
  processed_source_count: number;
  reviewer_status: ReviewerStatus;
  reviewer_coverage_percent: number;
  activity_at: string;
};

type CreateProjectInput = Omit<Project, "id" | "created_at" | "updated_at">;

type CreateTextSourceInput = {
  project_id: string;
  title: string;
  text?: string;
  content?: string;
  purpose?: SourcePurpose;
};

type CreateUrlSourceInput = {
  project_id: string;
  title: string;
  url: string;
  purpose?: SourcePurpose;
};

export type ReviewerSectionId =
  | "summary"
  | "key_points"
  | "definitions"
  | "qa"
  | "quiz"
  | "flashcards";

export type SectionCounts = {
  key_points?: number;
  definitions?: number;
  qa?: number;
  quiz?: number;
  flashcards?: number;
};

export type MergeMode = "skip" | "replace" | "append";

type GenerateReviewerInput = {
  project_id: string;
  source_id?: string;
  job_type: "generate-reviewer";
  sections?: ReviewerSectionId[];
  counts?: SectionCounts;
  merge_mode?: MergeMode;
  turnstile_token?: string;
};

type RegenerateReviewerInput = {
  project_id: string;
  source_id?: string;
  sections?: ReviewerSectionId[];
  counts?: SectionCounts;
  merge_mode?: MergeMode;
  turnstile_token?: string;
};

export type SourceGenerationConfig = {
  source_id: string;
  sections?: ReviewerSectionId[];
  counts?: SectionCounts;
  merge_mode?: MergeMode;
};

type BatchGenerateInput = {
  project_id: string;
  sources: SourceGenerationConfig[];
  turnstile_token?: string;
};

export type BatchGenerateResult = {
  batch_id: string;
  project_id: string;
  total_sources: number;
  status: string;
  job_ids: string[];
};

export type ObligationType =
  | "quiz"
  | "exam"
  | "assignment"
  | "project"
  | "paper"
  | "reading"
  | "other";

export type ObligationStatus = "proposed" | "confirmed" | "dismissed";

export type CourseObligation = {
  id: string;
  project_id: string;
  source_id: string;
  title: string;
  obligation_type: ObligationType;
  due_date: string | null;
  details: string | null;
  grading_criteria: string | null;
  confidence: "high" | "medium" | "low";
  uncertain_fields: string[];
  topics: string[];
  topic_weights: Record<string, number> | null;
  status: ObligationStatus;
  created_at: string;
  updated_at: string;
};

export type PreparationMilestoneStatus = "planned" | "completed" | "skipped";

export type PreparationMilestone = {
  id: string;
  project_id: string;
  obligation_id: string;
  title: string;
  milestone_type: string;
  sequence: number;
  scheduled_date: string;
  estimated_minutes: number;
  status: PreparationMilestoneStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PreparationRunwayItem = {
  obligation: CourseObligation;
  milestones: PreparationMilestone[];
  preparation_progress_percent: number;
  missing_materials: string[];
  next_action: string | null;
};

export type PreparationRunway = {
  items: PreparationRunwayItem[];
  daily_load: {
    date: string;
    estimated_minutes: number;
    session_count: number;
    exceeds_capacity: boolean;
  }[];
  confirmed_without_due_date: CourseObligation[];
  total_sessions: number;
  completed_sessions: number;
  preparation_progress_percent: number;
  daily_capacity_minutes: number;
};

export type ReminderPreference = {
  project_id: string;
  enabled: boolean;
  lead_days: number;
};

export type PreparationReminder = {
  milestone_id: string;
  project_id: string;
  project_title: string;
  course_code: string | null;
  obligation_id: string;
  obligation_title: string;
  obligation_due_date: string | null;
  milestone_title: string;
  scheduled_date: string;
  estimated_minutes: number;
  urgency: "overdue" | "today" | "upcoming";
  days_until: number;
};

export type CourseTaskPriority = "low" | "medium" | "high";
export type CourseTaskStatus = "open" | "completed";

export type TaskRecurrenceRule = "daily" | "weekly" | "biweekly" | "monthly";

export type CourseTask = {
  id: string;
  project_id: string;
  project_title: string;
  course_code: string | null;
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: CourseTaskPriority;
  status: CourseTaskStatus;
  origin: "student";
  parent_task_id: string | null;
  tags: string[];
  recurrence_rule: TaskRecurrenceRule | null;
  recurrence_parent_id: string | null;
  focus_seconds_total: number;
  subtask_count: number;
  completed_subtask_count: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskFocusSession = {
  id: string;
  task_id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
};

export type TaskStreak = {
  current_streak_days: number;
  longest_streak_days: number;
  last_completion_date: string | null;
  completion_dates_30d: string[];
};

export type TaskStats = {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  due_today: number;
  due_this_week: number;
  completion_rate_percent: number;
  completed_last_7d: number;
  completed_last_30d: number;
  focus_seconds_last_7d: number;
  focus_seconds_total: number;
  streak: TaskStreak;
  tag_counts: Array<{ tag: string; count: number }>;
};

export type CalendarAgendaItem = {
  id: string;
  item_type: "deadline" | "preparation_session" | "task";
  project_id: string;
  project_title: string;
  course_code: string | null;
  title: string;
  date: string;
  status: string;
  details: string | null;
  priority: CourseTaskPriority | null;
  estimated_minutes: number | null;
  obligation_id: string | null;
};

export type CalendarAgenda = {
  items: CalendarAgendaItem[];
  unscheduled_tasks: CourseTask[];
  start_date: string;
  end_date: string;
  reference_date: string;
  open_tasks: number;
  overdue_tasks: number;
  upcoming_deadlines: number;
};

export type CourseStreamCaptureType = "note" | "question" | "reflection";
export type CourseStreamEntryType =
  | CourseStreamCaptureType
  | "coaching"
  | "audio_transcript";

export type AudioCandidateCard = {
  front: string;
  back: string;
  tag: string | null;
};

export type AudioStreamPayload = {
  transcript: string;
  duration_seconds: number;
  audio_filename: string;
  language: string | null;
  language_warning: string | null;
  candidate_cards: AudioCandidateCard[];
  job_id: string;
};
export type ConfusionStatus = "open" | "resolved";
export type CourseAnswerMode = "standard" | "simplified" | "step_by_step" | "example_first";
export type CourseAnswerStatus =
  | "queued"
  | "generating"
  | "answered"
  | "insufficient_evidence"
  | "failed";
export type CoachingMode = "assignment_plan" | "draft_feedback" | "office_hours";
export type CoachingStatus =
  | "queued"
  | "generating"
  | "ready"
  | "insufficient_evidence"
  | "failed";

export type QuizAttemptResult = {
  item_index: number;
  topic: string | null;
  question: string;
  selected_answer: string;
  correct_answer: string;
  rationale: string;
  is_correct: boolean;
  evidence: ReviewerEvidenceItem | null;
};

export type QuizAttempt = {
  id: string;
  project_id: string;
  reviewer_version: number;
  results: QuizAttemptResult[];
  total_questions: number;
  correct_answers: number;
  score_percent: number;
  duration_seconds: number | null;
  confidence_before: number | null;
  confidence_after: number | null;
  created_at: string;
};

export type QuizFocusTopic = {
  topic: string;
  questions_answered: number;
  correct_answers: number;
  score_percent: number;
  missed_count: number;
  status: "needs_review" | "practicing" | "recall_improving";
  recommended_action: string;
};

export type QuizPracticeSummary = {
  total_attempts: number;
  total_answered: number;
  total_correct: number;
  latest_score_percent: number | null;
  best_score_percent: number | null;
  practice_signal: "no_practice" | "early" | "needs_review" | "building";
  practice_signal_label: string;
  signal_note: string;
  next_action: string;
  focus_topics: QuizFocusTopic[];
  focus_questions: QuizAttemptResult[];
  recent_attempts: QuizAttempt[];
};

type CourseEvidence = {
  status: "supported" | "not_found";
  source_scope: "course_materials_only";
  citations: Array<{
    chunk_id: string;
    source_id: string;
    source_title: string;
    page_number?: number | null;
    excerpt: string;
  }>;
};

export type CourseStreamEntry = {
  id: string;
  project_id: string;
  entry_type: CourseStreamEntryType;
  content: string;
  linked_sources: Array<Pick<Source, "id" | "title" | "type" | "status" | "purpose">>;
  confusion_status: ConfusionStatus | null;
  answer_status: CourseAnswerStatus | null;
  answer_mode: CourseAnswerMode | null;
  answer_content: string | null;
  answer_evidence: CourseEvidence | null;
  answer_job_id: string | null;
  answer_generated_at: string | null;
  coaching_mode: CoachingMode | null;
  related_obligation_id: string | null;
  coaching_context: {
    obligation: Pick<
      CourseObligation,
      "id" | "title" | "obligation_type" | "due_date" | "details" | "grading_criteria"
    > | null;
  } | null;
  coaching_status: CoachingStatus | null;
  coaching_output: {
    guidance: string;
    next_steps: string[];
    rubric_checks: string[];
    questions_for_instructor: string[];
    limitation_note: string;
  } | null;
  coaching_evidence: CourseEvidence | null;
  coaching_job_id: string | null;
  coaching_generated_at: string | null;
  audio_payload: AudioStreamPayload | null;
  created_at: string;
  updated_at: string;
};

type CourseStreamEntryInput = {
  entry_type: CourseStreamCaptureType;
  content: string;
  linked_source_ids: string[];
};

type CourseCoachingInput = {
  coaching_mode: CoachingMode;
  content: string;
  obligation_id?: string;
  linked_source_ids: string[];
  turnstile_token?: string;
};

function localCalendarDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach Clerk JWT if a token getter is configured
  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Non-fatal: let the request proceed; the server will return 401 if auth is required
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    // Friendly message for rate limiting — shown directly in the UI
    if (response.status === 429) {
      throw new Error("You're going a bit fast. Please wait a moment and try again.");
    }

    let message = `Request failed with status ${response.status}`;

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (typeof data?.message === "string") {
        message = data.message;
      } else if (typeof data?.error === "string") {
        message = data.error;
      }
    } catch {}

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listProjects() {
  return apiRequest<ListResponse<Project>>("/projects", {
    method: "GET",
  });
}

export function listProjectSummaries() {
  return apiRequest<ListResponse<ProjectSummary>>("/projects/summaries", {
    method: "GET",
  });
}

export function getProject(projectId: string) {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "GET",
  });
}

export function createProject(input: CreateProjectInput) {
  return apiRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(
  projectId: string,
  input: Partial<Omit<Project, "id" | "created_at" | "updated_at">>
) {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProject(projectId: string) {
  return apiRequest<{ message: string }>(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export function listProjectSources(projectId: string) {
  return apiRequest<ListResponse<Source>>(`/projects/${projectId}/sources`, {
    method: "GET",
  });
}

export type SourceChunk = {
  id: string;
  source_id: string;
  ordinal: number;
  page_number: number | null;
  text: string;
};

export type SourceChunkList = {
  source_id: string;
  source_title: string;
  items: SourceChunk[];
};

export function getSource(sourceId: string) {
  return apiRequest<Source>(`/sources/item/${sourceId}`, { method: "GET" });
}

export function listSourceChunks(sourceId: string) {
  return apiRequest<SourceChunkList>(`/sources/item/${sourceId}/chunks`, {
    method: "GET",
  });
}

export function createSourceFromStreamEntries(
  projectId: string,
  input: { entry_ids: string[]; title?: string },
) {
  return apiRequest<Source>(
    `/projects/${projectId}/stream/source-from-entries`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function createTextSource(input: CreateTextSourceInput) {
  return apiRequest<Source>("/sources/text", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type SyllabusPrefill = {
  title: string | null;
  course_code: string | null;
  field_of_study: string | null;
  term: string | null;
  instructor: string | null;
  meeting_schedule: string | null;
};

export function prefillFromSyllabus(text: string) {
  return apiRequest<SyllabusPrefill>("/syllabus/prefill", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export type PresignResponse = {
  upload_url: string;
  key: string;
  expires_in: number;
};

/**
 * Three-step presigned upload:
 *   1. Get a presigned PUT URL from the API
 *   2. PUT the file bytes directly to R2
 *   3. Finalize — server downloads from R2, extracts text, creates Source row
 *
 * @param onProgress optional callback with upload progress 0–100
 */
export async function presignAndUploadPDF(
  projectId: string,
  file: File,
  title: string,
  purpose: SourcePurpose = "study_material",
  onProgress?: (pct: number) => void,
): Promise<Source> {
  // Step 1: get presigned URL
  const presign = await apiRequest<PresignResponse>("/sources/upload/presign", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      filename: file.name,
      content_type: "application/pdf",
      size_bytes: file.size,
    }),
  });

  // Step 2: PUT directly to R2 (bypasses our server)
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.upload_url);
    xhr.setRequestHeader("Content-Type", "application/pdf");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload to storage failed (${xhr.status})`));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "PDF could not reach secure file storage. Try pasting its text for now or contact support."
        )
      );
    xhr.send(file);
  });

  // Step 3: finalize — server-side text extraction
  return apiRequest<Source>("/sources/upload/finalize", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      storage_key: presign.key,
      title,
      purpose,
    }),
  });
}

export function createURLSource(input: CreateUrlSourceInput) {
  return apiRequest<Source>("/sources/url", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteSource(sourceId: string) {
  return apiRequest<{ message: string }>(`/sources/${sourceId}`, {
    method: "DELETE",
  });
}

export function updateSourcePurpose(sourceId: string, purpose: SourcePurpose) {
  return apiRequest<Source>(`/sources/${sourceId}/purpose`, {
    method: "PATCH",
    body: JSON.stringify({ purpose }),
  });
}

export function listCourseObligations(projectId: string) {
  return apiRequest<ListResponse<CourseObligation>>(`/projects/${projectId}/planning/obligations`, {
    method: "GET",
  });
}

export function extractSyllabusObligations(
  projectId: string,
  sourceId: string,
  turnstileToken?: string
) {
  return apiRequest<Job>(`/projects/${projectId}/planning/extract-syllabus`, {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId, turnstile_token: turnstileToken }),
  });
}

export function reviewCourseObligation(
  projectId: string,
  obligationId: string,
  input: {
    title: string;
    obligation_type: ObligationType;
    due_date?: string | null;
    details?: string | null;
    grading_criteria?: string | null;
    status: "confirmed" | "dismissed";
  }
) {
  return apiRequest<CourseObligation>(
    `/projects/${projectId}/planning/obligations/${obligationId}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
}

export function getPreparationRunway(projectId: string, dailyCapacityMinutes = 120) {
  return apiRequest<PreparationRunway>(
    `/projects/${projectId}/planning/runway?daily_capacity_minutes=${dailyCapacityMinutes}&planning_date=${localCalendarDate()}`,
    { method: "GET" }
  );
}

export function buildPreparationRunway(projectId: string, dailyCapacityMinutes = 120) {
  return apiRequest<PreparationRunway>(`/projects/${projectId}/planning/runway/build`, {
    method: "POST",
    body: JSON.stringify({
      daily_capacity_minutes: dailyCapacityMinutes,
      planning_start_date: localCalendarDate(),
    }),
  });
}

export function updatePreparationMilestone(
  projectId: string,
  milestoneId: string,
  status: PreparationMilestoneStatus
) {
  return apiRequest<PreparationMilestone>(
    `/projects/${projectId}/planning/milestones/${milestoneId}`,
    { method: "PATCH", body: JSON.stringify({ status }) }
  );
}

export function getReminderPreferences(projectId: string) {
  return apiRequest<ReminderPreference>(`/projects/${projectId}/planning/reminder-preferences`, {
    method: "GET",
  });
}

export function updateReminderPreferences(
  projectId: string,
  input: { enabled: boolean; lead_days: number }
) {
  return apiRequest<ReminderPreference>(`/projects/${projectId}/planning/reminder-preferences`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listPreparationReminders() {
  return apiRequest<{ items: PreparationReminder[]; total: number; reference_date: string }>(
    `/planning/reminders?reference_date=${localCalendarDate()}`,
    { method: "GET" }
  );
}

export function listCourseTasks(includeCompleted = true, tag?: string) {
  const params = new URLSearchParams({ include_completed: String(includeCompleted) });
  if (tag) params.set("tag", tag);
  return apiRequest<{ items: CourseTask[]; total: number }>(
    `/planning/tasks?${params.toString()}`,
    { method: "GET" }
  );
}

export function createCourseTask(
  projectId: string,
  input: {
    title: string;
    notes?: string;
    due_date?: string;
    priority: CourseTaskPriority;
    parent_task_id?: string | null;
    tags?: string[];
    recurrence_rule?: TaskRecurrenceRule | null;
  }
) {
  return apiRequest<CourseTask>(`/projects/${projectId}/planning/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCourseTask(
  projectId: string,
  taskId: string,
  input: Partial<{
    title: string;
    notes: string | null;
    due_date: string | null;
    priority: CourseTaskPriority;
    status: CourseTaskStatus;
    parent_task_id: string | null;
    tags: string[];
    recurrence_rule: TaskRecurrenceRule | null;
  }>
) {
  return apiRequest<CourseTask>(`/projects/${projectId}/planning/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCourseTask(projectId: string, taskId: string) {
  return apiRequest<void>(`/projects/${projectId}/planning/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export function startTaskFocus(projectId: string, taskId: string, notes?: string) {
  return apiRequest<TaskFocusSession>(
    `/projects/${projectId}/planning/tasks/${taskId}/focus/start`,
    {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    }
  );
}

export function stopTaskFocus(projectId: string, taskId: string, notes?: string) {
  return apiRequest<TaskFocusSession>(
    `/projects/${projectId}/planning/tasks/${taskId}/focus/stop`,
    {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    }
  );
}

export function getActiveTaskFocus() {
  return apiRequest<TaskFocusSession | null>(`/planning/tasks/active-focus`, {
    method: "GET",
  });
}

export function getTaskStats() {
  return apiRequest<TaskStats>(`/planning/stats`, {
    method: "GET",
  });
}

// ─── Coverage / topic readiness mapping ──────────────────────────────

export type CoverageBucket = "untested" | "weak" | "developing" | "strong";

export type CoverageTopicRow = {
  topic: string;
  attempts_weighted: number;
  correct_weighted: number;
  readiness_percent: number | null;
  cards_due: number;
  cards_total: number;
  coverage: CoverageBucket;
  weight_percent: number | null;
  study_priority_rank: number;
};

export type ObligationReadiness = {
  obligation_id: string;
  topics: CoverageTopicRow[];
  overall_readiness_percent: number | null;
  exam_readiness_percent: number | null;
  has_weights: boolean;
  review_order: string[];
  topics_total: number;
  topics_untested: number;
};

export type SourceCoverageEntry = {
  source_id: string;
  title: string;
  purpose: string;
  match_count: number;
};

export type TopicSourceCoverageRow = {
  topic: string;
  covered: boolean;
  match_count: number;
  sources: SourceCoverageEntry[];
};

export type ObligationSourceCoverage = {
  obligation_id: string;
  topics: TopicSourceCoverageRow[];
  covered_count: number;
  missing_topics: string[];
};

export type ProjectCoverage = {
  project_id: string;
  obligations: Array<{
    obligation_id: string;
    title: string;
    due_date: string | null;
    topics_total: number;
    topics_untested: number;
    overall_readiness_percent: number | null;
  }>;
  project_readiness_percent: number | null;
  topics_total: number;
  topics_untested: number;
  obligations_count: number;
};

export function updateObligationTopics(
  projectId: string,
  obligationId: string,
  topics: string[]
) {
  return apiRequest<CourseObligation>(
    `/projects/${projectId}/planning/obligations/${obligationId}/topics`,
    {
      method: "PUT",
      body: JSON.stringify({ topics }),
    }
  );
}

export function getObligationReadiness(projectId: string, obligationId: string) {
  return apiRequest<ObligationReadiness>(
    `/projects/${projectId}/planning/obligations/${obligationId}/readiness`,
    { method: "GET" }
  );
}

export function getProjectCoverage(projectId: string) {
  return apiRequest<ProjectCoverage>(
    `/projects/${projectId}/planning/coverage`,
    { method: "GET" }
  );
}

export function getObligationSourceCoverage(
  projectId: string,
  obligationId: string,
) {
  return apiRequest<ObligationSourceCoverage>(
    `/projects/${projectId}/planning/obligations/${obligationId}/source-coverage`,
    { method: "GET" }
  );
}

// ─── Notebook (study cards + spaced repetition) ──────────────────────

export type NotebookCardOrigin =
  | "manual"
  | "stream_entry"
  | "quiz_gap"
  | "ai_generated";

export type NotebookCard = {
  id: string;
  project_id: string;
  user_id: string;
  source_stream_entry_id: string | null;
  origin: NotebookCardOrigin;
  front: string;
  back: string | null;
  tags: string[];
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_date: string | null;
  last_reviewed_at: string | null;
  last_quality: number | null;
  created_at: string;
  updated_at: string;
};

export function getNotebookReviewQueue(limit = 50) {
  return apiRequest<{ items: NotebookCard[]; total: number; due_now: number }>(
    `/notebook/review-queue?limit=${limit}`,
    { method: "GET" }
  );
}

export function listNotebookCards(
  projectId: string,
  options: { onlyDue?: boolean; tag?: string } = {}
) {
  const params = new URLSearchParams();
  if (options.onlyDue) params.set("only_due", "true");
  if (options.tag) params.set("tag", options.tag);
  const qs = params.toString();
  return apiRequest<{ items: NotebookCard[]; total: number; due_now: number }>(
    `/projects/${projectId}/notebook/cards${qs ? `?${qs}` : ""}`,
    { method: "GET" }
  );
}

export function createNotebookCard(
  projectId: string,
  input: {
    front: string;
    back?: string | null;
    tags?: string[];
    source_stream_entry_id?: string | null;
  }
) {
  return apiRequest<NotebookCard>(`/projects/${projectId}/notebook/cards`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNotebookCard(
  projectId: string,
  cardId: string,
  input: Partial<{ front: string; back: string | null; tags: string[] }>
) {
  return apiRequest<NotebookCard>(
    `/projects/${projectId}/notebook/cards/${cardId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
}

export function deleteNotebookCard(projectId: string, cardId: string) {
  return apiRequest<void>(`/projects/${projectId}/notebook/cards/${cardId}`, {
    method: "DELETE",
  });
}

export function reviewNotebookCard(
  projectId: string,
  cardId: string,
  quality: number
) {
  return apiRequest<NotebookCard>(
    `/projects/${projectId}/notebook/cards/${cardId}/review`,
    {
      method: "POST",
      body: JSON.stringify({ quality }),
    }
  );
}

export function convertStreamEntryToCard(
  projectId: string,
  entryId: string,
  back?: string
) {
  return apiRequest<NotebookCard>(
    `/projects/${projectId}/stream/entries/${entryId}/convert-to-card`,
    {
      method: "POST",
      body: JSON.stringify({ back: back ?? null }),
    }
  );
}

export function getCalendarAgenda(startDate: string, endDate: string) {
  return apiRequest<CalendarAgenda>(
    `/planning/calendar?start_date=${startDate}&end_date=${endDate}&reference_date=${localCalendarDate()}`,
    { method: "GET" }
  );
}

export interface CalendarSubscription {
  token: string;
  feed_url: string;
  webcal_url: string;
}

export function getCalendarSubscription() {
  return apiRequest<CalendarSubscription>("/calendar/subscription", {
    method: "GET",
  });
}

export function rotateCalendarSubscription() {
  return apiRequest<CalendarSubscription>("/calendar/subscription/rotate", {
    method: "POST",
  });
}

export function listCourseStreamEntries(projectId: string) {
  return apiRequest<ListResponse<CourseStreamEntry>>(
    `/projects/${projectId}/stream/entries?limit=100`,
    { method: "GET" }
  );
}

export function createCourseStreamEntry(
  projectId: string,
  input: CourseStreamEntryInput
) {
  return apiRequest<CourseStreamEntry>(`/projects/${projectId}/stream/entries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCourseStreamEntry(
  projectId: string,
  entryId: string,
  input: CourseStreamEntryInput
) {
  return apiRequest<CourseStreamEntry>(`/projects/${projectId}/stream/entries/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCourseStreamEntry(projectId: string, entryId: string) {
  return apiRequest<{ message: string }>(`/projects/${projectId}/stream/entries/${entryId}`, {
    method: "DELETE",
  });
}

export function updateCourseConfusionStatus(
  projectId: string,
  entryId: string,
  status: ConfusionStatus
) {
  return apiRequest<CourseStreamEntry>(
    `/projects/${projectId}/stream/entries/${entryId}/confusion`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
}

export function requestCourseAnswer(
  projectId: string,
  entryId: string,
  explanationMode: CourseAnswerMode,
  turnstileToken?: string
) {
  return apiRequest<Job>(`/projects/${projectId}/stream/entries/${entryId}/answer`, {
    method: "POST",
    body: JSON.stringify({
      explanation_mode: explanationMode,
      turnstile_token: turnstileToken,
    }),
  });
}

export function requestCourseworkCoaching(projectId: string, input: CourseCoachingInput) {
  return apiRequest<CourseStreamEntry>(`/projects/${projectId}/stream/coaching`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function downloadConfirmedCalendar(projectId: string): Promise<Blob> {
  const headers = new Headers();
  if (_getToken) {
    const token = await _getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}/projects/${projectId}/planning/calendar.ics`, {
    method: "GET",
    headers,
  });
  if (!response.ok) throw new Error("Failed to export confirmed deadlines.");
  return response.blob();
}

export function generateReviewerJob(input: GenerateReviewerInput) {
  return apiRequest<Job>("/jobs/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getJob(jobId: string) {
  return apiRequest<Job>(`/jobs/${jobId}`, {
    method: "GET",
  });
}

export function getReviewer(projectId: string) {
  return apiRequest<ReviewerOutput>(`/projects/${projectId}/reviewer`, {
    method: "GET",
  });
}

export function submitReviewerFeedback(
  projectId: string,
  input: {
    section: ReviewerSectionId;
    item_index?: number;
    rating: ReviewerFeedbackRating;
    comment?: string;
  }
) {
  return apiRequest<{
    id: string;
    project_id: string;
    reviewer_version: number;
    section: ReviewerSectionId;
    item_index?: number | null;
    rating: ReviewerFeedbackRating;
  }>(`/projects/${projectId}/reviewer/feedback`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type NotebookChatMode =
  | "standard"
  | "simplified"
  | "step_by_step"
  | "example_first";

export interface NotebookChatAnswer {
  answer_status: "answered" | "insufficient_evidence";
  answer_content: string | null;
  answer_evidence: {
    status: "supported" | "not_found";
    source_scope: "course_materials_only";
    citations: ReviewerCitation[];
  };
}

export function askNotebookChat(
  projectId: string,
  question: string,
  explanationMode: NotebookChatMode = "standard",
  turnstileToken?: string
) {
  return apiRequest<NotebookChatAnswer>(`/projects/${projectId}/notebook/chat`, {
    method: "POST",
    body: JSON.stringify({
      question,
      explanation_mode: explanationMode,
      turnstile_token: turnstileToken,
    }),
  });
}

export function submitQuizAttempt(
  projectId: string,
  input: {
    reviewer_version: number;
    answers: Array<{ item_index: number; selected_answer: string }>;
    duration_seconds?: number;
    confidence_before?: number;
    confidence_after?: number;
  }
) {
  return apiRequest<QuizAttempt>(`/projects/${projectId}/reviewer/quiz-attempts`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getQuizPracticeSummary(projectId: string) {
  return apiRequest<QuizPracticeSummary>(`/projects/${projectId}/reviewer/practice-summary`, {
    method: "GET",
  });
}

export function regenerateReviewer(input: RegenerateReviewerInput) {
  return apiRequest<Job>("/reviewer/regenerate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Templates

export interface TemplateItem {
  id: string;
  name: string;
  description: string;
  sections: ReviewerSectionId[];
  counts: Record<string, number>;
}

export function listTemplates() {
  return apiRequest<ListResponse<TemplateItem>>("/templates", {
    method: "GET",
  });
}

export function getTemplate(templateId: string) {
  return apiRequest<TemplateItem>(`/templates/${templateId}`, {
    method: "GET",
  });
}

// Batch Generation

export function batchGenerateReviewer(input: BatchGenerateInput) {
  return apiRequest<BatchGenerateResult>("/reviewer/batch-generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Admin

export interface AbuseSummary {
  high_volume_last_hour: { project_id: string; job_count: number }[];
  high_failure_ratio_24h: { project_id: string; total: number; failed: number }[];
  banned_users: { user_id: string; reason: string; banned_at: string; banned_by: string }[];
}

export interface CacheStats {
  cache_entries: number;
  total_cache_hits: number;
  total_generation_calls: number;
  cached_calls: number;
  hit_rate: number;
}

export interface CoursePlanningValidation {
  extraction_review: {
    measurable_reviews: number;
    confirmed: number;
    dismissed: number;
    unchanged_confirmations: number;
    corrected_confirmations: number;
    unchanged_confirmation_rate: number;
    field_corrections: Record<string, number>;
  };
  preparation_return: {
    confirmed_dated_assessments: number;
    assessments_with_runway: number;
    assessments_with_early_completed_session: number;
    early_preparation_rate: number;
  };
  notes: string[];
}

export function getAbuseSummary() {
  return apiRequest<AbuseSummary>("/admin/abuse/summary", { method: "GET" });
}

export function getCoursePlanningValidation() {
  return apiRequest<CoursePlanningValidation>("/admin/course-planning/validation", {
    method: "GET",
  });
}

export function getCacheStats() {
  return apiRequest<CacheStats>("/admin/cache-stats", { method: "GET" });
}

export function banUser(user_id: string, reason: string) {
  return apiRequest<{ message: string }>("/admin/abuse/ban", {
    method: "POST",
    body: JSON.stringify({ user_id, reason }),
  });
}

export function unbanUser(user_id: string) {
  return apiRequest<{ message: string }>("/admin/abuse/unban", {
    method: "POST",
    body: JSON.stringify({ user_id }),
  });
}

export async function downloadCustomPdf(
  projectId: string,
  sectionOrder: string[],
  visibleSections: string[]
): Promise<Blob> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (_getToken) {
    try {
      const token = await _getToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}
  }

  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/reviewer/export/custom-pdf`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        section_order: sectionOrder,
        visible_sections: visibleSections,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`PDF generation failed: ${response.status}`);
  }

  return response.blob();
}

// ─── Task proposal extraction (paste text or photo) ─────────────────

export type TaskProposal = {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: CourseTaskPriority;
  confidence: "high" | "medium" | "low";
  uncertain_fields: string[];
};

export type TaskExtractionResponse = {
  proposals: TaskProposal[];
  model: string;
  cost_usd: number;
};

export function extractTaskProposals(
  projectId: string,
  payload: { text?: string; image_base64?: string; turnstile_token?: string }
) {
  return apiRequest<TaskExtractionResponse>(
    `/projects/${projectId}/planning/task-proposals/extract`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ─── Natural-language day planner ────────────────────────────────────

export type PlannerKind =
  | "study"
  | "review"
  | "exercise"
  | "errand"
  | "personal"
  | "other";
export type PlannerTimeOfDay =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "any";
export type PlannerBlockStatus = "planned" | "completed" | "skipped";

export type PlannerSuggestion = {
  title: string;
  kind: PlannerKind;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number;
  time_of_day: PlannerTimeOfDay;
  notes: string | null;
  conflict: boolean;
};

export type PlannerSuggestResponse = {
  suggestions: PlannerSuggestion[];
  model: string;
  cost_usd: number;
};

export type PlannerBlock = {
  id: string;
  project_id: string | null;
  title: string;
  notes: string | null;
  kind: PlannerKind;
  scheduled_date: string;
  start_time: string | null;
  duration_minutes: number;
  status: PlannerBlockStatus;
  origin: string;
  created_at: string;
  updated_at: string;
};

export type PlannerBlockInput = {
  title: string;
  kind?: PlannerKind;
  scheduled_date: string;
  start_time?: string | null;
  duration_minutes?: number;
  notes?: string | null;
  project_id?: string | null;
};

export function suggestPlan(payload: { text: string; turnstile_token?: string }) {
  return apiRequest<PlannerSuggestResponse>("/planner/suggest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type AssistantChatMode = "plan" | "reply";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantChatResponse = {
  mode: AssistantChatMode;
  reply: string;
  suggestions: PlannerSuggestion[];
  model: string;
  cost_usd: number;
};

export function chatWithAssistant(payload: {
  message: string;
  history?: AssistantChatMessage[];
  turnstile_token?: string;
}) {
  return apiRequest<AssistantChatResponse>("/planner/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createPlannerBlocks(blocks: PlannerBlockInput[]) {
  return apiRequest<ListResponse<PlannerBlock>>("/planner/blocks", {
    method: "POST",
    body: JSON.stringify({ blocks }),
  });
}

export function listPlannerBlocks(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const query = params.toString();
  return apiRequest<ListResponse<PlannerBlock>>(
    `/planner/blocks${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
}

export function updatePlannerBlock(
  blockId: string,
  payload: Partial<{
    title: string;
    scheduled_date: string;
    start_time: string | null;
    duration_minutes: number;
    status: PlannerBlockStatus;
    notes: string | null;
  }>
) {
  return apiRequest<PlannerBlock>(`/planner/blocks/${blockId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePlannerBlock(blockId: string) {
  return apiRequest<void>(`/planner/blocks/${blockId}`, { method: "DELETE" });
}

// ─── Audio E1 (lecture transcription, behind feature flag) ───────────

export type AudioConsentStatus = {
  consent_required_version: string;
  accepted_version: string | null;
  accepted_at: string | null;
  needs_consent: boolean;
};

export function getAudioConsentStatus(projectId: string) {
  return apiRequest<AudioConsentStatus>(
    `/projects/${projectId}/audio/consent`,
    { method: "GET" }
  );
}

export function acceptAudioConsent(
  projectId: string,
  payload: { consent_version: string; user_agent?: string }
) {
  return apiRequest<AudioConsentStatus>(
    `/projects/${projectId}/audio/consent`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function createAudioUploadUrl(
  projectId: string,
  payload: { filename: string; content_type: string; size_bytes: number }
) {
  return apiRequest<{ upload_url: string; key: string; expires_in: number }>(
    `/projects/${projectId}/audio/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function startAudioTranscription(
  projectId: string,
  payload: {
    storage_key: string;
    original_filename: string;
    turnstile_token?: string;
  }
) {
  return apiRequest<{
    id: string;
    project_id: string;
    job_type: string;
    status: string;
    stage: string;
    created_at: string;
    updated_at: string;
    error_message: string | null;
  }>(
    `/projects/${projectId}/audio/transcribe`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export function acceptAudioCandidateCard(
  projectId: string,
  entryId: string,
  payload: { front: string; back: string; tag?: string | null },
) {
  return apiRequest<NotebookCard>(
    `/projects/${projectId}/audio/entries/${entryId}/cards/accept`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

// ── Mock exams (Phase I) ────────────────────────────────────────────
export type ExamDifficulty = "easy" | "medium" | "hard" | "mixed";
export type ExamStatus = "in_progress" | "submitted" | "abandoned" | "expired";
export type ExamQuestionType = "mcq" | "short_answer" | "fill_blank";

export type ExamQuestion = {
  id: string;
  type: ExamQuestionType;
  topic: string;
  prompt: string;
  choices: string[];
  difficulty: "easy" | "medium" | "hard";
  rationale?: string | null;
  answer?: string;
};

export type ExamTopicResult = {
  topic: string;
  correct: number;
  total: number;
  accuracy_percent: number;
};

export type MockExamSummary = {
  id: string;
  project_id: string;
  obligation_id: string | null;
  title: string;
  difficulty: ExamDifficulty;
  target_minutes: number;
  question_count: number;
  total_count: number;
  correct_count: number | null;
  score_percent: number | null;
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  status: ExamStatus;
  confidence_before: number | null;
  confidence_after: number | null;
  created_at: string;
  updated_at: string;
};

export type QuestionVerdict = "correct" | "incorrect" | "unverified";

export type MockExamSession = MockExamSummary & {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  per_topic_results: ExamTopicResult[];
  per_question_correct?: Record<string, boolean>;
  per_question_verdict?: Record<string, QuestionVerdict>;
  unverified_count?: number;
  remedial_cards_created?: number;
};

export function createMockExam(
  projectId: string,
  payload: {
    obligation_id?: string | null;
    title?: string | null;
    difficulty: ExamDifficulty;
    target_minutes: number;
    question_count: number;
    confidence_before?: number | null;
  },
) {
  return apiRequest<MockExamSession>(`/projects/${projectId}/exams`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listMockExams(projectId: string) {
  return apiRequest<{ items: MockExamSummary[]; total: number }>(
    `/projects/${projectId}/exams`,
  );
}

export function getMockExam(projectId: string, examId: string) {
  return apiRequest<MockExamSession>(
    `/projects/${projectId}/exams/${examId}`,
  );
}

export function submitMockExam(
  projectId: string,
  examId: string,
  payload: { answers: Record<string, string>; confidence_after?: number | null },
) {
  return apiRequest<MockExamSession>(
    `/projects/${projectId}/exams/${examId}/submit`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function selfGradeMockExam(
  projectId: string,
  examId: string,
  payload: { question_id: string; verdict: "correct" | "incorrect" },
) {
  return apiRequest<MockExamSession>(
    `/projects/${projectId}/exams/${examId}/self-grade`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
