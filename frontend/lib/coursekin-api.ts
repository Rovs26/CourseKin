import type { Project } from "@/types/project";
import type { ReviewerFeedbackRating, ReviewerOutput, ReviewerStatus } from "@/types/reviewer";
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

export function createTextSource(input: CreateTextSourceInput) {
  return apiRequest<Source>("/sources/text", {
    method: "POST",
    body: JSON.stringify(input),
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
    xhr.onerror = () => reject(new Error("Upload to storage failed (network error)"));
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

export function getAbuseSummary() {
  return apiRequest<AbuseSummary>("/admin/abuse/summary", { method: "GET" });
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
