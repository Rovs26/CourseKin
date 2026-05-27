"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export function Topbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userName = user?.firstName ?? user?.username ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const location =
    pathname === routes.today
      ? "Today"
      : pathname === routes.courses
        ? "Courses"
        : pathname === routes.calendar
          ? "Calendar & Tasks"
        : pathname.startsWith(`${routes.courses}/`)
          ? "Course"
          : pathname.startsWith(routes.settings)
            ? "Settings"
            : "Workspace";

  return (
    <header className="sticky top-0 z-20 border-b bg-[var(--rf-card)]">
      <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
        <p className="text-sm text-[var(--rf-text-muted)]">
          Course Desk <span className="mx-2">/</span>
          <span className="font-medium text-[var(--rf-text)]">{location}</span>
        </p>

        <div className="flex items-center gap-2">
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
