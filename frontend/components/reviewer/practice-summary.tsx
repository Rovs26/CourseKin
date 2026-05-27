"use client";

import { BookOpenCheck, History, Target } from "lucide-react";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import { Card, CardContent } from "@/components/ui/card";
import { useQuizPracticeSummary } from "@/hooks/use-quiz-practice-summary";

const focusStatusLabels = {
  needs_review: "Review now",
  practicing: "Keep practicing",
  recall_improving: "Recall improving",
} as const;

function formatAttemptDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

export function PracticeSummary({
  projectId,
  refreshToken,
}: {
  projectId: string;
  refreshToken: number;
}) {
  const { summary, isLoading, error } = useQuizPracticeSummary(projectId, refreshToken);

  if (isLoading) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5 text-sm text-slate-500">Loading practice check-in...</CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5 text-sm text-red-600">
          {error ?? "Practice progress is unavailable."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Target className="h-5 w-5 text-[var(--ck-primary)]" />
              Practice check-in
            </h3>
            <p className="mt-1 text-sm text-slate-600">{summary.signal_note}</p>
          </div>
          <span className="rounded-full bg-[var(--ck-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--ck-primary)]">
            {summary.practice_signal_label}
          </span>
        </div>

        {summary.total_attempts === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-600">
            {summary.next_action}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Latest quiz</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {summary.latest_score_percent}%
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Best quiz</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {summary.best_score_percent}%
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Attempts</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {summary.total_attempts}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Correct answers</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {summary.total_correct}/{summary.total_answered}
                </p>
              </div>
            </div>

            <p className="rounded-xl bg-[var(--ck-primary-soft)] p-3 text-sm text-slate-700">
              Next: {summary.next_action}
            </p>

            {summary.focus_topics.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Focus areas</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Based on recent answers to source-grounded notebook questions.
                  </p>
                </div>
                {summary.focus_topics.map((topic) => (
                  <div
                    key={topic.topic}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-start"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{topic.topic}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {topic.recommended_action}
                      </p>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {topic.correct_answers}/{topic.questions_answered} correct
                      </p>
                      <p className="mt-1 text-xs text-[var(--ck-primary)]">
                        {focusStatusLabels[topic.status]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-600">
                Earlier practice stays in your history, but it cannot be grouped by concept.
                Build updated quiz questions to begin Focus Areas.
              </p>
            )}

            {summary.focus_questions.length > 0 && (
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <BookOpenCheck className="h-4 w-4 text-[var(--ck-primary)]" />
                  Review these missed questions
                </h4>
                {summary.focus_questions.map((item) => (
                  <div key={item.item_index} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-900">{item.question}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      Correct answer: {item.correct_answer}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{item.rationale}</p>
                    <EvidenceCitations evidence={item.evidence ?? undefined} />
                  </div>
                ))}
              </div>
            )}

            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <History className="h-4 w-4 text-slate-500" />
                Recent practice
              </h4>
              <div className="mt-2 space-y-2">
                {summary.recent_attempts.slice(0, 3).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-600">
                      {formatAttemptDate(attempt.created_at)}
                      {formatDuration(attempt.duration_seconds)
                        ? ` / ${formatDuration(attempt.duration_seconds)}`
                        : ""}
                    </span>
                    <span className="font-medium text-slate-900">
                      {attempt.correct_answers}/{attempt.total_questions} correct
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
