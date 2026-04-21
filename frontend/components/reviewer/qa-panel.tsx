import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function QAPanel({
  items,
}: {
  items: { question: string; answer: string }[];
}) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <Card key={index} className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {item.question}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">{item.answer}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}