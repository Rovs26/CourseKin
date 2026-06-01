"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getObligationReadiness,
  getObligationSourceCoverage,
  getProjectCoverage,
  updateObligationTopics,
  type CoverageBucket,
  type ObligationReadiness,
  type ObligationSourceCoverage,
  type ProjectCoverage,
} from "@/lib/coursekin-api";

const BUCKET_STYLES: Record<CoverageBucket, string> = {
  untested: "bg-slate-100 text-slate-600",
  weak: "bg-rose-50 text-rose-700",
  developing: "bg-amber-50 text-amber-800",
  strong: "bg-emerald-50 text-emerald-800",
};

function readinessLabel(percent: number | null): string {
  return percent === null ? "—" : `${percent}%`;
}

function displayDate(value: string | null): string {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function ObligationCoverageDetail({
  projectId,
  obligationId,
}: {
  projectId: string;
  obligationId: string;
}) {
  const [readiness, setReadiness] = useState<ObligationReadiness | null>(null);
  const [sourceCoverage, setSourceCoverage] =
    useState<ObligationSourceCoverage | null>(null);
  const [topicsInput, setTopicsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [readinessData, coverageData] = await Promise.all([
        getObligationReadiness(projectId, obligationId),
        getObligationSourceCoverage(projectId, obligationId),
      ]);
      setReadiness(readinessData);
      setSourceCoverage(coverageData);
      setTopicsInput(readinessData.topics.map((row) => row.topic).join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load readiness.");
    } finally {
      setLoading(false);
    }
  }, [projectId, obligationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTopics = async () => {
    const cleaned = topicsInput
      .split(/[,;\n]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      await updateObligationTopics(projectId, obligationId, cleaned);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save topics.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading topic readiness...</p>;
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">
          Topics covered (comma-separated)
        </label>
        <Input
          value={topicsInput}
          onChange={(event) => setTopicsInput(event.target.value)}
          placeholder="kinematics, energy, momentum"
        />
        <Button size="sm" onClick={saveTopics} disabled={saving}>
          {saving ? "Saving..." : "Save topics"}
        </Button>
      </div>

      {readiness && readiness.has_weights && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
          <p className="font-semibold uppercase tracking-wide">
            Exam readiness (weighted)
          </p>
          <p className="mt-1 text-lg font-semibold">
            {readinessLabel(readiness.exam_readiness_percent)}
          </p>
          <p className="mt-1 text-[11px] text-violet-800">
            Weighted by syllabus topic percentages. Untested topics count as
            zero against their weight share.
          </p>
        </div>
      )}

      {readiness && readiness.review_order.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs">
          <p className="font-semibold uppercase tracking-wide text-slate-600">
            Suggested review order
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-800">
            {readiness.review_order.slice(0, 5).map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ol>
          <p className="mt-1 text-[11px] text-slate-500">
            Higher syllabus weight and lower current readiness rank earlier.
          </p>
        </div>
      )}

      {readiness && readiness.topics.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="pb-2">Topic</th>
              <th className="pb-2">Weight</th>
              <th className="pb-2">Readiness</th>
              <th className="pb-2">Cards due</th>
              <th className="pb-2">Coverage</th>
            </tr>
          </thead>
          <tbody>
            {readiness.topics.map((row) => (
              <tr key={row.topic} className="border-t border-slate-100">
                <td className="py-1.5">{row.topic}</td>
                <td className="py-1.5">
                  {row.weight_percent === null
                    ? "—"
                    : `${Math.round(row.weight_percent)}%`}
                </td>
                <td className="py-1.5">{readinessLabel(row.readiness_percent)}</td>
                <td className="py-1.5">
                  {row.cards_due}/{row.cards_total}
                </td>
                <td className="py-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${BUCKET_STYLES[row.coverage]}`}>
                    {row.coverage}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sourceCoverage && sourceCoverage.topics.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Material coverage map
          </p>
          {sourceCoverage.missing_topics.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              No material covers: {sourceCoverage.missing_topics.join(", ")}
            </p>
          )}
          <ul className="space-y-1.5">
            {sourceCoverage.topics.map((row) => (
              <li
                key={row.topic}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p
                    className={
                      row.covered
                        ? "font-medium text-slate-800"
                        : "font-medium text-rose-700"
                    }
                  >
                    {row.topic}
                  </p>
                  {row.sources.length > 0 ? (
                    <p className="truncate text-[11px] text-slate-500">
                      {row.sources
                        .slice(0, 3)
                        .map((s) => `${s.title} (${s.match_count})`)
                        .join(", ")}
                      {row.sources.length > 3
                        ? `, +${row.sources.length - 3} more`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-600">No source matches yet</p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {row.match_count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function CoveragePanel({ projectId }: { projectId: string }) {
  const [coverage, setCoverage] = useState<ProjectCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCoverage(await getProjectCoverage(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load coverage.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Loading coverage...</p>;
  }
  if (error) {
    return <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>;
  }
  if (!coverage) return null;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <Target className="h-5 w-5 text-[var(--ck-primary)]" />
          Coverage by upcoming obligation
        </CardTitle>
        <p className="text-sm text-slate-600">
          Tag each obligation with the topics it covers. Quiz attempts and
          notebook cards in those topics drive a recency-weighted readiness
          score. Topics with no recent attempts show as untested.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Project readiness</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {readinessLabel(coverage.project_readiness_percent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Topics tracked</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {coverage.topics_total}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Topics untested</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {coverage.topics_untested}
            </p>
          </div>
        </div>

        {coverage.obligations.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No confirmed upcoming obligations with topics yet. Add topics to a
            confirmed exam or quiz to start tracking readiness.
          </p>
        ) : (
          <div className="space-y-2">
            {coverage.obligations.map((item) => {
              const expanded = expandedId === item.obligation_id;
              return (
                <div key={item.obligation_id} className="rounded-xl border border-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 p-3 text-left"
                    onClick={() =>
                      setExpandedId(expanded ? null : item.obligation_id)
                    }
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {displayDate(item.due_date)} / {item.topics_total} topics
                        {item.topics_untested > 0
                          ? ` / ${item.topics_untested} untested`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {readinessLabel(item.overall_readiness_percent)}
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="px-3 pb-3">
                      <ObligationCoverageDetail
                        projectId={projectId}
                        obligationId={item.obligation_id}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
