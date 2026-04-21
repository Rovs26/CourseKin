import type { Project } from "@/types/project";
import type { ReviewerOutput } from "@/types/reviewer";
import type { Source } from "@/types/source";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000"
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

type CreateProjectInput = Omit<Project, "id" | "created_at" | "updated_at">;

type CreateTextSourceInput = {
  project_id: string;
  title: string;
  text?: string;
  content?: string;
};

type CreateUrlSourceInput = {
  project_id: string;
  title: string;
  url: string;
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
};

type RegenerateReviewerInput = {
  project_id: string;
  source_id?: string;
  sections?: ReviewerSectionId[];
  counts?: SectionCounts;
  merge_mode?: MergeMode;
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
};

export type BatchGenerateResult = {
  batch_id: string;
  project_id: string;
  total_sources: number;
  status: string;
  job_ids: string[];
};

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

export function uploadPDFSource(projectId: string, file: File) {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("file", file);
  return apiRequest<Source>("/sources/upload", {
    method: "POST",
    body: form,
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

// PDF Export

export function getReviewerPdfUrl(projectId: string) {
  return `${API_BASE_URL}/projects/${projectId}/reviewer/export/pdf`;
}

export function getReviewerPdfDownloadUrl(projectId: string) {
  return `${API_BASE_URL}/projects/${projectId}/reviewer/download/pdf`;
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