"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import { submitQuizAttempt, type QuizAttempt } from "@/lib/coursekin-api";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

interface QuizItem {
  topic?: string;
  question: string;
  choices: string[];
  answer: string;
  rationale: string;
}

export function QuizPanel({
  projectId,
  reviewerVersion,
  quiz,
  evidence,
  onFeedback,
  onAttemptSaved,
}: {
  projectId?: string;
  reviewerVersion?: number;
  quiz: QuizItem[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
  onAttemptSaved?: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [readOnlyRevealed, setReadOnlyRevealed] = useState<Record<number, boolean>>({});
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceBefore, setConfidenceBefore] = useState<number | null>(null);
  const [confidenceAfter, setConfidenceAfter] = useState<number | null>(null);
  const practiceEnabled = Boolean(projectId && reviewerVersion !== undefined);
  const answeredCount = Object.keys(answers).length;
  const canSubmit = quiz.length > 0 && answeredCount === quiz.length && !attempt;

  const submit = async () => {
    if (!canSubmit || isSubmitting || !projectId || reviewerVersion === undefined) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await submitQuizAttempt(projectId, {
        reviewer_version: reviewerVersion,
        answers: quiz.map((_, index) => ({
          item_index: index,
          selected_answer: answers[index]!,
        })),
        duration_seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        ...(confidenceBefore !== null ? { confidence_before: confidenceBefore } : {}),
        ...(confidenceAfter !== null ? { confidence_after: confidenceAfter } : {}),
      });
      setAttempt(result);
      onAttemptSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this practice attempt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const retry = () => {
    setAnswers({});
    setAttempt(null);
    setError(null);
    setStartedAt(Date.now());
    setConfidenceBefore(null);
    setConfidenceAfter(null);
  };

  const renderConfidenceRow = (
    value: number | null,
    onPick: (next: number) => void,
    disabled = false,
  ) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Not confident</span>
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          type="button"
          disabled={disabled}
          onClick={() => onPick(level)}
          className={`h-9 w-9 rounded-full border text-sm font-medium transition ${
            value === level
              ? "border-[var(--ck-primary-border)] bg-[var(--ck-primary)] text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          } disabled:opacity-60`}
        >
          {level}
        </button>
      ))}
      <span className="text-xs text-slate-500">Very confident</span>
    </div>
  );

  if (quiz.length === 0) {
    return <p className="text-sm text-slate-600">Build quiz questions to begin practice.</p>;
  }

  return (
    <div className="space-y-4">
      {practiceEnabled && !attempt && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-900">
              How confident do you feel about this topic right now?
            </p>
            <p className="text-xs text-slate-500">
              Optional. Helps you notice changes after practice.
            </p>
            {renderConfidenceRow(confidenceBefore, setConfidenceBefore, answeredCount > 0)}
          </CardContent>
        </Card>
      )}

      {practiceEnabled && <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] shadow-sm">
        <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-900">Recall check</p>
            <p className="mt-1 text-sm text-slate-600">
              Answer every question, then review mistakes with cited explanations.
            </p>
          </div>
          {attempt ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-slate-900">
                {attempt.correct_answers}/{attempt.total_questions} correct ({attempt.score_percent}%)
              </p>
              <Button size="sm" variant="outline" onClick={retry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {answeredCount}/{quiz.length} answered
            </p>
          )}
        </CardContent>
      </Card>}

      {quiz.map((item, index) => {
        const result = attempt?.results.find((entry) => entry.item_index === index);
        const showReadOnlyAnswer = !practiceEnabled && readOnlyRevealed[index];

        return (
          <Card key={index} className="rounded-2xl shadow-sm">
            <CardHeader>
              {item.topic && (
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--ck-primary)]">
                  {item.topic}
                </p>
              )}
              <CardTitle className="text-base text-slate-900">
                {item.question}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3">
                {item.choices.map((choice, choiceIdx) => {
                  const selected = answers[index] === choice;
                  const isCorrectAnswer =
                    (result && choice === result.correct_answer) ||
                    (showReadOnlyAnswer && choice === item.answer);
                  const isIncorrectSelection = result && selected && !result.is_correct;
                  const choiceClass = isCorrectAnswer
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : isIncorrectSelection
                      ? "border-red-200 bg-red-50 text-red-700"
                      : selected
                        ? "border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] text-slate-900"
                        : "border-slate-200 bg-white text-slate-700";

                  return (
                    <button
                      key={`${index}-${choiceIdx}`}
                      type="button"
                      disabled={Boolean(attempt) || !practiceEnabled}
                      onClick={() => setAnswers((current) => ({ ...current, [index]: choice }))}
                      className={`rounded-xl border p-3 text-left text-sm transition ${choiceClass} disabled:cursor-default`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>

              {!practiceEnabled && (
                <Button
                  variant="outline"
                  onClick={() =>
                    setReadOnlyRevealed((current) => ({
                      ...current,
                      [index]: !current[index],
                    }))
                  }
                >
                  {showReadOnlyAnswer ? "Hide Answer" : "Reveal Answer"}
                </Button>
              )}

              {result && (
                <div className={`rounded-2xl p-4 ${result.is_correct ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <div className="flex items-start gap-2">
                    {result.is_correct ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    ) : (
                      <CircleAlert className="mt-0.5 h-5 w-5 text-amber-700" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">
                        {result.is_correct ? "Correct." : `Correct answer: ${result.correct_answer}`}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {result.rationale}
                      </p>
                      <EvidenceCitations
                        evidence={result.evidence ?? evidence?.[index]}
                        onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
                        projectId={projectId}
                      />
                    </div>
                  </div>
                </div>
              )}
              {showReadOnlyAnswer && (
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-slate-900">Correct answer: {item.answer}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.rationale}</p>
                      <EvidenceCitations evidence={evidence?.[index]} projectId={projectId} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {practiceEnabled && !attempt && answeredCount === quiz.length && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-slate-900">
              How confident do you feel now?
            </p>
            <p className="text-xs text-slate-500">
              Optional. Saved with this attempt so you can see confidence vs. score over time.
            </p>
            {renderConfidenceRow(confidenceAfter, setConfidenceAfter)}
          </CardContent>
        </Card>
      )}

      {practiceEnabled && !attempt && (
        <div className="space-y-2">
          <Button onClick={submit} disabled={!canSubmit || isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Saving practice..." : "Submit practice"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {attempt && (attempt.confidence_before !== null || attempt.confidence_after !== null) && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-1 p-4">
            <p className="text-sm font-semibold text-slate-900">Confidence delta</p>
            <p className="text-sm text-slate-600">
              Before: {attempt.confidence_before ?? "—"} / 5
              {" · "}After: {attempt.confidence_after ?? "—"} / 5
              {attempt.confidence_before !== null &&
                attempt.confidence_after !== null &&
                ` · ${attempt.confidence_after - attempt.confidence_before >= 0 ? "+" : ""}${attempt.confidence_after - attempt.confidence_before}`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
