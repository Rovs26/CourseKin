import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, BookOpenCheck, AlertTriangle } from "lucide-react";
import type {
  ReviewerCitationKind,
  ReviewerEvidenceItem,
  ReviewerFeedbackRating,
} from "@/types/reviewer";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<ReviewerCitationKind, string> = {
  course_material: "Course material",
  student_notes: "Student notes",
  web_reference: "Web reference",
  ai_explanation: "AI explanation",
};

const KIND_STYLE: Record<ReviewerCitationKind, string> = {
  course_material: "bg-emerald-100 text-emerald-800",
  student_notes: "bg-sky-100 text-sky-800",
  web_reference: "bg-violet-100 text-violet-800",
  ai_explanation: "bg-slate-200 text-slate-800",
};

export function EvidenceCitations({
  evidence,
  onFeedback,
  className,
  projectId,
}: {
  evidence?: ReviewerEvidenceItem;
  onFeedback?: (rating: ReviewerFeedbackRating) => Promise<void>;
  className?: string;
  projectId?: string;
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

  const isWeak = evidence.status === "weak_support";
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
          "mt-3 rounded-xl border px-3 py-2 text-sm",
          isWeak
            ? "border-amber-200 bg-amber-50"
            : "border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)]",
          className
        )}
      >
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center gap-2 font-medium",
            isWeak ? "text-amber-800" : "text-[var(--ck-primary)]"
          )}
        >
          {isWeak ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <BookOpenCheck className="h-4 w-4" />
          )}
          {isWeak ? "Weak support" : "View evidence"} ({evidence.citations.length})
        </summary>
        <div className="mt-3 space-y-3">
          {evidence.citations.map((citation) => (
            <blockquote
              key={citation.chunk_id}
              className={cn(
                "border-l-2 pl-3 text-xs leading-5 text-slate-700",
                isWeak ? "border-amber-300" : "border-[var(--ck-primary-border)]"
              )}
            >
              <p className="flex flex-wrap items-center gap-2 font-semibold text-[var(--ck-ink)]">
                <span>
                  {citation.source_title}
                  {citation.page_number ? ` - page ${citation.page_number}` : ""}
                </span>
                {citation.source_kind && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      KIND_STYLE[citation.source_kind]
                    )}
                  >
                    {KIND_LABEL[citation.source_kind]}
                  </span>
                )}
              </p>
              <p className="mt-1">&ldquo;{citation.excerpt}&rdquo;</p>
              {projectId && (
                <Link
                  href={`/projects/${projectId}/sources/${citation.source_id}?highlight=${encodeURIComponent(citation.chunk_id)}`}
                  className="mt-1 inline-flex items-center gap-1 text-[var(--ck-primary)] hover:underline"
                >
                  Open in source
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
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
