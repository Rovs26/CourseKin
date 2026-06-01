import { Flashcard } from "@/components/reviewer/flashcard";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

export function FlashcardsPanel({
  cards,
  evidence,
  onFeedback,
  projectId,
}: {
  cards: { front: string; back: string }[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
  projectId?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card, index) => (
        <div key={index}>
          <Flashcard front={card.front} back={card.back} />
          <EvidenceCitations
            evidence={evidence?.[index]}
            onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
            projectId={projectId}
          />
        </div>
      ))}
    </div>
  );
}
