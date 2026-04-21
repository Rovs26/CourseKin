import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type JobStage =
  | "queued"
  | "extracting"
  | "cleaning"
  | "chunking"
  | "retrieving"
  | "generating"
  | "saving"
  | "completed";

function formatLabel(value: string) {
  return value.replace("-", " ");
}

export function RightPanel({
  project,
  onGenerateReviewer,
  onExportReviewer,
  canGenerate = false,
  isGenerating = false,
  currentStage = null,
  hasReviewer = false,
}: {
  project: Project;
  onGenerateReviewer?: () => void;
  onExportReviewer?: () => void;
  canGenerate?: boolean;
  isGenerating?: boolean;
  currentStage?: JobStage | null;
  hasReviewer?: boolean;
}) {
  const settings = [
    { label: "Age Level", value: project.age_bracket.replace("-", " ") },
    { label: "Mode", value: project.learning_mode.replace("-", " ") },
    { label: "Field", value: project.field_of_study },
    { label: "Source Mode", value: project.source_mode.replace("-", " ") },
  ];

  const primaryLabel = !canGenerate
    ? "Add Sources First"
    : isGenerating
    ? `${currentStage ? formatLabel(currentStage) : "processing"}...`
    : hasReviewer
    ? "Regenerate Reviewer"
    : "Generate Reviewer";

  return (
    <div className="space-y-4">
      {currentStage && (
        <Card className="rounded-2xl border-slate-200 bg-slate-50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              Generation Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium capitalize text-slate-900">
              {formatLabel(currentStage)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Your reviewer is being generated. This may take a moment.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">Review Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.map((setting) => (
            <div
              key={setting.label}
              className="flex items-center justify-between rounded-xl border p-3"
            >
              <span className="text-sm text-slate-500">{setting.label}</span>
              <span className="text-sm font-medium capitalize text-slate-900">
                {setting.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <Button
          className="w-full rounded-xl"
          onClick={onGenerateReviewer}
          disabled={!onGenerateReviewer || !canGenerate || isGenerating}
        >
          {primaryLabel}
        </Button>
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={onExportReviewer}
          disabled={!onExportReviewer || !hasReviewer || isGenerating}
        >
          Export Reviewer
        </Button>
      </div>
    </div>
  );
}