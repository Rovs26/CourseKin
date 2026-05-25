"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createProject } from "@/lib/reviewflow-api";
import { routes } from "@/lib/routes";
import type {
  AgeBracket,
  LearningMode,
  ProjectType,
  SourceMode,
  TemplateId,
} from "@/types/project";

const TEMPLATE_LABELS: Record<string, string> = {
  "exam-sprint": "Exam Sprint",
  "deep-study-pack": "Deep Study Pack",
  "lecture-notes-cleaner": "Lecture Notes Cleaner",
  "compare-sources": "Compare Sources",
};

const VALID_TEMPLATES = new Set(Object.keys(TEMPLATE_LABELS));

const steps = ["Basics", "Learning Setup", "Review Preferences"] as const;

export function ProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rawTemplate = searchParams.get("template");
  const templateId = rawTemplate && VALID_TEMPLATES.has(rawTemplate) ? rawTemplate as TemplateId : null;

  const [form, setForm] = useState({
    title: "",
    project_type: "",
    field_of_study: "",
    age_bracket: "",
    learning_mode: "",
    source_mode: "",
  });

  const progress = ((step + 1) / steps.length) * 100;

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const canSubmit =
    form.title.trim() &&
    form.project_type &&
    form.field_of_study.trim() &&
    form.age_bracket &&
    form.learning_mode &&
    form.source_mode;

  const handleCreateProject = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const newProject = await createProject({
        title: form.title.trim(),
        project_type: form.project_type as ProjectType,
        field_of_study: form.field_of_study.trim(),
        age_bracket: form.age_bracket as AgeBracket,
        learning_mode: form.learning_mode as LearningMode,
        source_mode: form.source_mode as SourceMode,
        template_id: templateId,
      });

      router.push(routes.projectOverview(newProject.id));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create project."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Create New Project
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Set up a structured reviewer workspace with the right study configuration.
        </p>
      </div>

      {templateId && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-700">
            Using template: <strong>{TEMPLATE_LABELS[templateId]}</strong>
          </span>
          <button
            onClick={() => router.replace(routes.newProject)}
            className="ml-auto text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Remove
          </button>
        </div>
      )}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-900">{steps[step]}</CardTitle>
            <span className="text-sm text-slate-500">
              Step {step + 1} of {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {step === 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="project-name" className="text-slate-900">
                  Project Name
                </Label>
                <Input
                  id="project-name"
                  placeholder="World History Review"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900">Project Type</Label>
                <Select
                  value={form.project_type}
                  onValueChange={(value) => updateField("project_type", value)}
                >
                  <SelectTrigger className="text-slate-700">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="exam">Exam</SelectItem>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900">Field of Study</Label>
                <Input
                  placeholder="History"
                  value={form.field_of_study}
                  onChange={(e) => updateField("field_of_study", e.target.value)}
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-900">Age Bracket</Label>
                <Select
                  value={form.age_bracket}
                  onValueChange={(value) => updateField("age_bracket", value)}
                >
                  <SelectTrigger className="text-slate-700">
                    <SelectValue placeholder="Select age level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grade-school">Grade School</SelectItem>
                    <SelectItem value="high-school">High School</SelectItem>
                    <SelectItem value="college">College</SelectItem>
                    <SelectItem value="adult">Adult</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900">Learning Mode</Label>
                <Select
                  value={form.learning_mode}
                  onValueChange={(value) => updateField("learning_mode", value)}
                >
                  <SelectTrigger className="text-slate-700">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="exam-cram">Exam Cram</SelectItem>
                    <SelectItem value="deep">Deep Study</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-900">Source Mode</Label>
                <Select
                  value={form.source_mode}
                  onValueChange={(value) => updateField("source_mode", value)}
                >
                  <SelectTrigger className="text-slate-700">
                    <SelectValue placeholder="Choose source mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source-only">Source Only</SelectItem>
                    <SelectItem value="source-web">Source + Web</SelectItem>
                    <SelectItem value="compare">Compare</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4 md:col-span-2">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">Project setup preview</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {templateId
                        ? `Template "${TEMPLATE_LABELS[templateId]}" will pre-configure your generation settings.`
                        : "Your project will use default generation settings. You can customize sections and counts when generating."}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Project Name
                        </p>
                        <p className="mt-1 font-medium text-slate-900">
                          {form.title || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Project Type
                        </p>
                        <p className="mt-1 font-medium capitalize text-slate-900">
                          {form.project_type || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Age Bracket
                        </p>
                        <p className="mt-1 font-medium capitalize text-slate-900">
                          {form.age_bracket ? form.age_bracket.replace("-", " ") : "Not set"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Learning Mode
                        </p>
                        <p className="mt-1 font-medium capitalize text-slate-900">
                          {form.learning_mode
                            ? form.learning_mode.replace("-", " ")
                            : "Not set"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          Field of Study
                        </p>
                        <p className="mt-1 font-medium text-slate-900">
                          {form.field_of_study || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {templateId ? "Template" : "Source Mode"}
                        </p>
                        <p className="mt-1 font-medium capitalize text-slate-900">
                          {templateId
                            ? TEMPLATE_LABELS[templateId]
                            : form.source_mode
                            ? form.source_mode.replace("-", " ")
                            : "Not set"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {submitError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          ) : null}

          <div className="flex justify-between border-t pt-4">
            <Button
              variant="outline"
              className={cn(
                "border-slate-200",
                step === 0
                  ? "text-slate-400"
                  : "bg-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              )}
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              disabled={step === 0 || isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep((prev) => Math.min(prev + 1, steps.length - 1))}
                disabled={isSubmitting}
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleCreateProject} disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
