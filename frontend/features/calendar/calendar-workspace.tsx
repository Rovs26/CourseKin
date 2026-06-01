"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Flame,
  Image as ImageIcon,
  RotateCw,
  Sparkles,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import {
  createCourseTask,
  deleteCourseTask,
  extractTaskProposals,
  getActiveTaskFocus,
  getCalendarAgenda,
  getTaskStats,
  listCourseTasks,
  startTaskFocus,
  stopTaskFocus,
  updateCourseTask,
  type CalendarAgenda,
  type CalendarAgendaItem,
  type CourseTask,
  type CourseTaskPriority,
  type TaskFocusSession,
  type TaskProposal,
  type TaskRecurrenceRule,
  type TaskStats,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";
import { burstConfetti } from "@/lib/confetti";
import { CalendarSubscribeCard } from "@/features/calendar/calendar-subscribe-card";
import { LoadHeatmap } from "@/features/calendar/load-heatmap";
import { StudyAssistant } from "@/features/planner/study-assistant";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const itemStyles = {
  deadline:
    "border border-amber-200/60 bg-amber-100/70 text-amber-900 backdrop-blur-sm",
  preparation_session:
    "border border-emerald-200/60 bg-emerald-100/70 text-emerald-900 backdrop-blur-sm",
  task: "border border-slate-200/60 bg-white/70 text-slate-800 backdrop-blur-sm",
};

// iOS/macOS glass surface — used across the calendar to feel lighter and more connected.
const glassSurface =
  "rounded-3xl border border-white/50 bg-white/60 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] backdrop-blur-2xl";
const glassSurfaceSubtle =
  "rounded-3xl border border-white/40 bg-white/50 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl";

const itemLabels = {
  deadline: "Deadline",
  preparation_session: "Study",
  task: "Task",
};

function localDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function initialMonth() {
  return localDateValue().slice(0, 7);
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(year, monthNumber, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Date(year, monthNumber - 1 + amount, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function displayMonth(month: string) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(
    new Date(`${month}-01T00:00:00`)
  );
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function monthCells(month: string) {
  const { end } = monthBounds(month);
  const lastDay = Number(end.slice(-2));
  const first = new Date(`${month}-01T00:00:00`);
  const leadingDays = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: leadingDays }, () => null),
    ...Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
  ];
}

function courseName(item: { course_code: string | null; project_title: string }) {
  return item.course_code || item.project_title;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function TaskRow({
  task,
  activeFocus,
  onRefresh,
  onFocusChange,
}: {
  task: CourseTask;
  activeFocus: TaskFocusSession | null;
  onRefresh: () => Promise<void>;
  onFocusChange: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focusedHere = activeFocus?.task_id === task.id;
  const focusBlocked = Boolean(activeFocus) && !focusedHere;

  const toggle = async () => {
    const completing = task.status !== "completed";
    setSaving(true);
    setError(null);
    try {
      await updateCourseTask(task.project_id, task.id, {
        status: completing ? "completed" : "open",
      });
      await onRefresh();
      if (completing) {
        burstConfetti();
        toast.success("Task done", { description: "Nice — keep the streak going." });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this task?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCourseTask(task.project_id, task.id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFocus = async () => {
    setSaving(true);
    setError(null);
    try {
      if (focusedHere) {
        await stopTaskFocus(task.project_id, task.id);
      } else {
        await startTaskFocus(task.project_id, task.id);
      }
      await Promise.all([onFocusChange(), onRefresh()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update focus session.");
    } finally {
      setSaving(false);
    }
  };

  const subtaskRatio = task.subtask_count
    ? `${task.completed_subtask_count}/${task.subtask_count} subtasks`
    : null;

  return (
    <div className={`rounded-2xl border bg-white/70 p-3 backdrop-blur-md transition-colors ${focusedHere ? "border-[var(--ck-primary)] ring-1 ring-[var(--ck-primary-soft)]" : "border-white/50"}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={toggle}
          aria-label={task.status === "completed" ? "Mark task open" : "Complete task"}
          className="mt-0.5 text-[var(--ck-primary)]"
        >
          {task.status === "completed" ? <Check className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${task.status === "completed" ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {task.title}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {courseName(task)}
            {task.due_date ? ` / ${displayDate(task.due_date)}` : " / No date"}
            {` / ${task.priority} priority`}
            {task.recurrence_rule ? ` / repeats ${task.recurrence_rule}` : ""}
            {subtaskRatio ? ` / ${subtaskRatio}` : ""}
            {task.focus_seconds_total ? ` / focused ${formatDuration(task.focus_seconds_total)}` : ""}
          </p>
          {task.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {task.notes && <p className="mt-2 text-sm leading-6 text-slate-600">{task.notes}</p>}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
        <div className="flex items-center gap-1">
          {task.status !== "completed" && (
            <Button
              type="button"
              variant={focusedHere ? "default" : "outline"}
              size="sm"
              disabled={saving || focusBlocked}
              onClick={toggleFocus}
              aria-label={focusedHere ? "Stop focus" : "Start focus"}
              title={focusBlocked ? "Another focus session is running. Stop it first." : focusedHere ? "Stop focus" : "Start focus"}
            >
              <TimerReset className="mr-1 h-4 w-4" />
              {focusedHere ? "Stop" : "Focus"}
            </Button>
          )}
          <Button variant="ghost" size="icon" disabled={saving} onClick={remove} aria-label="Delete task">
            <Trash2 className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaskProposalsModal({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<TaskProposal[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [committing, setCommitting] = useState(false);

  if (!open) return null;

  const reset = () => {
    setText("");
    setImageBase64(undefined);
    setImageName(null);
    setProposals([]);
    setSelected([]);
    setError(null);
    setLoading(false);
    setCommitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleImage = async (file: File | null) => {
    if (!file) {
      setImageBase64(undefined);
      setImageName(null);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be 4MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      setImageBase64(comma >= 0 ? result.slice(comma + 1) : result);
      setImageName(file.name);
      setError(null);
    };
    reader.onerror = () => setError("Could not read image file.");
    reader.readAsDataURL(file);
  };

  const extract = async () => {
    if (!text.trim() && !imageBase64) {
      setError("Paste text or attach a photo first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await extractTaskProposals(projectId, {
        text: text.trim() || undefined,
        image_base64: imageBase64,
      });
      setProposals(result.proposals);
      setSelected(result.proposals.map(() => true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract task proposals.");
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    const picks = proposals.filter((_, idx) => selected[idx]);
    if (picks.length === 0) {
      setError("Select at least one proposal to add.");
      return;
    }
    setCommitting(true);
    setError(null);
    try {
      for (const proposal of picks) {
        await createCourseTask(projectId, {
          title: proposal.title,
          notes: proposal.notes || undefined,
          due_date: proposal.due_date || undefined,
          priority: proposal.priority,
        });
      }
      await onCreated();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create tasks.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="extract-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={close}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h3 id="extract-modal-title" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Sparkles className="h-5 w-5 text-[var(--ck-primary)]" />
            Extract tasks from text or photo
          </h3>
          <button onClick={close} aria-label="Close" className="text-slate-500 hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {proposals.length === 0 ? (
            <>
              <p className="text-sm text-slate-600">
                Paste the relevant chunk of an announcement, email, or board notes.
                You can also attach a photo of a handwritten or printed task list.
                CourseKin proposes structured tasks — you pick which to add.
              </p>
              <div className="space-y-1">
                <Label htmlFor="extract-text">Pasted text</Label>
                <Textarea
                  id="extract-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  className="min-h-[140px]"
                  maxLength={8000}
                  placeholder="Paste an email, syllabus excerpt, or class announcement here..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="extract-image" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Photo (optional, max 4MB)
                </Label>
                <input
                  id="extract-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => handleImage(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-50"
                />
                {imageName && <p className="text-xs text-slate-500">Attached: {imageName}</p>}
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <Button onClick={extract} disabled={loading} className="w-full">
                {loading ? "Extracting..." : "Extract proposals"}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Review each proposal. Untick the ones you don&apos;t want before adding.
              </p>
              <div className="space-y-2">
                {proposals.map((proposal, idx) => (
                  <label
                    key={idx}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selected[idx] ?? true}
                      onChange={(event) => {
                        const next = [...selected];
                        next[idx] = event.target.checked;
                        setSelected(next);
                      }}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{proposal.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {proposal.due_date ? `Due ${displayDate(proposal.due_date)}` : "No date"}
                        {` / ${proposal.priority} priority / ${proposal.confidence} confidence`}
                      </p>
                      {proposal.uncertain_fields.length > 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          Uncertain: {proposal.uncertain_fields.join(", ")}
                        </p>
                      )}
                      {proposal.notes && (
                        <p className="mt-1 text-xs text-slate-600">{proposal.notes}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setProposals([])} disabled={committing}>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Start over
                </Button>
                <Button onClick={commit} disabled={committing} className="flex-1">
                  {committing ? "Adding..." : `Add selected (${selected.filter(Boolean).length})`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarWorkspace() {
  const [month, setMonth] = useState(initialMonth);
  const [agenda, setAgenda] = useState<CalendarAgenda | null>(null);
  const [tasks, setTasks] = useState<CourseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [priority, setPriority] = useState<CourseTaskPriority>("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrenceRule | "none">("none");
  const [projectId, setProjectId] = useState("");
  const [activeFocus, setActiveFocus] = useState<TaskFocusSession | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [extractOpen, setExtractOpen] = useState(false);
  const { projects, isLoading: coursesLoading } = useProjectSummaries();

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projectId, projects]);

  const refreshFocus = useCallback(async () => {
    try {
      const session = await getActiveTaskFocus();
      setActiveFocus(session);
    } catch {
      setActiveFocus(null);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      setStats(await getTaskStats());
    } catch {
      setStats(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const bounds = monthBounds(month);
    try {
      const [calendarResult, taskResult] = await Promise.all([
        getCalendarAgenda(bounds.start, bounds.end),
        listCourseTasks(true),
      ]);
      setAgenda(calendarResult);
      setTasks(taskResult.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar and tasks.");
    } finally {
      setLoading(false);
    }
    await Promise.all([refreshFocus(), refreshStats()]);
  }, [month, refreshFocus, refreshStats]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const parseTags = (raw: string): string[] | undefined => {
    const cleaned = raw
      .split(/[\s,]+/)
      .map((tag) => tag.trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  };

  const addTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!projectId || !taskTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCourseTask(projectId, {
        title: taskTitle.trim(),
        notes: taskNotes.trim() || undefined,
        due_date: taskDate || undefined,
        priority,
        tags: parseTags(tagsInput),
        recurrence_rule: recurrence === "none" ? undefined : recurrence,
      });
      setTaskTitle("");
      setTaskNotes("");
      setTaskDate("");
      setPriority("medium");
      setTagsInput("");
      setRecurrence("none");
      await refresh();
      toast.success("Task added", {
        description: taskDate ? `Due ${displayDate(taskDate)}` : undefined,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create task.";
      setError(message);
      toast.error("Could not add task", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const calendarItems = useMemo(() => {
    const values = new Map<string, CalendarAgendaItem[]>();
    for (const item of agenda?.items ?? []) {
      values.set(item.date, [...(values.get(item.date) ?? []), item]);
    }
    return values;
  }, [agenda]);
  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "completed").slice(0, 4);

  return (
    <div className="relative space-y-6">
      {/* Soft ambient backdrop for the glass surfaces to read against. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-10 -z-10 h-72 bg-gradient-to-br from-sky-100/60 via-violet-100/40 to-rose-100/40 blur-3xl"
      />

      <header className="pb-2">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ck-primary)]">
          Calendar & Tasks
        </p>
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
          Plan the term, one course at a time.
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">
          Confirmed course dates and preparation sessions appear here. Add your own tasks as work
          becomes clear. CourseKin never places an extracted deadline here before you confirm it.
        </p>
      </header>

      {error && (
        <p className="rounded-2xl border border-rose-200/60 bg-rose-50/80 p-3 text-sm text-rose-700 backdrop-blur-sm">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={`${glassSurfaceSubtle} p-4`}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Open tasks</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.open_tasks ?? 0}</p>
        </Card>
        <Card className={`${glassSurfaceSubtle} p-4`}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Past due tasks</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.overdue_tasks ?? 0}</p>
        </Card>
        <Card className={`${glassSurfaceSubtle} p-4`}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Upcoming deadlines</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.upcoming_deadlines ?? 0}</p>
        </Card>
        <Card className={`${glassSurfaceSubtle} p-4`}>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            Streak
          </p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {stats ? `${stats.streak.current_streak_days}d` : "--"}
          </p>
          {stats && (
            <p className="mt-1 text-[11px] text-slate-500">
              {stats.completed_last_7d} done last 7d · focus {formatDuration(stats.focus_seconds_last_7d)}
            </p>
          )}
        </Card>
      </div>

      {activeFocus && (
        <Card className="rounded-3xl border border-[var(--ck-primary-border)]/60 bg-[var(--ck-primary-soft)]/80 p-4 backdrop-blur-xl">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--ck-ink)]">
            <TimerReset className="h-4 w-4 text-[var(--ck-primary)]" />
            Focus session running on a task. Tap &ldquo;Stop&rdquo; on its row to log it.
          </p>
        </Card>
      )}

      <StudyAssistant onConfirmed={refresh} />

      <LoadHeatmap />

      <CalendarSubscribeCard />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className={`${glassSurface} overflow-hidden`}>
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-white/40 bg-white/30 p-4 sm:p-5 backdrop-blur-xl">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <CalendarDays className="h-5 w-5 text-[var(--ck-primary)]" />
                {displayMonth(month)}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Deadlines, study sessions, and dated tasks.
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-white/70 backdrop-blur-md hover:bg-white"
                onClick={() => setMonth(moveMonth(month, -1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-white/70 backdrop-blur-md hover:bg-white"
                onClick={() => setMonth(moveMonth(month, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            {loading ? (
              <div className="space-y-3">
                <div className="grid grid-cols-7 gap-1.5">
                  {weekdays.map((w) => (
                    <Skeleton key={w} className="h-3 w-full" />
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-7 pb-1.5">
                  {weekdays.map((weekday) => (
                    <p
                      key={weekday}
                      className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400"
                    >
                      {weekday}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-[2px] rounded-2xl bg-white/30 p-[2px]">
                  {monthCells(month).map((dateValue, index) => {
                    const items = dateValue ? calendarItems.get(dateValue) ?? [] : [];
                    const isToday = dateValue === localDateValue();
                    return (
                      <div
                        key={dateValue ?? `blank-${index}`}
                        className={`min-h-[88px] rounded-xl p-1.5 transition-colors sm:p-2 ${
                          dateValue
                            ? "bg-white/60 backdrop-blur-sm hover:bg-white/85"
                            : "bg-transparent"
                        }`}
                      >
                        {dateValue && (
                          <>
                            <p
                              className={`mb-1 text-xs ${
                                isToday
                                  ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ck-primary)] font-semibold text-white shadow-sm"
                                  : "text-slate-500"
                              }`}
                            >
                              {Number(dateValue.slice(-2))}
                            </p>
                            <div className="space-y-1">
                              {items.slice(0, 2).map((item) =>
                                item.item_type === "task" ? (
                                  <p
                                    key={`${item.item_type}-${item.id}`}
                                    className={`truncate rounded-md px-1.5 py-1 text-[11px] leading-tight ${itemStyles[item.item_type]} ${item.status === "completed" ? "opacity-50 line-through" : ""}`}
                                  >
                                    {item.title}
                                  </p>
                                ) : (
                                  <Link
                                    key={`${item.item_type}-${item.id}`}
                                    href={routes.coursePlan(item.project_id)}
                                    className={`block truncate rounded-md px-1.5 py-1 text-[11px] leading-tight transition-opacity hover:opacity-90 ${itemStyles[item.item_type]} ${item.status === "completed" ? "opacity-50 line-through" : ""}`}
                                  >
                                    {item.title}
                                  </Link>
                                )
                              )}
                              {items.length > 2 && (
                                <p className="text-[11px] text-slate-500">+{items.length - 2} more</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-1.5 border-t border-white/40 pt-3">
                  {(agenda?.items ?? []).length === 0 ? (
                    <p className="rounded-2xl bg-white/40 p-4 text-sm text-slate-600 backdrop-blur-sm">
                      No dated items this month. Confirm syllabus dates in a course plan or add a task.
                    </p>
                  ) : (
                    agenda?.items.map((item) => {
                      const content = (
                        <>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {courseName(item)} · {itemLabels[item.item_type]}
                              {item.estimated_minutes ? ` · ${item.estimated_minutes} min` : ""}
                            </p>
                          </div>
                          <p className="text-xs font-medium text-slate-600">{displayDate(item.date)}</p>
                        </>
                      );
                      return item.item_type === "task" ? (
                        <div
                          key={`${item.item_type}-${item.id}-agenda`}
                          className="flex flex-col justify-between gap-2 rounded-2xl border border-white/50 bg-white/60 p-3 backdrop-blur-md sm:flex-row sm:items-center"
                        >
                          {content}
                        </div>
                      ) : (
                        <Link
                          key={`${item.item_type}-${item.id}-agenda`}
                          href={routes.coursePlan(item.project_id)}
                          className="flex flex-col justify-between gap-2 rounded-2xl border border-white/50 bg-white/60 p-3 backdrop-blur-md transition-colors hover:bg-white/85 sm:flex-row sm:items-center"
                        >
                          {content}
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={glassSurface}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <ClipboardList className="h-5 w-5 text-[var(--ck-primary)]" />
                Add task
              </CardTitle>
              <p className="text-sm text-slate-500">
                Capture work you want to complete for a course.
              </p>
            </CardHeader>
            <CardContent>
              {projects.length === 0 && !coursesLoading ? (
                <p className="text-sm text-slate-600">
                  <Link className="font-medium text-[var(--ck-primary)]" href={routes.newCourse}>Add a course</Link>{" "}
                  before creating tasks.
                </p>
              ) : (
                <form className="space-y-3" onSubmit={addTask}>
                  <div className="space-y-1">
                    <Label>Course</Label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.course_code || project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="task-title">Task</Label>
                    <Input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={200} placeholder="Read chapter 4" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="task-date">Due date</Label>
                      <Input id="task-date" type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Priority</Label>
                      <Select value={priority} onValueChange={(value) => setPriority(value as CourseTaskPriority)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="task-tags">Tags</Label>
                      <Input
                        id="task-tags"
                        value={tagsInput}
                        onChange={(event) => setTagsInput(event.target.value)}
                        placeholder="readings, midterm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Recurrence</Label>
                      <Select
                        value={recurrence}
                        onValueChange={(value) => setRecurrence(value as TaskRecurrenceRule | "none")}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No repeat</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="task-notes">Notes</Label>
                    <Textarea id="task-notes" value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} maxLength={2000} className="min-h-[72px]" placeholder="Optional details" />
                  </div>
                  <Button type="submit" disabled={saving || !projectId || !taskTitle.trim()} className="w-full">
                    {saving ? "Adding..." : "Add task"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={!projectId}
                    onClick={() => setExtractOpen(true)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Extract from text or photo
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className={glassSurface}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <Clock3 className="h-5 w-5 text-[var(--ck-primary)]" />
                Open tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.length === 0 ? (
                <p className="rounded-2xl bg-white/60 p-3 text-sm text-slate-600 backdrop-blur-sm">
                  No open tasks. Add the next small action for a course.
                </p>
              ) : (
                openTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    activeFocus={activeFocus}
                    onRefresh={refresh}
                    onFocusChange={refreshFocus}
                  />
                ))
              )}
              {completedTasks.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recently completed</p>
                  {completedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      activeFocus={activeFocus}
                      onRefresh={refresh}
                      onFocusChange={refreshFocus}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {projectId && (
        <TaskProposalsModal
          projectId={projectId}
          open={extractOpen}
          onClose={() => setExtractOpen(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
