import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

export function QAPanel({
  items,
  evidence,
  onFeedback,
  projectId,
}: {
  items: { question: string; answer: string }[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
  projectId?: string;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {item.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">{item.answer}</p>
            <EvidenceCitations
              evidence={evidence?.[index]}
              onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
              projectId={projectId}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
