export type SourceType = "pdf" | "url" | "text" | "file";

export type SourceStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "failed";

export interface Source {
  id: string;
  project_id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  created_at: string;
  updated_at?: string;
}