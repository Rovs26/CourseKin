"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useObligations } from "@/hooks/use-obligations";
import {
  createMockExam,
  listMockExams,
  type ExamDifficulty,
  type MockExamSummary,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";

const DIFFICULTY_LABELS: Record<ExamDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
};

const STATUS_LABELS: Record<MockExamSummary["status"], string> = {
  in_progress: "In progress",
  submitted: "Submitted",
  abandoned: "Abandoned",
  expired: "Expired",
};

function formatTimestamp(value: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ExamListWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { obligations } = useObligations(projectId);
  const confirmedObligations = obligations.filter((o) => o.status === "confirmed");

  const [items, setItems] = useState<MockExamSummary[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [obligationId, setObligationId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("mixed");
  const [questionCount, setQuestionCount] = useState(10);
  const [targetMinutes, setTargetMinutes] = useState(30);
  const [confidenceBefore, setConfidenceBefore] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newExamId, setNewExamId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setIsLoading(true);
      const result = await listMockExams(projectId);
      setItems(result.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load exams.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleListKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (items.length === 0) return;
      const key = event.key;
      if (key === "ArrowDown" || key === "j") {
        event.preventDefault();
        setActiveIndex((i) => {
          const next = Math.min(items.length - 1, i + 1);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (key === "ArrowUp" || key === "k") {
        event.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(0, i - 1);
          rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (key === "Enter") {
        const exam = items[activeIndex];
        if (exam) {
          event.preventDefault();
          router.push(routes.courseExamSession(projectId, exam.id));
        }
      }
    },
    [items, activeIndex, router, projectId],
  );

  const createExam = async () => {
    setCreating(true);
    setCreateError(null);
    setNewExamId(null);
    try {
      const session = await createMockExam(projectId, {
        obligation_id: obligationId || undefined,
        difficulty,
        target_minutes: targetMinutes,
        question_count: questionCount,
        confidence_before: confidenceBefore,
      });
      setNewExamId(session.id);
      await refresh();
      toast.success("Exam ready", {
        description: `${session.question_count} questions · ${session.target_minutes} min`,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start exam.";
      setCreateError(message);
      toast.error("Could not start exam", { description: message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] shadow-sm">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-1 h-6 w-6 text-[var(--ck-primary)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--ck-ink)]">Exams</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--ck-ink)]">
                Timed mock exams from your reviewer material.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-700">
                CourseKin samples questions from your reviewers, weights them by the topics
                your obligations emphasize, and biases harder questions toward topics you
                have struggled with before. Missed questions are added to your Notebook for
                spaced review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">New mock exam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Related obligation (optional)</Label>
              <Select
                value={obligationId || "none"}
                onValueChange={(value) => setObligationId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No specific obligation</SelectItem>
                  {confirmedObligations.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Picking an obligation focuses questions on its topic weights.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as ExamDifficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DIFFICULTY_LABELS) as ExamDifficulty[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {DIFFICULTY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Questions</Label>
                <Input
                  type="number"
                  min={3}
                  max={50}
                  value={questionCount}
                  onChange={(event) =>
                    setQuestionCount(
                      Math.max(3, Math.min(50, Number(event.target.value) || 10)),
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Time (min)</Label>
                <Input
                  type="number"
                  min={5}
                  max={180}
                  value={targetMinutes}
                  onChange={(event) =>
                    setTargetMinutes(
                      Math.max(5, Math.min(180, Number(event.target.value) || 30)),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confidence before (1–5, optional)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={confidenceBefore ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setConfidenceBefore(null);
                    return;
                  }
                  const parsed = Math.max(1, Math.min(5, Number(raw)));
                  setConfidenceBefore(Number.isFinite(parsed) ? parsed : null);
                }}
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <Button className="w-full" onClick={createExam} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Building exam...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Start timed exam
                </>
              )}
            </Button>
            {newExamId && (
              <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
                Exam ready —{" "}
                <Link
                  href={routes.courseExamSession(projectId, newExamId)}
                  className="font-medium underline"
                >
                  open it now
                </Link>
                .
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Past exams</CardTitle>
            {items.length > 0 && (
              <span className="text-xs text-slate-400">
                ↑↓ / j k to move · Enter to open
              </span>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ul className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </li>
                ))}
              </ul>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-600">
                No exams yet. Build one from your reviewer material on the left.
              </p>
            ) : (
              <ul
                className="space-y-2 outline-none"
                tabIndex={0}
                role="listbox"
                aria-label="Past exams"
                onKeyDown={handleListKeyDown}
              >
                {items.map((exam, index) => (
                  <li
                    key={exam.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => setActiveIndex(index)}
                    className={`rounded-xl border p-3 transition ${
                      index === activeIndex
                        ? "border-[var(--ck-primary)] ring-1 ring-[var(--ck-primary)]"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {exam.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {DIFFICULTY_LABELS[exam.difficulty]} · {exam.question_count}{" "}
                          questions · {exam.target_minutes} min
                        </p>
                        <p className="text-xs text-slate-500">
                          Started: {formatTimestamp(exam.started_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            exam.status === "submitted"
                              ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                              : exam.status === "expired"
                                ? "rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                                : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                          }
                        >
                          {STATUS_LABELS[exam.status]}
                        </span>
                        {exam.score_percent !== null && (
                          <p className="mt-1 text-xs text-slate-600">
                            Score: {exam.score_percent}%
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={routes.courseExamSession(projectId, exam.id)}>
                          Open
                          <ArrowRight className="ml-2 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
