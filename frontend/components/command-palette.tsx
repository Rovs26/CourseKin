"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BookOpen,
  CalendarRange,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

export function CommandPalette() {
  const router = useRouter();
  const { summaries } = useProjectSummaries();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("coursekin:open-command", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("coursekin:open-command", onOpen);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <Command
        loop
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/50 bg-white/90 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.45)] backdrop-blur-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-200/70 px-4">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Command.Input
            autoFocus
            placeholder="Jump to a course or action…"
            className="h-12 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">
            No results found.
          </Command.Empty>

          <Command.Group
            heading="Go to"
            className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-items]]:mt-1"
          >
            <PaletteItem icon={LayoutDashboard} label="Today" onSelect={() => go(routes.today)} />
            <PaletteItem icon={BookOpen} label="Courses" onSelect={() => go(routes.courses)} />
            <PaletteItem icon={CalendarRange} label="Calendar" onSelect={() => go(routes.calendar)} />
            <PaletteItem icon={Settings} label="Settings" onSelect={() => go(routes.settings)} />
          </Command.Group>

          <Command.Group
            heading="Actions"
            className="mt-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-items]]:mt-1"
          >
            <PaletteItem icon={Plus} label="Add a course" onSelect={() => go(routes.newCourse)} />
          </Command.Group>

          {summaries.length > 0 && (
            <Command.Group
              heading="Courses"
              className="mt-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-items]]:mt-1"
            >
              {summaries.map(({ project }) => (
                <PaletteItem
                  key={project.id}
                  icon={GraduationCap}
                  label={project.title}
                  hint={project.course_code ?? undefined}
                  value={`${project.title} ${project.course_code ?? ""}`}
                  onSelect={() => go(routes.courseOverview(project.id))}
                />
              ))}
            </Command.Group>
          )}

          {summaries.length > 0 && (
            <Command.Group
              heading="Open notebook / plan"
              className="mt-2 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-items]]:mt-1"
            >
              {summaries.slice(0, 6).map(({ project }) => (
                <PaletteItem
                  key={`nb-${project.id}`}
                  icon={FileText}
                  label={`Notebook — ${project.title}`}
                  value={`notebook ${project.title}`}
                  onSelect={() => go(routes.courseNotebook(project.id))}
                />
              ))}
              {summaries.slice(0, 6).map(({ project }) => (
                <PaletteItem
                  key={`plan-${project.id}`}
                  icon={ListChecks}
                  label={`Plan — ${project.title}`}
                  value={`plan ${project.title}`}
                  onSelect={() => go(routes.coursePlan(project.id))}
                />
              ))}
            </Command.Group>
          )}
        </Command.List>
      </Command>
    </div>
  );
}

function PaletteItem({
  icon: Icon,
  label,
  hint,
  value,
  onSelect,
}: {
  icon: typeof Search;
  label: string;
  hint?: string;
  value?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value ?? label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 aria-selected:bg-[var(--ck-primary-soft)] aria-selected:text-[var(--ck-ink)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="flex-1 truncate normal-case tracking-normal text-slate-700">{label}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </Command.Item>
  );
}
