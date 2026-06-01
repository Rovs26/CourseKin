import { SourceViewer } from "@/features/sources/source-viewer";

export default async function SourceViewerPage({
  params,
}: {
  params: Promise<{ projectId: string; sourceId: string }>;
}) {
  const { projectId, sourceId } = await params;
  return <SourceViewer projectId={projectId} sourceId={sourceId} />;
}
