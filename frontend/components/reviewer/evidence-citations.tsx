import { useState } from "react";
import { AlertCircle, BookOpenCheck } from "lucide-react";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";
import { cn } from "@/lib/utils";

export function EvidenceCitations({
  evidence,
  onFeedback,
  className,
}: {
  evidence?: ReviewerEvidenceItem;
  onFeedback?: (rating: ReviewerFeedbackRating) => Promise<void>;
  className?: string;
}) {
  const [selectedRating, setSelectedRating] = useState<ReviewerFeedbackRating | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  if (!evidence) return null;

  const feedbackOptions: { label: string; rating: ReviewerFeedbackRating }[] = [
    { label: "Accurate", rating: "accurate" },
    { label: "Unsupported", rating: "unsupported" },
    { label: "Unclear", rating: "unclear" },
    { label: "Incorrect", rating: "incorrect" },
  ];

  const evidenceDetail =
    evidence.citations.length === 0 ? (
      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800",
          className
        )}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        No cited evidence
      </div>
    ) : (
      <details
        className={cn(
          "mt-3 rounded-xl border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] px-3 py-2 text-sm",
          className
        )}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-[var(--ck-primary)]">
          <BookOpenCheck className="h-4 w-4" />
          View evidence ({evidence.citations.length})
        </summary>
        <div className="mt-3 space-y-3">
          {evidence.citations.map((citation) => (
            <blockquote
              key={citation.chunk_id}
              className="border-l-2 border-[var(--ck-primary-border)] pl-3 text-xs leading-5 text-slate-700"
            >
              <p className="font-semibold text-[var(--ck-ink)]">
                {citation.source_title}
                {citation.page_number ? ` - page ${citation.page_number}` : ""}
              </p>
              <p className="mt-1">&ldquo;{citation.excerpt}&rdquo;</p>
            </blockquote>
          ))}
        </div>
      </details>
    );

  async function submitFeedback(rating: ReviewerFeedbackRating) {
    if (!onFeedback || isSubmitting) return;
    setIsSubmitting(true);
    setFeedbackError(null);
    try {
      await onFeedback(rating);
      setSelectedRating(rating);
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Could not save feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {evidenceDetail}
      {onFeedback && (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Is this grounded in your source?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {feedbackOptions.map((option) => (
              <button
                key={option.rating}
                type="button"
                disabled={isSubmitting}
                onClick={() => submitFeedback(option.rating)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                  selectedRating === option.rating
                    ? "border-[var(--ck-primary)] bg-[var(--ck-primary)] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[var(--ck-primary-border)] hover:text-[var(--ck-primary)]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {feedbackError && <p className="mt-2 text-xs text-red-600">{feedbackError}</p>}
        </div>
      )}
    </div>
  );
}
