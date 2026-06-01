"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Settings } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { getProject } from "@/lib/coursekin-api";

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^\/]+)/);
  if (!match) return null;
  const id = match[1];
  if (id === "new") return null;
  return id;
}

export function Topbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userName = user?.firstName ?? user?.username ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();

  const projectId = extractProjectId(pathname);
  const [courseTitle, setCourseTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setCourseTitle(null);
      return;
    }
    let cancelled = false;
    void getProject(projectId)
      .then((project) => {
        if (!cancelled) setCourseTitle(project.title);
      })
      .catch(() => {
        if (!cancelled) setCourseTitle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const location =
    pathname === routes.today
      ? "Today"
      : pathname === routes.courses
        ? "Courses"
        : pathname === routes.calendar
          ? "Calendar & Tasks"
        : projectId
          ? (courseTitle ?? "Course")
          : pathname.startsWith(routes.settings)
            ? "Settings"
            : "Workspace";

  return (
    <header className="sticky top-0 z-20 border-b bg-[var(--rf-card)]">
      <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
        <p className="text-sm text-[var(--rf-text-muted)]">
          CourseKin <span className="mx-2">/</span>
          <span className="font-medium text-[var(--rf-text)]">{location}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new Event("coursekin:open-command"))
            }
            className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-[var(--rf-soft)] px-2.5 py-1.5 text-xs text-[var(--rf-text-muted)] transition hover:text-[var(--ck-primary)] sm:flex"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
            <kbd className="rounded border border-slate-300 bg-white px-1.5 font-sans text-[10px] text-slate-500">
              ⌘K
            </kbd>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-[var(--rf-text-muted)] hover:text-[var(--ck-primary)] sm:hidden"
            onClick={() =>
              window.dispatchEvent(new Event("coursekin:open-command"))
            }
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-[var(--rf-text-muted)] hover:text-[var(--ck-primary)]"
          >
            <Link href={routes.settings}>
              <Settings className="h-4 w-4" />
            </Link>
          </Button>

          {user?.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt={userName}
              width={32}
              height={32}
              unoptimized
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ck-primary-soft)] text-sm font-medium text-[var(--ck-primary)]">
              {userInitial}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
