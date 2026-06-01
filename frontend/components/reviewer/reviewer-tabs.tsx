"use client";

import { useState } from "react";
import type { ReviewerContent, ReviewerFeedbackRating } from "@/types/reviewer";
import { submitReviewerFeedback, type ReviewerSectionId } from "@/lib/coursekin-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryPanel } from "@/components/reviewer/summary-panel";
import { KeyPointsPanel } from "@/components/reviewer/key-points-panel";
import { DefinitionsPanel } from "@/components/reviewer/definitions-panel";
import { QAPanel } from "@/components/reviewer/qa-panel";
import { QuizPanel } from "@/components/reviewer/quiz-panel";
import { FlashcardsPanel } from "@/components/reviewer/flashcards-panel";
import { ChatPanel } from "@/components/reviewer/chat-panel";

export type ReviewerSectionKey =
  | "summary"
  | "key-points"
  | "definitions"
  | "qa"
  | "quiz"
  | "flashcards"
  | "chat";

export function ReviewerTabs({
  content,
  projectId,
  reviewerVersion,
  onRegenerateSection,
  isRegeneratingSection = false,
  onQuizAttemptSaved,
}: {
  content: ReviewerContent;
  projectId: string;
  reviewerVersion: number;
  onRegenerateSection?: (section: ReviewerSectionKey) => void;
  isRegeneratingSection?: boolean;
  onQuizAttemptSaved?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ReviewerSectionKey>("summary");
  const recordFeedback = (
    section: ReviewerSectionId,
    itemIndex?: number
  ) => (rating: ReviewerFeedbackRating) =>
    submitReviewerFeedback(projectId, {
      section,
      item_index: itemIndex,
      rating,
    }).then(() => undefined);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-0">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as ReviewerSectionKey)}
          className="w-full"
        >
          <div className="border-b px-4 pt-4 md:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                <TabsTrigger
                  value="summary"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="key-points"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Key Points
                </TabsTrigger>
                <TabsTrigger
                  value="definitions"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Definitions
                </TabsTrigger>
                <TabsTrigger
                  value="qa"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Q&A
                </TabsTrigger>
                <TabsTrigger
                  value="quiz"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Quiz
                </TabsTrigger>
                <TabsTrigger
                  value="flashcards"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Flashcards
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="text-slate-600 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                >
                  Chat
                </TabsTrigger>
              </TabsList>

              {activeTab !== "chat" && (
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  onClick={() => onRegenerateSection?.(activeTab)}
                  disabled={!onRegenerateSection || isRegeneratingSection}
                >
                  {isRegeneratingSection ? "Updating..." : "Update Section"}
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 md:p-6">
            <TabsContent value="summary">
              <SummaryPanel
                summary={content.summary}
                evidence={content._evidence?.summary}
                onFeedback={recordFeedback("summary")}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="key-points">
              <KeyPointsPanel
                keyPoints={content.key_points}
                evidence={content._evidence?.key_points}
                onFeedback={(index, rating) => recordFeedback("key_points", index)(rating)}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="definitions">
              <DefinitionsPanel
                definitions={content.definitions}
                evidence={content._evidence?.definitions}
                onFeedback={(index, rating) => recordFeedback("definitions", index)(rating)}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="qa">
              <QAPanel
                items={content.qa}
                evidence={content._evidence?.qa}
                onFeedback={(index, rating) => recordFeedback("qa", index)(rating)}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="quiz">
              <QuizPanel
                projectId={projectId}
                reviewerVersion={reviewerVersion}
                quiz={content.quiz}
                evidence={content._evidence?.quiz}
                onFeedback={(index, rating) => recordFeedback("quiz", index)(rating)}
                onAttemptSaved={onQuizAttemptSaved}
              />
            </TabsContent>

            <TabsContent value="flashcards">
              <FlashcardsPanel
                cards={content.flashcards}
                evidence={content._evidence?.flashcards}
                onFeedback={(index, rating) => recordFeedback("flashcards", index)(rating)}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="chat">
              <ChatPanel projectId={projectId} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
