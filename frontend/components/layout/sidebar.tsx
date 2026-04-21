"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FolderKanban,
  Files,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const items = [
  { label: "Dashboard", href: routes.dashboard, icon: LayoutDashboard },
  { label: "My Projects", href: routes.projects, icon: FolderKanban },
  { label: "Templates", href: routes.templates, icon: Files },
  { label: "Settings", href: routes.settings, icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="hidden border-r bg-slate-900 text-white lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b border-white/10 px-6">
        <Link href={routes.dashboard} className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-900">
            R
          </div>
          <p className="text-lg font-semibold tracking-tight">ReviewFlow</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}
