import { CheckCircle2 } from "lucide-react";

export function KeyPointsPanel({ keyPoints }: { keyPoints: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {keyPoints.map((point, index) => (
        <div key={index} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <p className="text-sm leading-6 text-slate-700">{point}</p>
          </div>
        </div>
      ))}
    </div>
  );
}