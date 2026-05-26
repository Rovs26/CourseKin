export type ProjectType =
  | "school"
  | "exam"
  | "teacher"
  | "personal"
  | "research";

export type AgeBracket =
  | "grade-school"
  | "high-school"
  | "college"
  | "adult";

export type LearningMode =
  | "beginner"
  | "exam-cram"
  | "deep";

export type SourceMode =
  | "source-only"
  | "source-web"
  | "compare";

export type TemplateId =
  | "exam-sprint"
  | "deep-study-pack"
  | "lecture-notes-cleaner"
  | "compare-sources";

export interface Project {
  id: string;
  title: string;
  project_type: ProjectType;
  age_bracket: AgeBracket;
  learning_mode: LearningMode;
  field_of_study: string;
  source_mode: SourceMode;
  template_id?: TemplateId | null;
  course_code?: string | null;
  term?: string | null;
  instructor?: string | null;
  meeting_schedule?: string | null;
  reminders_enabled?: boolean;
  reminder_lead_days?: number;
  created_at: string;
  updated_at?: string;
}
