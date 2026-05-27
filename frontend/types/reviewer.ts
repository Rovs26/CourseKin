export type EvidenceStatus = "supported" | "weak_support" | "not_found";
export type ReviewerFeedbackRating =
  | "accurate"
  | "unsupported"
  | "unclear"
  | "incorrect";

export interface ReviewerCitation {
  chunk_id: string;
  source_id: string;
  source_title: string;
  page_number?: number | null;
  excerpt: string;
}

export interface ReviewerEvidenceItem {
  status: EvidenceStatus;
  citations: ReviewerCitation[];
}

export interface ReviewerEvidence {
  summary?: ReviewerEvidenceItem;
  key_points?: ReviewerEvidenceItem[];
  definitions?: ReviewerEvidenceItem[];
  qa?: ReviewerEvidenceItem[];
  quiz?: ReviewerEvidenceItem[];
  flashcards?: ReviewerEvidenceItem[];
}

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
    topic?: string;
    question: string;
    choices: string[];
    answer: string;
    rationale: string;
  }[];
  flashcards: {
    front: string;
    back: string;
  }[];
  _evidence?: ReviewerEvidence;
  _meta?: {
    sources?: Record<string, string | string[]>;
  };
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
