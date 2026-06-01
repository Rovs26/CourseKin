import { CheckCircle2 } from "lucide-react";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

export function KeyPointsPanel({
  keyPoints,
  evidence,
  onFeedback,
  projectId,
}: {
  keyPoints: string[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
  projectId?: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keyPoints.map((point, index) => (
        <div key={index} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-6 text-slate-700">{point}</p>
              <EvidenceCitations
                evidence={evidence?.[index]}
                onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
                projectId={projectId}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
