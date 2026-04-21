import { cn } from "@/lib/utils";
import type { SourceStatus } from "@/types/source";

const styles: Record<SourceStatus, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-700",
  processed: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium capitalize",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}