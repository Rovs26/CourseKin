"use client";

import { FormEvent, useRef, useState } from "react";
import { AlertCircle, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceCitations } from "@/components/reviewer/evidence-citations";
import {
  askNotebookChat,
  type NotebookChatMode,
} from "@/lib/coursekin-api";
import type { ReviewerEvidenceItem } from "@/types/reviewer";

type ChatTurn = {
  id: string;
  question: string;
  status: "answered" | "insufficient_evidence";
  answer: string | null;
  evidence: ReviewerEvidenceItem;
};

const MODE_OPTIONS: { value: NotebookChatMode; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "simplified", label: "Simpler" },
  { value: "step_by_step", label: "Step by step" },
  { value: "example_first", label: "Example first" },
];

export function ChatPanel({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<NotebookChatMode>("standard");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await askNotebookChat(projectId, trimmed, mode);
      setTurns((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          question: trimmed,
          status: result.answer_status,
          answer: result.answer_content,
          evidence: {
            status: result.answer_evidence.status,
            citations: result.answer_evidence.citations,
          },
        },
      ]);
      setQuestion("");
      requestAnimationFrame(() =>
        listEndRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not get an answer. Please try again."
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] p-3 text-sm text-[var(--ck-ink)]">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ck-primary)]" />
        <p>
          Ask anything about this course. Answers come only from your processed
          materials, with citations you can open — never from outside the web.
        </p>
      </div>

      {turns.length > 0 && (
        <div className="space-y-4">
          {turns.map((turn) => (
            <Card key={turn.id} className="rounded-2xl shadow-sm">
              <CardContent className="space-y-3 p-4">
                <p className="flex gap-2 text-sm font-medium text-slate-900">
                  <span className="text-[var(--ck-primary)]">You</span>
                  <span className="text-slate-700">{turn.question}</span>
                </p>
                {turn.status === "answered" ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {turn.answer}
                    </p>
                    <EvidenceCitations
                      evidence={turn.evidence}
                      projectId={projectId}
                    />
                  </>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Your materials don&rsquo;t cover this yet, so there&rsquo;s no
                      grounded answer. Try rephrasing, or add a source that covers it.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <div ref={listEndRef} />
        </div>
      )}

      <form onSubmit={ask} className="space-y-3">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              void ask(event);
            }
          }}
          placeholder="e.g. Explain how the citric acid cycle produces ATP"
          rows={3}
          className="resize-none rounded-2xl"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  mode === option.value
                    ? "border-[var(--ck-primary)] bg-[var(--ck-primary)] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-[var(--ck-primary-border)] hover:text-[var(--ck-primary)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="submit"
            disabled={pending || !question.trim()}
            className="rounded-xl"
          >
            <Send className="mr-1.5 h-4 w-4" />
            {pending ? "Thinking…" : "Ask"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
