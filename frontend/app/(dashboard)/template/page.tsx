import Link from "next/link";
import { BookOpen, Brain, FileText, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/lib/routes";

const templates = [
  {
    id: "exam-sprint",
    title: "Exam Sprint",
    icon: Brain,
    description:
      "Fast review cycles with more quiz and flashcards for cramming.",
    includes: ["Summary", "Key Points (10)", "Quiz (15)", "Flashcards (25)"],
  },
  {
    id: "deep-study-pack",
    title: "Deep Study Pack",
    icon: BookOpen,
    description:
      "Thorough concept understanding with extended definitions and Q&A.",
    includes: ["Summary", "Key Points (20)", "Definitions (15)", "Q&A (15)", "Flashcards (20)"],
  },
  {
    id: "lecture-notes-cleaner",
    title: "Lecture Notes Cleaner",
    icon: FileText,
    description:
      "Convert messy pasted notes into structured key points and definitions.",
    includes: ["Summary", "Key Points (20)", "Definitions (15)"],
  },
  {
    id: "compare-sources",
    title: "Compare Sources",
    icon: Layers3,
    description:
      "Combine multiple materials into one reviewer with quiz focus.",
    includes: ["Summary", "Key Points (15)", "Q&A (10)", "Quiz (10)"],
  },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Start faster with pre-shaped reviewer setups for common study flows.
          </p>
        </div>

        <Button asChild className="rounded-xl">
          <Link href={routes.newProject}>Create From Scratch</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const Icon = template.icon;

          return (
            <Card key={template.id} className="rounded-2xl shadow-sm">
              <CardHeader className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl text-slate-900">
                      {template.title}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      {template.description}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {template.includes.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                >
                  <Link href={`${routes.newProject}?template=${template.id}`}>
                    Use Template
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
