"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import type { ReviewerEvidenceItem, ReviewerFeedbackRating } from "@/types/reviewer";

interface QuizItem {
  question: string;
  choices: string[];
  answer: string;
  rationale: string;
}

export function QuizPanel({
  quiz,
  evidence,
  onFeedback,
}: {
  quiz: QuizItem[];
  evidence?: ReviewerEvidenceItem[];
  onFeedback?: (index: number, rating: ReviewerFeedbackRating) => Promise<void>;
}) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-4">
      {quiz.map((item, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {item.question}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {item.choices.map((choice, choiceIdx) => {
                const isAnswer = choice === item.answer;
                const show = revealed[index];

                return (
                  <div
                    key={`${index}-${choiceIdx}`}
                    className={`rounded-xl border p-3 text-sm ${
                      show && isAnswer
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    {choice}
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              className="rounded-xl border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              onClick={() =>
                setRevealed((prev) => ({ ...prev, [index]: !prev[index] }))
              }
            >
              {revealed[index] ? "Hide Answer" : "Reveal Answer"}
            </Button>

            {revealed[index] && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">
                      Correct Answer: {item.answer}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.rationale}
                    </p>
                    <EvidenceCitations
                      evidence={evidence?.[index]}
                      onFeedback={onFeedback ? (rating) => onFeedback(index, rating) : undefined}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
