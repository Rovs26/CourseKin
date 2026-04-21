import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SummaryPanel({ summary }: { summary: string }) {
  return (
    <Card className="rounded-2xl border bg-slate-50 shadow-none">
      <CardHeader>
        <CardTitle className="text-slate-900">Condensed Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="max-w-3xl text-sm leading-7 text-slate-700">{summary}</p>
      </CardContent>
    </Card>
  );
}