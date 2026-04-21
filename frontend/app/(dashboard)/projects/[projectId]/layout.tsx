import { ProjectRouteShell } from "@/components/projects/project-route-shell";

export default async function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectRouteShell projectId={projectId}>{children}</ProjectRouteShell>;
}