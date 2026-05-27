"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { key: "overview", label: "Overview", href: (id: string) => `/projects/${id}` },
  { key: "stream", label: "Room", href: (id: string) => `/projects/${id}/stream` },
  { key: "planning", label: "Plan", href: (id: string) => `/projects/${id}/planning` },
  { key: "sources", label: "Materials", href: (id: string) => `/projects/${id}/sources` },
  { key: "reviewer", label: "Notebook", href: (id: string) => `/projects/${id}/reviewer` },
  { key: "settings", label: "Settings", href: (id: string) => `/projects/${id}/settings` },
];

export function ProjectSubnav({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border bg-white p-2">
      {items.map((item) => {
        const href = item.href(projectId);
        const isActive = pathname === href;

        return (
          <Link
            key={item.key}
            href={href}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
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
  );
}
