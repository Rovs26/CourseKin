"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RightPanel } from "@/components/layout/right-panel";
import { EmptyState } from "@/components/states/empty-state";
import { useProject } from "@/hooks/use-project";
import { deleteProject, updateProject } from "@/lib/coursekin-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/types/project";

function CourseProfileForm({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: () => void;
}) {
  const [courseCode, setCourseCode] = useState(project.course_code ?? "");
  const [term, setTerm] = useState(project.term ?? "");
  const [instructor, setInstructor] = useState(project.instructor ?? "");
  const [meetingSchedule, setMeetingSchedule] = useState(project.meeting_schedule ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateProject(project.id, {
        course_code: courseCode.trim() || null,
        term: term.trim() || null,
        instructor: instructor.trim() || null,
        meeting_schedule: meetingSchedule.trim() || null,
      });
      setMessage("Course profile saved.");
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save course profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-slate-900">Course Profile</CardTitle>
        <p className="text-sm text-slate-500">
          Add semester context to an existing reviewer workspace.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Course Code</Label>
          <Input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} placeholder="CHEM 101" />
        </div>
        <div className="space-y-2">
          <Label>Term</Label>
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="First Semester 2026-2027" />
        </div>
        <div className="space-y-2">
          <Label>Instructor</Label>
          <Input value={instructor} onChange={(event) => setInstructor(event.target.value)} placeholder="Prof. Santos" />
        </div>
        <div className="space-y-2">
          <Label>Class Schedule</Label>
          <Input value={meetingSchedule} onChange={(event) => setMeetingSchedule(event.target.value)} placeholder="Mon/Wed 10:00 AM - 11:30 AM" />
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Course Profile"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { project, isLoading, error, refetch } = useProject(projectId);
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
    <div className="grid gap-6 lg:grid-cols-[minmax(320px,460px)_minmax(320px,400px)]">
      <CourseProfileForm project={project} onSaved={refetch} />
      <div className="space-y-6">
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
    </div>
  );
}
