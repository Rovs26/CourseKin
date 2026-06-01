"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const items = [
  { label: "Today", href: routes.today, icon: CalendarDays },
  { label: "Courses", href: routes.courses, icon: BookOpen },
  { label: "Calendar", href: routes.calendar, icon: CalendarRange },
  { label: "Settings", href: routes.settings, icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/40 bg-white/80 backdrop-blur-xl shadow-[0_-4px_24px_-12px_rgba(15,23,42,0.18)] lg:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition",
                  active
                    ? "text-[var(--ck-primary)]"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
