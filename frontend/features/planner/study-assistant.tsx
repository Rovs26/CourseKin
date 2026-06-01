"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  SendHorizonal,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { burstConfetti } from "@/lib/confetti";
import {
  chatWithAssistant,
  createPlannerBlocks,
  type AssistantChatMessage,
  type PlannerKind,
  type PlannerSuggestion,
} from "@/lib/coursekin-api";

type EditableSuggestion = PlannerSuggestion & { project_id: string | null };

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  suggestions?: EditableSuggestion[];
  confirmed?: number; // count of blocks added once confirmed
};

const NO_COURSE = "__none__";

const kindStyles: Record<PlannerKind, string> = {
  study: "bg-emerald-100/80 text-emerald-800",
  review: "bg-sky-100/80 text-sky-800",
  exercise: "bg-orange-100/80 text-orange-800",
  errand: "bg-violet-100/80 text-violet-800",
  personal: "bg-slate-100/80 text-slate-700",
  other: "bg-slate-100/80 text-slate-700",
};

const QUICK_PROMPTS = [
  "What should I work on next?",
  "Plan my day",
  "Quiz me on my hardest topic",
  "I'm feeling unmotivated",
];

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function StudyAssistant({
  onConfirmed,
  compact = false,
}: {
  onConfirmed?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { projects } = useProjectSummaries();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [committingIndex, setCommittingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, sending]);

  const send = async (raw?: string) => {
    const message = (raw ?? input).trim();
    if (!message || sending) return;
    setError(null);
    const history: AssistantChatMessage[] = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));
    setTurns((prev) => [...prev, { role: "user", content: message }]);
    setInput("");
    setSending(true);
    try {
      const result = await chatWithAssistant({ message, history });
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          suggestions:
            result.mode === "plan"
              ? result.suggestions.map((s) => ({ ...s, project_id: null }))
              : undefined,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "The assistant is unavailable.";
      setError(msg);
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry — ${msg}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const updateSuggestion = (
    turnIndex: number,
    sugIndex: number,
    patch: Partial<EditableSuggestion>
  ) => {
    setTurns((prev) =>
      prev.map((t, i) => {
        if (i !== turnIndex || !t.suggestions) return t;
        return {
          ...t,
          suggestions: t.suggestions.map((s, j) =>
            j === sugIndex ? { ...s, ...patch } : s
          ),
        };
      })
    );
  };

  const removeSuggestion = (turnIndex: number, sugIndex: number) => {
    setTurns((prev) =>
      prev.map((t, i) => {
        if (i !== turnIndex || !t.suggestions) return t;
        return {
          ...t,
          suggestions: t.suggestions.filter((_, j) => j !== sugIndex),
        };
      })
    );
  };

  const confirmPlan = async (turnIndex: number) => {
    const turn = turns[turnIndex];
    if (!turn?.suggestions || turn.suggestions.length === 0) return;
    setCommittingIndex(turnIndex);
    setError(null);
    try {
      await createPlannerBlocks(
        turn.suggestions.map((s) => ({
          title: s.title,
          kind: s.kind,
          scheduled_date: s.scheduled_date,
          start_time: s.start_time,
          duration_minutes: s.duration_minutes,
          notes: s.notes,
          project_id: s.project_id,
        }))
      );
      burstConfetti();
      const count = turn.suggestions.length;
      toast.success("Plan added", {
        description: `${count} block${count === 1 ? "" : "s"} scheduled.`,
      });
      setTurns((prev) =>
        prev.map((t, i) =>
          i === turnIndex ? { ...t, suggestions: undefined, confirmed: count } : t
        )
      );
      await onConfirmed?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save your plan.";
      setError(msg);
      toast.error("Could not save plan", { description: msg });
    } finally {
      setCommittingIndex(null);
    }
  };

  return (
    <Card className="flex flex-col rounded-3xl border border-white/50 bg-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <Wand2 className="h-5 w-5 text-[var(--ck-primary)]" />
          Study assistant
        </CardTitle>
        <p className="text-sm text-slate-500">
          Your tutor, advisor, study buddy, and day planner in one chat. Ask what
          to work on, plan your day, or get something explained.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          ref={threadRef}
          className={`space-y-3 overflow-y-auto pr-1 ${compact ? "max-h-[320px]" : "max-h-[460px]"}`}
        >
          {turns.length === 0 ? (
            <div className="rounded-2xl border border-white/50 bg-white/50 p-4 text-sm text-slate-600 backdrop-blur-md">
              <p className="flex items-center gap-2 font-medium text-slate-800">
                <Sparkles className="h-4 w-4 text-[var(--ck-primary)]" />
                Hi! How can I help you study today?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs text-slate-700 transition-colors hover:bg-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn, turnIndex) =>
              turn.role === "user" ? (
                <div key={turnIndex} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--ck-primary)] px-3 py-2 text-sm text-white">
                    {turn.content}
                  </p>
                </div>
              ) : (
                <div key={turnIndex} className="flex flex-col gap-2">
                  <p className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-white/50 bg-white/70 px-3 py-2 text-sm leading-6 text-slate-800 backdrop-blur-md">
                    {turn.content}
                  </p>
                  {turn.confirmed != null && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Added {turn.confirmed} block{turn.confirmed === 1 ? "" : "s"} to your day.
                    </p>
                  )}
                  {turn.suggestions && turn.suggestions.length > 0 && (
                    <div className="space-y-2 rounded-2xl border border-white/50 bg-white/40 p-2 backdrop-blur-md">
                      {turn.suggestions.map((s, sugIndex) => (
                        <div
                          key={sugIndex}
                          className={`rounded-xl border p-2.5 ${
                            s.conflict
                              ? "border-amber-300/70 bg-amber-50/60"
                              : "border-white/60 bg-white/80"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <Input
                              value={s.title}
                              onChange={(event) =>
                                updateSuggestion(turnIndex, sugIndex, {
                                  title: event.target.value,
                                })
                              }
                              maxLength={100}
                              className="h-8 flex-1 bg-white/90 text-sm"
                            />
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${kindStyles[s.kind]}`}
                            >
                              {s.kind}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeSuggestion(turnIndex, sugIndex)}
                              aria-label="Remove block"
                            >
                              <Trash2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
                            <span className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                              {displayDate(s.scheduled_date)}
                            </span>
                            <label className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                              <Input
                                type="time"
                                value={s.start_time ?? ""}
                                onChange={(event) =>
                                  updateSuggestion(turnIndex, sugIndex, {
                                    start_time: event.target.value || null,
                                  })
                                }
                                className="h-7 w-[104px] bg-white/90"
                              />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={15}
                                max={480}
                                step={5}
                                value={s.duration_minutes}
                                onChange={(event) =>
                                  updateSuggestion(turnIndex, sugIndex, {
                                    duration_minutes: Number(event.target.value) || 30,
                                  })
                                }
                                className="h-7 w-[68px] bg-white/90"
                              />
                              min
                            </label>
                            {s.conflict && (
                              <span className="font-medium text-amber-700">No open slot</span>
                            )}
                          </div>
                          {projects.length > 0 && (
                            <Select
                              value={s.project_id ?? NO_COURSE}
                              onValueChange={(value) =>
                                updateSuggestion(turnIndex, sugIndex, {
                                  project_id: value === NO_COURSE ? null : value,
                                })
                              }
                            >
                              <SelectTrigger className="mt-2 h-7 bg-white/90 text-xs">
                                <SelectValue placeholder="Link a course (optional)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_COURSE}>No course</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    {project.course_code || project.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                      <Button
                        onClick={() => confirmPlan(turnIndex)}
                        disabled={committingIndex === turnIndex}
                        className="w-full"
                        size="sm"
                      >
                        {committingIndex === turnIndex
                          ? "Adding..."
                          : `Add to my day (${turn.suggestions.length})`}
                      </Button>
                    </div>
                  )}
                </div>
              )
            )
          )}
          {sending && (
            <div className="flex justify-start">
              <p className="rounded-2xl rounded-bl-sm border border-white/50 bg-white/70 px-3 py-2 text-sm text-slate-400 backdrop-blur-md">
                Thinking...
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            maxLength={4000}
            rows={1}
            className="min-h-[44px] flex-1 resize-none bg-white/80"
            placeholder="Ask anything, or tell me what you plan to do today..."
          />
          <Button
            onClick={() => void send()}
            disabled={sending || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Send"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
