"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Brain, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/states/empty-state";
import {
  createNotebookCard,
  deleteNotebookCard,
  listNotebookCards,
  reviewNotebookCard,
  type NotebookCard,
} from "@/lib/coursekin-api";

const ORIGIN_LABEL: Record<NotebookCard["origin"], string> = {
  manual: "Manual",
  stream_entry: "From Room",
  quiz_gap: "Quiz gap",
  ai_generated: "AI seeded",
};

const QUALITY_BUTTONS = [
  { quality: 0, label: "Blank", help: "No clue" },
  { quality: 2, label: "Hard", help: "Wrong / barely" },
  { quality: 3, label: "OK", help: "Recalled with effort" },
  { quality: 4, label: "Good", help: "Recalled clearly" },
  { quality: 5, label: "Easy", help: "Trivial" },
];

function displayDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function CardReviewer({
  card,
  projectId,
  onReviewed,
}: {
  card: NotebookCard;
  projectId: string;
  onReviewed: () => Promise<void>;
}) {
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grade = async (quality: number) => {
    setSaving(true);
    setError(null);
    try {
      await reviewNotebookCard(projectId, card.id, quality);
      setRevealed(false);
      await onReviewed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-[var(--ck-primary-soft)] px-2.5 py-1 text-xs font-medium text-[var(--ck-primary)]">
            {ORIGIN_LABEL[card.origin]}
          </span>
          <span className="text-xs text-slate-500">
            ease {card.ease_factor.toFixed(2)} / interval {card.interval_days}d / due {displayDate(card.due_date)}
          </span>
        </div>
        <p className="text-base font-medium text-slate-900 whitespace-pre-wrap">{card.front}</p>
        {revealed ? (
          <div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap">
            {card.back || <span className="italic text-slate-500">No back side recorded.</span>}
          </div>
        ) : (
          <Button variant="outline" onClick={() => setRevealed(true)} className="w-full">
            Reveal answer
          </Button>
        )}
        {revealed && (
          <div className="grid grid-cols-5 gap-2">
            {QUALITY_BUTTONS.map((option) => (
              <Button
                key={option.quality}
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => grade(option.quality)}
                title={option.help}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {card.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  );
}

function CardRow({
  card,
  projectId,
  onChanged,
}: {
  card: NotebookCard;
  projectId: string;
  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const remove = async () => {
    if (!window.confirm("Delete this card?")) return;
    setSaving(true);
    try {
      await deleteNotebookCard(projectId, card.id);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 whitespace-pre-wrap">{card.front}</p>
          {card.back && (
            <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{card.back}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {ORIGIN_LABEL[card.origin]} / due {displayDate(card.due_date)} / interval {card.interval_days}d
          </p>
          {card.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {card.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" disabled={saving} onClick={remove} aria-label="Delete card">
          <Trash2 className="h-4 w-4 text-slate-500" />
        </Button>
      </div>
    </div>
  );
}

export function CourseNotebookWorkspace({ projectId }: { projectId: string }) {
  const [cards, setCards] = useState<NotebookCard[]>([]);
  const [dueNow, setDueNow] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [tags, setTags] = useState("");
  const [adding, setAdding] = useState(false);
  const [queueIndex, setQueueIndex] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listNotebookCards(projectId);
      setCards(result.items);
      setDueNow(result.due_now);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notebook.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dueCards = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return cards.filter((card) => !card.due_date || card.due_date <= today);
  }, [cards]);

  const reviewedNext = useCallback(async () => {
    setQueueIndex((index) => index + 1);
    await refresh();
  }, [refresh]);

  const addCard = async () => {
    if (!front.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const cleanedTags = tags
        .split(/[\s,]+/)
        .map((tag) => tag.trim().toLowerCase().replace(/^#/, ""))
        .filter(Boolean);
      await createNotebookCard(projectId, {
        front: front.trim(),
        back: back.trim() || null,
        tags: cleanedTags.length ? cleanedTags : undefined,
      });
      setFront("");
      setBack("");
      setTags("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save card.");
    } finally {
      setAdding(false);
    }
  };

  if (loading && cards.length === 0) {
    return <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading notebook...</p>;
  }

  const activeReview = dueCards[queueIndex] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ck-primary)]">
          Notebook
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Study cards spaced for recall.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Each card you mark in the Room or that comes from a missed quiz lands here.
          Daily review uses SM-2 scheduling — grade honestly and the interval adapts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Total cards</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{cards.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Due now</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{dueNow}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">From quiz gaps</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {cards.filter((c) => c.origin === "quiz_gap").length}
          </p>
        </Card>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Brain className="h-5 w-5 text-[var(--ck-primary)]" />
            Review session
          </h3>
          {dueCards.length === 0 ? (
            <EmptyState
              title="No cards are due"
              description="Add a card, or convert a stream entry from the Room to start studying."
            />
          ) : activeReview ? (
            <CardReviewer
              card={activeReview}
              projectId={projectId}
              onReviewed={reviewedNext}
            />
          ) : (
            <Card className="rounded-2xl p-6">
              <p className="text-sm text-slate-600">
                You finished the queue for this session. Come back later or add new cards.
              </p>
              <Button variant="outline" className="mt-3" onClick={() => setQueueIndex(0)}>
                Restart queue
              </Button>
            </Card>
          )}

          <div>
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BookOpen className="h-5 w-5 text-[var(--ck-primary)]" />
              All cards
            </h3>
            {cards.length === 0 ? (
              <EmptyState
                title="No cards yet"
                description="Add one with the form on the right, or save a Room entry as a card."
              />
            ) : (
              <div className="space-y-2">
                {cards.map((card) => (
                  <CardRow key={card.id} card={card} projectId={projectId} onChanged={refresh} />
                ))}
              </div>
            )}
          </div>
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Plus className="h-5 w-5 text-[var(--ck-primary)]" />
              Add a card
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="card-front">Front</Label>
              <Textarea
                id="card-front"
                value={front}
                onChange={(event) => setFront(event.target.value)}
                placeholder="What is the question or prompt?"
                maxLength={1000}
                className="min-h-[72px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-back">Back (optional)</Label>
              <Textarea
                id="card-back"
                value={back}
                onChange={(event) => setBack(event.target.value)}
                placeholder="The answer, definition, or explanation."
                maxLength={2000}
                className="min-h-[96px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="card-tags">Tags</Label>
              <Input
                id="card-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="midterm, chapter-3"
              />
            </div>
            <Button onClick={addCard} disabled={adding || !front.trim()} className="w-full">
              {adding ? "Adding..." : "Add card"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
