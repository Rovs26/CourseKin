"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RightPanel } from "@/components/layout/right-panel";
import { EmptyState } from "@/components/states/empty-state";
import { useProject } from "@/hooks/use-project";
import { deleteProject } from "@/lib/coursekin-api";
import { Button } from "@/components/ui/button";

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { project, isLoading, error } = useProject(projectId);
  const router = useRouter();

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteProject(projectId);
      router.push("/projects");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete project."
      );
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading settings...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <EmptyState
        title="Project not found"
        description={error ?? "This project does not exist in the current workspace."}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-sm">
      <RightPanel project={project} />

      <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
        <p className="mt-2 text-sm text-slate-600">
          Deleting this project will permanently remove all its sources, jobs,
          and reviewer data. This action cannot be undone.
        </p>

        {deleteError && (
          <p className="mt-3 text-sm text-red-600">{deleteError}</p>
        )}

        {showConfirm ? (
          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, delete permanently"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setShowConfirm(true)}
          >
            Delete Project
          </Button>
        )}
      </div>
    </div>
  );
}
