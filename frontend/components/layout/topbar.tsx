"use client";

import Link from "next/link";
import Image from "next/image";
import { Settings } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export function Topbar() {
  const { user } = useUser();
  const userName = user?.firstName ?? user?.username ?? "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
        <p className="text-sm font-medium text-slate-500">
          CourseKin
        </p>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-slate-900"
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-700">
              {userInitial}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
