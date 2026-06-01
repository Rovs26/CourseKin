import type { LucideIcon } from "lucide-react";
import { FileSearch } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon = FileSearch,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/60 px-6 py-16 text-center">
      <div className="rounded-2xl bg-[var(--ck-primary-soft)] p-4 text-[var(--ck-primary)] ring-1 ring-[var(--ck-primary-border)]/40">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
