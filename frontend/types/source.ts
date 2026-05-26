export type SourceType = "pdf" | "url" | "text" | "file";

export type SourceStatus =
  | "uploaded"
  | "processing"
  | "processed"
  | "failed";

export type SourcePurpose =
  | "study_material"
  | "syllabus"
  | "lecture_notes"
  | "assignment_brief";

export interface Source {
  id: string;
  project_id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  purpose: SourcePurpose;
  created_at: string;
  updated_at?: string;
}
