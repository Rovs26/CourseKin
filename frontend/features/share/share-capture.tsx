"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { createTextSource } from "@/lib/coursekin-api";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { routes } from "@/lib/routes";

/** Builds the source body from the shared payload, keeping a shared URL on its
 * own line so it stays clickable / extractable after processing. */
function buildInitialContent(text: string, url: string): string {
  return [text.trim(), url.trim()].filter(Boolean).join("\n\n");
}

function deriveTitle(title: string, content: string): string {
  const base = title.trim() || content.trim();
  if (!base) return "Shared note";
  return base.length > 60 ? `${base.slice(0, 60).trim()}...` : base;
}

export function ShareCapture() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { summaries, isLoading, error } = useProjectSummaries();

  const sharedTitle = searchParams.get("title") ?? "";
  const sharedText = searchParams.get("text") ?? "";
  const sharedUrl = searchParams.get("url") ?? "";

  const initialContent = useMemo(
    () => buildInitialContent(sharedText, sharedUrl),
    [sharedText, sharedUrl],
  );

  const [title, setTitle] = useState(() => deriveTitle(sharedTitle, initialContent));
  const [content, setContent] = useState(initialContent);
  const [savingId, setSavingId] = useState<string | null>(null);

  const hasContent = content.trim().length > 0;

  const saveTo = async (projectId: string) => {
    if (!hasContent || savingId) return;

    setSavingId(projectId);
    try {
      const body = content.trim();
      await createTextSource({
        project_id: projectId,
        title: deriveTitle(title, body),
        text: body,
        content: body,
        purpose: "study_material",
      });
      toast.success("Saved to your course", {
        description: "We'll process it for citations and your notebook.",
      });
      router.push(`${routes.projectSources(projectId)}?shared=1`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Couldn't save the shared content.";
      toast.error("Save failed", { description: message });
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]">
          <Share2 className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quick capture</h1>
          <p className="text-sm text-slate-500">
            Shared content lands here. Tidy it up, then drop it into a course.
          </p>
        </div>
      </div>

      <Card className="border-white/50 bg-white/80 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base">What you shared</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="share-title">Title</Label>
            <Input
              id="share-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give this material a name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="share-content">Content</Label>
            <Textarea
              id="share-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder="Paste or edit the text you want to study from"
            />
            {!hasContent ? (
              <p className="text-xs text-rose-600">
                Add some text or a link before saving.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-700">Save to a course</h2>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : summaries.length === 0 ? (
          <EmptyState
            title="No courses yet"
            description="Create a course first, then share materials straight into it."
            action={
              <Button asChild>
                <Link href={routes.newCourse}>
                  Create a course
                  <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {summaries.map(({ project }) => {
              const isSaving = savingId === project.id;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    disabled={!hasContent || savingId !== null}
                    onClick={() => saveTo(project.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/50 bg-white/70 p-4 text-left backdrop-blur-md transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900">
                        {project.title}
                      </span>
                      {project.course_code ? (
                        <span className="block truncate text-xs text-slate-500">
                          {project.course_code}
                        </span>
                      ) : null}
                    </span>
                    {isSaving ? (
                      <Loader2 className="size-5 shrink-0 animate-spin text-[var(--ck-primary)]" />
                    ) : (
                      <Check className="size-5 shrink-0 text-slate-300" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
