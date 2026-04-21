export interface ReviewerContent {
  summary: string;
  key_points: string[];
  definitions: {
    term: string;
    definition: string;
  }[];
  qa: {
    question: string;
    answer: string;
  }[];
  quiz: {
    question: string;
    choices: string[];
    answer: string;
    rationale: string;
  }[];
  flashcards: {
    front: string;
    back: string;
  }[];
}

export type ReviewerStatus =
  | "not-ready"
  | "ready"
  | "stale"
  | "failed";

export interface ReviewerOutput {
  project_id: string;
  source_id?: string | null;
  status: ReviewerStatus;
  output_type: "full-reviewer";
  version: number;
  content_json: ReviewerContent | null;
  created_at?: string;
  updated_at?: string;
}