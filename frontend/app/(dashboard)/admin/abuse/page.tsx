"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getAbuseSummary,
  getCoursePlanningValidation,
  banUser,
  unbanUser,
  type AbuseSummary,
  type CoursePlanningValidation,
} from "@/lib/coursekin-api";

export default function AbusePage() {
  const [summary, setSummary] = useState<AbuseSummary | null>(null);
  const [validation, setValidation] = useState<CoursePlanningValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [banUserId, setBanUserId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [abuseSummary, planningValidation] = await Promise.all([
        getAbuseSummary(),
        getCoursePlanningValidation(),
      ]);
      setSummary(abuseSummary);
      setValidation(planningValidation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleBan = async () => {
    if (!banUserId.trim() || !banReason.trim()) return;
    setActionMsg(null);
    try {
      const result = await banUser(banUserId.trim(), banReason.trim());
      setActionMsg(result.message);
      setBanUserId("");
      setBanReason("");
      loadSummary();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Ban failed");
    }
  };

  const handleUnban = async (userId: string) => {
    setActionMsg(null);
    try {
      const result = await unbanUser(userId);
      setActionMsg(result.message);
      loadSummary();
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : "Unban failed");
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Loading abuse summary...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Operations Dashboard</h1>
        <Button variant="outline" onClick={loadSummary} className="rounded-xl text-sm">
          Refresh
        </Button>
      </div>

      {actionMsg && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {actionMsg}
        </p>
      )}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Phase B Validation: Syllabus Review</CardTitle>
          <p className="text-sm text-slate-500">
            First student decisions compared with the original AI proposal.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Measured reviews", validation?.extraction_review.measurable_reviews ?? 0],
              ["Confirmed", validation?.extraction_review.confirmed ?? 0],
              ["Corrected", validation?.extraction_review.corrected_confirmations ?? 0],
              [
                "Unchanged rate",
                `${Math.round((validation?.extraction_review.unchanged_confirmation_rate ?? 0) * 100)}%`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Corrections by field
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(validation?.extraction_review.field_corrections ?? {}).map(
                ([field, value]) => (
                  <span key={field} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                    {field.replaceAll("_", " ")}: {value}
                  </span>
                )
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Phase B Validation: Early Preparation</CardTitle>
          <p className="text-sm text-slate-500">
            A return proxy based on completing a planned session before a confirmed assessment date.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Dated assessments", validation?.preparation_return.confirmed_dated_assessments ?? 0],
              ["With runway", validation?.preparation_return.assessments_with_runway ?? 0],
              [
                "Early preparation rate",
                `${Math.round((validation?.preparation_return.early_preparation_rate ?? 0) * 100)}%`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-xs text-slate-500">
            {validation?.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </CardContent>
      </Card>

      {/* High volume */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">High Volume (last hour, &gt;5 jobs)</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.high_volume_last_hour.length === 0 ? (
            <p className="text-sm text-slate-400">None</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {summary?.high_volume_last_hour.map((r) => (
                <li key={r.project_id} className="flex justify-between text-slate-700">
                  <span className="font-mono text-xs">{r.project_id}</span>
                  <span className="font-semibold">{r.job_count} jobs</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* High failure ratio */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">High Failure Ratio (last 24h, &gt;50%)</CardTitle>
        </CardHeader>
        <CardContent>
          {summary?.high_failure_ratio_24h.length === 0 ? (
            <p className="text-sm text-slate-400">None</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {summary?.high_failure_ratio_24h.map((r) => (
                <li key={r.project_id} className="flex justify-between text-slate-700">
                  <span className="font-mono text-xs">{r.project_id}</span>
                  <span>
                    {r.failed}/{r.total} failed ({Math.round((r.failed / r.total) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Banned users */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Banned Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary?.banned_users.length === 0 ? (
            <p className="text-sm text-slate-400">No banned users</p>
          ) : (
            <ul className="space-y-2">
              {summary?.banned_users.map((u) => (
                <li
                  key={u.user_id}
                  className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-xs text-slate-700">{u.user_id}</p>
                    <p className="text-xs text-slate-500">
                      {u.reason} — banned by {u.banned_by} at {u.banned_at}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleUnban(u.user_id)}
                    className="rounded-lg text-xs"
                  >
                    Unban
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Ban form */}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ban a user
            </p>
            <input
              type="text"
              placeholder="Clerk user_id (user_...)"
              value={banUserId}
              onChange={(e) => setBanUserId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <input
              type="text"
              placeholder="Reason"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <Button
              onClick={handleBan}
              disabled={!banUserId.trim() || !banReason.trim()}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              Ban User
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
