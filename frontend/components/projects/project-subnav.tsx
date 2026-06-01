"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { key: "overview", label: "Overview", href: (id: string) => `/projects/${id}` },
  { key: "stream", label: "Room", href: (id: string) => `/projects/${id}/stream` },
  { key: "planning", label: "Plan", href: (id: string) => `/projects/${id}/planning` },
  { key: "sources", label: "Materials", href: (id: string) => `/projects/${id}/sources` },
  { key: "reviewer", label: "Reviewer", href: (id: string) => `/projects/${id}/reviewer` },
  { key: "notebook", label: "Notebook", href: (id: string) => `/projects/${id}/notebook` },
  { key: "exams", label: "Exams", href: (id: string) => `/projects/${id}/exams` },
  { key: "settings", label: "Settings", href: (id: string) => `/projects/${id}/settings` },
];

export function ProjectSubnav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl border bg-white p-2 sm:mx-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-1.5 sm:flex-wrap sm:gap-2">
        {items.map((item) => {
          const href = item.href(projectId);
          const isActive = pathname === href;

          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition sm:px-4",
                isActive
                  ? "bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
