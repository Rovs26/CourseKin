import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { ApiAuthSync } from "@/components/auth/api-auth-sync";
import { CommandPalette } from "@/components/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <ApiAuthSync />
      <CommandPalette />
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-lg",
          },
        }}
      />
    </AppShell>
  );
}
