"use client";

import { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Download, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_BASE =
  (process.env.NEXT_PUBLIC_REVIEWFLOW_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export default function AccountPage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/users/me/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Export failed (${res.status})`);
      }
      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reviewflow-export.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/users/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Deletion failed (${res.status})`);
      }
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your personal data and account lifecycle.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Export */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Download className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">Export my data</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Download a ZIP archive containing all your projects, sources, generated reviewers,
              and usage history in JSON format. Uploaded files will include temporary download
              links valid for 1 hour.
            </p>
            {exportError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{exportError}</p>
            )}
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl"
            >
              {exporting ? "Preparing export…" : "Download my data"}
            </Button>
          </CardContent>
        </Card>

        {/* Delete */}
        <Card className="rounded-2xl border-red-100 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-xl text-slate-900">Delete my account</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Permanently delete your account and all associated data — projects, sources,
              generated reviewers, and usage history. This action is irreversible. Your data will
              be wiped within 30 days from all systems including backups.
            </p>

            {!showDeleteConfirm && (
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Delete my account
              </Button>
            )}

            {showDeleteConfirm && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-start gap-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This will permanently delete your account and all your data. There is no
                    undo. Are you sure?
                  </span>
                </div>
                {deleteError && (
                  <p className="text-sm text-red-700 font-medium">{deleteError}</p>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                  >
                    {deleting ? "Deleting…" : "Yes, delete everything"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteError(null);
                    }}
                    disabled={deleting}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        See our{" "}
        <a href="/privacy" className="underline hover:text-slate-600">
          Privacy Policy
        </a>{" "}
        for full details on data retention and your rights under GDPR and CCPA.
      </p>
    </div>
  );
}
