import type { ReviewerSectionId, SectionCounts } from "@/lib/coursekin-api";
import type { TemplateId } from "@/types/project";

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  sections: ReviewerSectionId[];
  counts: SectionCounts;
}

export const TEMPLATES: Record<TemplateId, TemplateConfig> = {
  "exam-sprint": {
    id: "exam-sprint",
    name: "Exam Sprint",
    sections: ["summary", "key_points", "quiz", "flashcards"],
    counts: { key_points: 10, quiz: 15, flashcards: 25 },
  },
  "deep-study-pack": {
    id: "deep-study-pack",
    name: "Deep Study Pack",
    sections: ["summary", "key_points", "definitions", "qa", "flashcards"],
    counts: { key_points: 20, definitions: 15, qa: 15, flashcards: 20 },
  },
  "lecture-notes-cleaner": {
    id: "lecture-notes-cleaner",
    name: "Lecture Notes Cleaner",
    sections: ["summary", "key_points", "definitions"],
    counts: { key_points: 20, definitions: 15 },
  },
  "compare-sources": {
    id: "compare-sources",
    name: "Compare Sources",
    sections: ["summary", "key_points", "qa", "quiz"],
    counts: { key_points: 15, qa: 10, quiz: 10 },
  },
};

export function getTemplateConfig(templateId: string | null | undefined): TemplateConfig | null {
  if (!templateId) return null;
  return TEMPLATES[templateId as TemplateId] ?? null;
}
