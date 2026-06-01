import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ck-bg)] transition-colors">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[232px_1fr]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <Topbar />
          <main className="flex-1 p-4 pb-24 md:p-6 lg:px-10 lg:py-8 lg:pb-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
