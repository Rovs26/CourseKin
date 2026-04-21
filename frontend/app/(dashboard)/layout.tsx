import { AppShell } from "@/components/layout/app-shell";
import { ApiAuthSync } from "@/components/auth/api-auth-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <ApiAuthSync />
      {children}
    </AppShell>
  );
}
