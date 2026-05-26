import { useState } from "react";
import { File, FileText, Globe, Link2, Sparkles, Trash2 } from "lucide-react";
import { SourceStatusBadge } from "@/components/sources/source-status-badge";
import { deleteSource, updateSourcePurpose } from "@/lib/coursekin-api";
import type { Source, SourcePurpose } from "@/types/source";

const iconMap = {
  pdf: FileText,
  url: Link2,
  text: Globe,
  file: File,
} as const;

const purposeLabels = {
  study_material: "Study material",
  syllabus: "Syllabus",
  lecture_notes: "Lecture notes",
  assignment_brief: "Assignment brief",
} as const;

export function SourceList({
  sources,
  onGenerateFromSource,
  onSourceDeleted,
  isGenerating = false,
  allowPurposeEditing = false,
}: {
  sources: Source[];
  onGenerateFromSource?: (source: Source) => void;
  onSourceDeleted?: () => void;
  isGenerating?: boolean;
  allowPurposeEditing?: boolean;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleDelete = async (source: Source) => {
    if (deletingId) return;
    setDeletingId(source.id);
    try {
      await deleteSource(source.id);
      onSourceDeleted?.();
    } catch {
      // Silently fail — source may have already been deleted
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurposeChange = async (source: Source, purpose: SourcePurpose) => {
    setUpdatingId(source.id);
    try {
      await updateSourcePurpose(source.id, purpose);
      onSourceDeleted?.();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const Icon = iconMap[source.type];
        const hasText = source.status === "processed";
        const isDeleting = deletingId === source.id;

        return (
          <div key={source.id} className="group rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-100 p-2">
                <Icon className="h-4 w-4 text-slate-600" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{source.title}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                  {source.type} - {purposeLabels[source.purpose]}
                </p>
              </div>

              <button
                onClick={() => handleDelete(source)}
                disabled={isDeleting || isGenerating}
                className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-30"
                title="Delete source"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <SourceStatusBadge status={source.status} />

              {onGenerateFromSource && hasText && (
                <button
                  onClick={() => onGenerateFromSource(source)}
                  disabled={isGenerating}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <Sparkles className="h-3 w-3" />
                  Generate
                </button>
              )}
            </div>
            {allowPurposeEditing && (
              <select
                value={source.purpose}
                disabled={updatingId === source.id}
                onChange={(event) => handlePurposeChange(source, event.target.value as SourcePurpose)}
                className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600"
                aria-label={`Material type for ${source.title}`}
              >
                {Object.entries(purposeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
