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
  Trash2,
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
import { Textarea } from "@/components/ui/textarea";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import {
  createCourseTask,
  deleteCourseTask,
  getCalendarAgenda,
  listCourseTasks,
  updateCourseTask,
  type CalendarAgenda,
  type CalendarAgendaItem,
  type CourseTask,
  type CourseTaskPriority,
} from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const itemStyles = {
  deadline: "border-amber-200 bg-amber-50 text-amber-900",
  preparation_session: "border-emerald-200 bg-emerald-50 text-emerald-900",
  task: "border-slate-200 bg-slate-50 text-slate-800",
};

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

function TaskRow({
  task,
  onRefresh,
}: {
  task: CourseTask;
  onRefresh: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCourseTask(task.project_id, task.id, {
        status: task.status === "completed" ? "open" : "completed",
      });
      await onRefresh();
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
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
          </p>
          {task.notes && <p className="mt-2 text-sm leading-6 text-slate-600">{task.notes}</p>}
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
        <Button variant="ghost" size="icon" disabled={saving} onClick={remove} aria-label="Delete task">
          <Trash2 className="h-4 w-4 text-slate-500" />
        </Button>
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
  const [projectId, setProjectId] = useState("");
  const { projects, isLoading: coursesLoading } = useProjectSummaries();

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projectId, projects]);

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
  }, [month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      });
      setTaskTitle("");
      setTaskNotes("");
      setTaskDate("");
      setPriority("medium");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
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
    <div className="space-y-7">
      <header className="border-b pb-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ck-primary)]">
          Calendar & Tasks
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Plan the term, one course at a time.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Confirmed course dates and preparation sessions appear here. Add your own tasks as work
          becomes clear. CourseKin never places an extracted deadline here before you confirm it.
        </p>
      </header>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Open tasks</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.open_tasks ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Past due tasks</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.overdue_tasks ?? 0}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Upcoming confirmed deadlines</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{agenda?.upcoming_deadlines ?? 0}</p>
        </Card>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-5">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <CalendarDays className="h-5 w-5 text-[var(--ck-primary)]" />
                {displayMonth(month)}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Deadlines, study sessions, and dated tasks.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setMonth(moveMonth(month, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setMonth(moveMonth(month, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading calendar...</p>
            ) : (
              <div>
                <div className="grid grid-cols-7 border-b pb-2">
                  {weekdays.map((weekday) => (
                    <p key={weekday} className="text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                      {weekday}
                    </p>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthCells(month).map((dateValue, index) => {
                    const items = dateValue ? calendarItems.get(dateValue) ?? [] : [];
                    const isToday = dateValue === localDateValue();
                    return (
                      <div
                        key={dateValue ?? `blank-${index}`}
                        className="min-h-[108px] border-b border-r border-slate-100 p-1.5 sm:p-2"
                      >
                        {dateValue && (
                          <>
                            <p className={`mb-1 text-xs ${isToday ? "inline-flex rounded-full bg-[var(--ck-primary)] px-2 py-0.5 font-medium text-white" : "text-slate-500"}`}>
                              {Number(dateValue.slice(-2))}
                            </p>
                            <div className="space-y-1">
                              {items.slice(0, 2).map((item) =>
                                item.item_type === "task" ? (
                                  <p
                                    key={`${item.item_type}-${item.id}`}
                                    className={`truncate rounded border px-1.5 py-1 text-[11px] leading-tight ${itemStyles[item.item_type]} ${item.status === "completed" ? "opacity-50 line-through" : ""}`}
                                  >
                                    {item.title}
                                  </p>
                                ) : (
                                  <Link
                                    key={`${item.item_type}-${item.id}`}
                                    href={routes.coursePlan(item.project_id)}
                                    className={`block truncate rounded border px-1.5 py-1 text-[11px] leading-tight ${itemStyles[item.item_type]} ${item.status === "completed" ? "opacity-50 line-through" : ""}`}
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

                <div className="mt-5 space-y-2 border-t pt-4">
                  {(agenda?.items ?? []).length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                      No dated items this month. Confirm syllabus dates in a course plan or add a task.
                    </p>
                  ) : (
                    agenda?.items.map((item) => {
                      const content = (
                        <>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {courseName(item)} / {itemLabels[item.item_type]}
                              {item.estimated_minutes ? ` / ${item.estimated_minutes} minutes` : ""}
                            </p>
                          </div>
                          <p className="text-xs font-medium text-slate-600">{displayDate(item.date)}</p>
                        </>
                      );
                      return item.item_type === "task" ? (
                        <div
                          key={`${item.item_type}-${item.id}-agenda`}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
                        >
                          {content}
                        </div>
                      ) : (
                        <Link
                          key={`${item.item_type}-${item.id}-agenda`}
                          href={routes.coursePlan(item.project_id)}
                          className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 sm:flex-row sm:items-center"
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

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-4">
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
                  <div className="space-y-1">
                    <Label htmlFor="task-notes">Notes</Label>
                    <Textarea id="task-notes" value={taskNotes} onChange={(event) => setTaskNotes(event.target.value)} maxLength={2000} className="min-h-[72px]" placeholder="Optional details" />
                  </div>
                  <Button type="submit" disabled={saving || !projectId || !taskTitle.trim()} className="w-full">
                    {saving ? "Adding..." : "Add task"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                <Clock3 className="h-5 w-5 text-[var(--ck-primary)]" />
                Open tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openTasks.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  No open tasks. Add the next small action for a course.
                </p>
              ) : (
                openTasks.map((task) => <TaskRow key={task.id} task={task} onRefresh={refresh} />)
              )}
              {completedTasks.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recently completed</p>
                  {completedTasks.map((task) => <TaskRow key={task.id} task={task} onRefresh={refresh} />)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
