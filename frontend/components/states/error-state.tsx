import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-white p-3">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-rose-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-rose-700">{description}</p>
          <Button variant="outline" className="mt-4">Try Again</Button>
        </div>
      </div>
    </div>
  );
}