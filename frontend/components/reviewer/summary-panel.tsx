import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

export function SummaryPanel({
  summary,
  evidence,
  onFeedback,
  projectId,
}: {
  summary: string;
  evidence?: ReviewerEvidenceItem;
  onFeedback?: (rating: ReviewerFeedbackRating) => Promise<void>;
  projectId?: string;
}) {
  return (
    <Card className="rounded-2xl border bg-slate-50 shadow-none">
      <CardHeader>
        <CardTitle className="text-slate-900">Condensed Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="max-w-3xl text-sm leading-7 text-slate-700">{summary}</p>
        <EvidenceCitations evidence={evidence} onFeedback={onFeedback} projectId={projectId} />
      </CardContent>
    </Card>
  );
}
