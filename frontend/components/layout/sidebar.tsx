"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  CalendarDays,
  CalendarRange,
  BookOpen,
  Settings,
  UserCog,
  CreditCard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const workspaceItems = [
  { label: "Today", href: routes.today, icon: CalendarDays },
  { label: "Courses", href: routes.courses, icon: BookOpen },
  { label: "Calendar & Tasks", href: routes.calendar, icon: CalendarRange },
];

const accountItems = [
  { label: "Settings", href: routes.settings, icon: Settings },
  { label: "Billing", href: routes.billing, icon: CreditCard },
  { label: "Account", href: routes.account, icon: UserCog },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="hidden border-r bg-[var(--rf-card)] lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <Link href={routes.today} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ck-primary)] text-xs font-bold tracking-tight text-white">
            CK
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight text-[var(--rf-text)]">CourseKin</p>
            <p className="text-xs text-[var(--rf-text-muted)]">Course Desk</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-7 px-3 py-6">
        <div className="space-y-1">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--rf-text-muted)]">
            Workspace
          </p>
          {workspaceItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]"
                    : "text-[var(--rf-text-muted)] hover:bg-[var(--rf-soft)] hover:text-[var(--rf-text)]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-[var(--rf-text-muted)]">
            Account
          </p>
        {accountItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]"
                  : "text-[var(--rf-text-muted)] hover:bg-[var(--rf-soft)] hover:text-[var(--rf-text)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>

      <div className="border-t p-3">
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--rf-text-muted)] hover:bg-[var(--rf-soft)] hover:text-[var(--rf-text)]"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
