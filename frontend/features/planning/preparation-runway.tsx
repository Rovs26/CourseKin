"use client";

import { useEffect, useState } from "react";
import { BellRing, BookOpenCheck, CalendarClock, Check, CircleAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreparationRunway } from "@/hooks/use-preparation-runway";
import {
  buildPreparationRunway,
  getReminderPreferences,
  updateReminderPreferences,
  updatePreparationMilestone,
  type PreparationMilestone,
  type PreparationRunwayItem,
} from "@/lib/coursekin-api";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function MilestoneRow({
  item,
  projectId,
  onSaved,
}: {
  item: PreparationMilestone;
  projectId: string;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = async (status: "planned" | "completed" | "skipped") => {
    setSaving(true);
    setError(null);
    try {
      await updatePreparationMilestone(projectId, item.id, status);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update preparation session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
      item.status === "completed" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
    }`}>
      <div>
        <p className={`text-sm font-medium ${item.status === "skipped" ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {item.title}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {displayDate(item.scheduled_date)} / {item.estimated_minutes} minutes
        </p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex gap-2">
        {item.status === "completed" ? (
          <Button size="sm" variant="outline" onClick={() => update("planned")} disabled={saving}>
            Undo
          </Button>
        ) : (
          <Button size="sm" onClick={() => update("completed")} disabled={saving || item.status === "skipped"}>
            <Check className="mr-1 h-4 w-4" /> Done
          </Button>
        )}
        {item.status !== "completed" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => update(item.status === "skipped" ? "planned" : "skipped")}
            disabled={saving}
          >
            {item.status === "skipped" ? "Restore" : "Skip"}
          </Button>
        )}
      </div>
    </div>
  );
}

function AssessmentCard({
  item,
  projectId,
  onSaved,
}: {
  item: PreparationRunwayItem;
  projectId: string;
  onSaved: () => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{item.obligation.title}</CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              {item.obligation.due_date ? `Due ${displayDate(item.obligation.due_date)}` : "Confirm a due date to plan sessions"}
            </p>
          </div>
          <span className="rounded-full bg-[var(--ck-primary-soft)] px-3 py-1 text-xs font-medium text-[var(--ck-primary)]">
            {item.preparation_progress_percent}% complete
          </span>
        </div>
        {item.milestones.length > 0 && <Progress value={item.preparation_progress_percent} className="mt-3 h-2" />}
      </CardHeader>
      <CardContent className="space-y-3">
        {item.next_action && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Next: {item.next_action}
          </p>
        )}
        {item.missing_materials.map((message) => (
          <p key={message} className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {message}
          </p>
        ))}
        {item.milestones.map((milestone) => (
          <MilestoneRow key={milestone.id} item={milestone} projectId={projectId} onSaved={onSaved} />
        ))}
      </CardContent>
    </Card>
  );
}

function ReminderPreferences({ projectId }: { projectId: string }) {
  const [enabled, setEnabled] = useState(true);
  const [leadDays, setLeadDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReminderPreferences(projectId)
      .then((result) => {
        if (!cancelled) {
          setEnabled(result.enabled);
          setLeadDays(result.lead_days);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : "Could not load reminder settings.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const savePreferences = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateReminderPreferences(projectId, {
        enabled,
        lead_days: leadDays,
      });
      setEnabled(result.enabled);
      setLeadDays(result.lead_days);
      setMessage("Reminder settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save reminder settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BellRing className="h-5 w-5 text-[var(--ck-primary)]" />
            In-app Reminders
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Show upcoming preparation prompts on your dashboard. Email and push notifications are not enabled.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Loading reminder settings...</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dashboard reminders</Label>
              <Select value={enabled ? "enabled" : "disabled"} onValueChange={(value) => setEnabled(value === "enabled")}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">On</SelectItem>
                  <SelectItem value="disabled">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Show sessions ahead</Label>
              <Select value={String(leadDays)} onValueChange={(value) => setLeadDays(Number(value))} disabled={!enabled}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Due today</SelectItem>
                  <SelectItem value="1">1 day before</SelectItem>
                  <SelectItem value="3">3 days before</SelectItem>
                  <SelectItem value="7">7 days before</SelectItem>
                  <SelectItem value="14">14 days before</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={savePreferences} disabled={saving}>
              {saving ? "Saving..." : "Save Reminders"}
            </Button>
          </div>
        )}
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </CardContent>
    </Card>
  );
}

export function PreparationRunway({ projectId, refreshToken }: { projectId: string; refreshToken: number }) {
  const [capacity, setCapacity] = useState(120);
  const [building, setBuilding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { runway, isLoading, error, refetch, setRunway } = usePreparationRunway(
    projectId,
    capacity,
    refreshToken
  );

  const buildPlan = async () => {
    setBuilding(true);
    setActionError(null);
    try {
      setRunway(await buildPreparationRunway(projectId, capacity));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not build preparation plan.");
    } finally {
      setBuilding(false);
    }
  };

  if (isLoading) {
    return <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading preparation runway...</p>;
  }
  if (error || !runway) {
    return <p className="rounded-2xl border bg-white p-6 text-sm text-red-600">{error ?? "Unable to load preparation runway."}</p>;
  }

  const hasConfirmed = runway.items.length > 0;
  const heavyDays = runway.daily_load.filter((day) => day.exceeds_capacity);

  return (
    <section className="space-y-4">
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <CalendarClock className="h-5 w-5 text-[var(--ck-primary)]" />
                Preparation Runway
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                CourseKin spreads focused preparation steps before confirmed deadlines. These are suggestions, not calendar events.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Daily study capacity</Label>
                <Select value={String(capacity)} onValueChange={(value) => setCapacity(Number(value))}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="180">3 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={buildPlan} disabled={!hasConfirmed || building}>
                <Sparkles className="mr-2 h-4 w-4" />
                {building ? "Balancing..." : runway.total_sessions ? "Rebalance Plan" : "Build Plan"}
              </Button>
            </div>
          </div>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          {hasConfirmed ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Confirmed deadlines</p>
                <p className="text-xl font-semibold text-slate-900">{runway.items.length}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Preparation sessions</p>
                <p className="text-xl font-semibold text-slate-900">{runway.completed_sessions}/{runway.total_sessions}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Plan progress</p>
                <p className="text-xl font-semibold text-slate-900">{runway.preparation_progress_percent}%</p>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Confirm at least one dated syllabus obligation above to build a preparation runway.
            </p>
          )}
          {heavyDays.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {heavyDays.length} day(s) exceed your chosen capacity because deadlines are close together. Consider adjusting the capacity or starting earlier.
            </p>
          )}
        </CardContent>
      </Card>

      <ReminderPreferences projectId={projectId} />

      {runway.confirmed_without_due_date.length > 0 && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {runway.confirmed_without_due_date.length} confirmed item(s) still need a due date before preparation sessions can be scheduled.
        </p>
      )}
      {runway.items.map((item) => (
        <AssessmentCard key={item.obligation.id} item={item} projectId={projectId} onSaved={refetch} />
      ))}
      {runway.total_sessions > 0 && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <BookOpenCheck className="h-4 w-4" />
          Progress tracks completed preparation sessions only; mastery will be measured through later practice features.
        </p>
      )}
    </section>
  );
}
