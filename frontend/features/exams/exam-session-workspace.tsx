"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronLeft, Clock, HelpCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getMockExam,
  selfGradeMockExam,
  submitMockExam,
  type ExamQuestion,
  type MockExamSession,
  type QuestionVerdict,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";

function formatRemaining(ms: number) {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function QuestionInput({
  question,
  value,
  onChange,
  disabled,
}: {
  question: ExamQuestion;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) {
  if (question.type === "mcq") {
    return (
      <div className="space-y-2">
        {question.choices.map((choice) => (
          <label
            key={choice}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50"
          >
            <input
              type="radio"
              name={question.id}
              value={choice}
              checked={value === choice}
              onChange={() => onChange(choice)}
              disabled={disabled}
              className="mt-1 accent-[var(--ck-primary)]"
            />
            <span className="text-sm text-slate-800">{choice}</span>
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "fill_blank") {
    return (
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Type the missing word or phrase"
      />
    );
  }
  return (
    <Textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder="Write your answer"
      className="min-h-[100px]"
    />
  );
}

export function ExamSessionWorkspace({
  projectId,
  examId,
}: {
  projectId: string;
  examId: string;
}) {
  const [session, setSession] = useState<MockExamSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confidenceAfter, setConfidenceAfter] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [gradingId, setGradingId] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const fetchSession = useCallback(async () => {
    try {
      const result = await getMockExam(projectId, examId);
      setSession(result);
      setAnswers((current) =>
        Object.keys(current).length ? current : result.answers || {},
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load exam.");
    }
  }, [projectId, examId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingMs = useMemo(() => {
    if (!session) return 0;
    try {
      return new Date(session.deadline_at).getTime() - now;
    } catch {
      return 0;
    }
  }, [session, now]);

  const isInProgress = session?.status === "in_progress";
  const isExpired = isInProgress && remainingMs <= 0;

  const submit = useCallback(
    async (auto = false) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const result = await submitMockExam(projectId, examId, {
          answers,
          confidence_after: confidenceAfter,
        });
        setSession(result);
      } catch (err) {
        submittedRef.current = false;
        setSubmitError(
          err instanceof Error
            ? err.message
            : auto
              ? "Auto-submit failed. Try submitting manually."
              : "Could not submit exam.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [session, projectId, examId, answers, confidenceAfter],
  );

  useEffect(() => {
    if (isExpired && !submittedRef.current) {
      void submit(true);
    }
  }, [isExpired, submit]);

  const selfGrade = useCallback(
    async (questionId: string, verdict: "correct" | "incorrect") => {
      setGradingId(questionId);
      setSubmitError(null);
      try {
        const result = await selfGradeMockExam(projectId, examId, {
          question_id: questionId,
          verdict,
        });
        setSession(result);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Could not save your grade.",
        );
      } finally {
        setGradingId(null);
      }
    },
    [projectId, examId],
  );

  if (error) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-red-600">{error}</CardContent>
      </Card>
    );
  }
  if (!session) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-sm text-slate-500">
          Loading exam...
        </CardContent>
      </Card>
    );
  }

  const graded = session.status === "submitted";
  const perQuestionVerdict = session.per_question_verdict ?? {};
  const perQuestionCorrect = session.per_question_correct ?? {};
  const verdictFor = (questionId: string): QuestionVerdict => {
    const v = perQuestionVerdict[questionId];
    if (v) return v;
    // Older sessions only have the boolean map.
    if (questionId in perQuestionCorrect) {
      return perQuestionCorrect[questionId] ? "correct" : "incorrect";
    }
    return "unverified";
  };
  const unverifiedCount =
    session.unverified_count ??
    session.questions.filter((q) => verdictFor(q.id) === "unverified").length;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <Link
              href={routes.courseExams(projectId)}
              className="inline-flex items-center text-xs text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Back to exams
            </Link>
            <CardTitle className="mt-1 text-lg">{session.title}</CardTitle>
            <p className="text-xs text-slate-500">
              {session.question_count} questions · {session.target_minutes} min ·{" "}
              {session.difficulty}
            </p>
          </div>
          <div className="text-right">
            {isInProgress ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800">
                <Clock className="h-3.5 w-3.5" />
                {formatRemaining(remainingMs)}
              </span>
            ) : graded ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Score {session.score_percent}%
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700">
                <XCircle className="h-3.5 w-3.5" />
                Expired
              </span>
            )}
          </div>
        </CardHeader>
        {graded && (
          <CardContent className="space-y-3">
            {unverifiedCount > 0 && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                {unverifiedCount} free-text answer
                {unverifiedCount === 1 ? "" : "s"} couldn&apos;t be auto-checked.
                Compare each against the expected answer below and mark whether you
                got it — your score updates as you do.
              </p>
            )}
            {typeof session.remedial_cards_created === "number" &&
              session.remedial_cards_created > 0 && (
                <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                  Added {session.remedial_cards_created} remedial flashcard
                  {session.remedial_cards_created === 1 ? "" : "s"} to your Notebook for
                  topics you missed.
                </p>
              )}
            {session.per_topic_results.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Per-topic accuracy
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {session.per_topic_results.map((row) => (
                    <div
                      key={row.topic}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <p className="text-sm font-medium text-slate-800">{row.topic}</p>
                      <p className="text-xs text-slate-500">
                        {row.correct}/{row.total} correct · {row.accuracy_percent}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <div className="space-y-4">
        {session.questions.map((question, index) => {
          const verdict = verdictFor(question.id);
          const given = (session.answers && session.answers[question.id]) || "";
          const userValue = graded ? given : answers[question.id] || "";
          return (
            <Card key={question.id} className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Question {index + 1} · {question.topic}
                  </p>
                  <CardTitle className="mt-1 text-base font-medium">
                    {question.prompt}
                  </CardTitle>
                </div>
                {graded && (
                  <span
                    className={
                      verdict === "correct"
                        ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                        : verdict === "incorrect"
                          ? "inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                          : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                    }
                  >
                    {verdict === "correct" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : verdict === "incorrect" ? (
                      <XCircle className="h-3 w-3" />
                    ) : (
                      <HelpCircle className="h-3 w-3" />
                    )}
                    {verdict === "correct"
                      ? "Correct"
                      : verdict === "incorrect"
                        ? "Missed"
                        : "Needs review"}
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <QuestionInput
                  question={question}
                  value={userValue}
                  onChange={(next) =>
                    setAnswers((current) => ({ ...current, [question.id]: next }))
                  }
                  disabled={graded || !isInProgress}
                />
                {graded && question.answer && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <p>
                      <span className="font-semibold">Expected:</span>{" "}
                      {question.answer}
                    </p>
                    {question.rationale && (
                      <p className="mt-1">
                        <span className="font-semibold">Rationale:</span>{" "}
                        {question.rationale}
                      </p>
                    )}
                  </div>
                )}
                {graded && verdict === "unverified" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-800">
                      We couldn&apos;t auto-check this answer. Compare yours with the
                      expected answer and grade yourself honestly.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={gradingId === question.id}
                        onClick={() => void selfGrade(question.id, "correct")}
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        I got it right
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={gradingId === question.id}
                        onClick={() => void selfGrade(question.id, "incorrect")}
                        className="border-rose-300 text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        I missed it
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isInProgress && (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <Label>Confidence after (1–5, optional)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={confidenceAfter ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setConfidenceAfter(null);
                    return;
                  }
                  const parsed = Math.max(1, Math.min(5, Number(raw)));
                  setConfidenceAfter(Number.isFinite(parsed) ? parsed : null);
                }}
              />
            </div>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <Button onClick={() => void submit(false)} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit exam"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
