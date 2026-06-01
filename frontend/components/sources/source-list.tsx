import { useCallback, useState } from "react";
import { File, FileText, Globe, Link2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { SourceStatusBadge } from "@/components/sources/source-status-badge";
import { deleteSource, updateSourcePurpose } from "@/lib/coursekin-api";
import type { Source, SourcePurpose } from "@/types/source";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectAll = useCallback(() => {
    setSelected(new Set(sources.map((s) => s.id)));
  }, [sources]);

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

  const bulkDelete = useCallback(async () => {
    if (bulkDeleting || selected.size === 0) return;
    setBulkDeleting(true);
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => deleteSource(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    setBulkDeleting(false);
    clearSelection();
    onSourceDeleted?.();
    if (failed > 0) {
      toast.error(
        `Removed ${ids.length - failed} of ${ids.length} — ${failed} could not be deleted.`,
      );
    } else {
      toast.success(`Removed ${ids.length} material${ids.length === 1 ? "" : "s"}.`);
    }
  }, [bulkDeleting, selected, clearSelection, onSourceDeleted]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isTypingTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAll();
      } else if (event.key === "Escape" && selected.size > 0) {
        clearSelection();
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selected.size > 0
      ) {
        event.preventDefault();
        void bulkDelete();
      }
    },
    [selectAll, clearSelection, bulkDelete, selected.size],
  );

  const allSelected = sources.length > 0 && selected.size === sources.length;

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
    <div className="space-y-3 outline-none" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between gap-3 px-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = selected.size > 0 && !allSelected;
            }}
            onChange={() => (allSelected ? clearSelection() : selectAll())}
            className="h-3.5 w-3.5 accent-[var(--ck-primary)]"
            aria-label="Select all materials"
          />
          Select all
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {selected.size} selected
            </span>
            <button
              onClick={() => void bulkDelete()}
              disabled={bulkDeleting}
              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bulkDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        )}
      </div>
      {sources.map((source) => {
        const Icon = iconMap[source.type];
        const hasText = source.status === "processed";
        const isDeleting = deletingId === source.id;
        const isSelected = selected.has(source.id);

        return (
          <div
            key={source.id}
            className={`group rounded-2xl border bg-white p-4 shadow-sm transition ${
              isSelected ? "border-[var(--ck-primary)] ring-1 ring-[var(--ck-primary)]" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(source.id)}
                className="mt-2.5 h-3.5 w-3.5 shrink-0 accent-[var(--ck-primary)]"
                aria-label={`Select ${source.title}`}
              />
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
                  Use in Notebook
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
