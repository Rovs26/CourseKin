"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Plus,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { createProject, prefillFromSyllabus } from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";
import { useProjectSummaries } from "@/hooks/use-project-summaries";
import { SUBJECT_SUGGESTIONS } from "@/lib/subjects";
import {
  DAY_OPTIONS,
  SEMESTERS,
  academicYearOptions,
  emptyBlock,
  formatSchedule,
  formatTerm,
  type ScheduleBlock,
} from "@/lib/schedule";
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

const steps = ["Course Details", "Study Approach", "Material Policy"] as const;

type FormState = {
  title: string;
  project_type: string;
  field_of_study: string;
  age_bracket: string;
  learning_mode: string;
  source_mode: string;
  course_code: string;
  term: string;
  instructor: string;
  meeting_schedule: string;
};

export function ProjectWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects } = useProjectSummaries();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rawTemplate = searchParams.get("template");
  const templateId = rawTemplate && VALID_TEMPLATES.has(rawTemplate) ? rawTemplate as TemplateId : null;

  const [form, setForm] = useState<FormState>({
    title: "",
    project_type: "school",
    field_of_study: "",
    age_bracket: "college",
    learning_mode: "",
    source_mode: "",
    course_code: "",
    term: "",
    instructor: "",
    meeting_schedule: "",
  });

  // Structured sub-state for the term picker and schedule builder. These
  // serialize down into form.term / form.meeting_schedule (plain strings).
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([
    emptyBlock(),
  ]);

  const [showPrefill, setShowPrefill] = useState(false);
  const [syllabusText, setSyllabusText] = useState("");
  const [prefilling, setPrefilling] = useState(false);

  const ayOptions = useMemo(() => academicYearOptions(), []);
  const lastCourse = projects[0];
  const showClone = Boolean(lastCourse) && !form.title.trim() && !form.field_of_study.trim();

  const progress = ((step + 1) / steps.length) * 100;

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateTerm = (nextSemester: string, nextYear: string) => {
    setSemester(nextSemester);
    setAcademicYear(nextYear);
    updateField("term", formatTerm(nextSemester, nextYear));
  };

  const updateSchedule = (blocks: ScheduleBlock[]) => {
    setScheduleBlocks(blocks);
    updateField("meeting_schedule", formatSchedule(blocks));
  };

  const toggleDay = (index: number, day: string) => {
    const blocks = scheduleBlocks.map((block, i) => {
      if (i !== index) return block;
      const has = block.days.includes(day);
      return {
        ...block,
        days: has ? block.days.filter((d) => d !== day) : [...block.days, day],
      };
    });
    updateSchedule(blocks);
  };

  const updateBlock = (index: number, patch: Partial<ScheduleBlock>) => {
    updateSchedule(
      scheduleBlocks.map((block, i) => (i === index ? { ...block, ...patch } : block))
    );
  };

  const applyPrefill = async () => {
    const text = syllabusText.trim();
    if (text.length < 20 || prefilling) {
      return;
    }
    setPrefilling(true);
    try {
      const data = await prefillFromSyllabus(text);
      const applied: string[] = [];
      setForm((prev) => {
        const next = { ...prev };
        if (data.title && !prev.title.trim()) {
          next.title = data.title;
          applied.push("name");
        }
        if (data.field_of_study && !prev.field_of_study.trim()) {
          next.field_of_study = data.field_of_study;
          applied.push("subject");
        }
        if (data.course_code) {
          next.course_code = data.course_code;
          applied.push("code");
        }
        if (data.instructor) {
          next.instructor = data.instructor;
          applied.push("instructor");
        }
        if (data.term) {
          next.term = data.term;
          applied.push("term");
        }
        if (data.meeting_schedule) {
          next.meeting_schedule = data.meeting_schedule;
          applied.push("schedule");
        }
        return next;
      });
      if (applied.length > 0) {
        toast.success("Prefilled from your syllabus", {
          description: `Filled in ${applied.join(", ")}. Review each field before saving.`,
        });
        setShowPrefill(false);
      } else {
        toast.info("Nothing new to fill", {
          description: "We couldn't find clear course details in that text.",
        });
      }
    } catch (err) {
      toast.error("Could not read that syllabus", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setPrefilling(false);
    }
  };

  const handleClone = () => {
    if (!lastCourse) return;
    setForm((prev) => ({
      ...prev,
      project_type: lastCourse.project_type,
      field_of_study: lastCourse.field_of_study,
      age_bracket: lastCourse.age_bracket,
      learning_mode: lastCourse.learning_mode,
      source_mode: lastCourse.source_mode,
      instructor: lastCourse.instructor ?? prev.instructor,
    }));
    toast.success("Copied your last course", {
      description: "Subject, study approach, and material policy were prefilled.",
    });
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
        course_code: form.course_code.trim() || null,
        term: form.term.trim() || null,
        instructor: form.instructor.trim() || null,
        meeting_schedule: form.meeting_schedule.trim() || null,
      });

      toast.success("Course created", {
        description: "Next: upload your syllabus to unlock planning.",
      });
      router.push(`${routes.courseMaterials(newProject.id)}?firstRun=1`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create course.";
      setSubmitError(message);
      toast.error("Could not create course", { description: message });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Add a course
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Keep your class materials, deadlines, questions, and study notebook in one place.
        </p>
      </div>

      {templateId && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-700">
            Using template: <strong>{TEMPLATE_LABELS[templateId]}</strong>
          </span>
          <button
            onClick={() => router.replace(routes.newCourse)}
            className="ml-auto text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Remove
          </button>
        </div>
      )}

      {showClone && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-slate-700">
            Same kind of course as <strong>{lastCourse?.title}</strong>?
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-transparent text-slate-700 hover:bg-white"
            onClick={handleClone}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy settings
          </Button>
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
              <div className="md:col-span-2">
                {showPrefill ? (
                  <div className="space-y-3 rounded-xl border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] p-4">
                    <div className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-[var(--ck-primary)]" />
                      <p className="text-sm font-medium text-slate-900">
                        Paste your syllabus to autofill
                      </p>
                    </div>
                    <Textarea
                      value={syllabusText}
                      onChange={(e) => setSyllabusText(e.target.value)}
                      placeholder="Paste the syllabus text here — we'll pull out the course name, code, term, instructor, and schedule."
                      className="min-h-[120px] bg-white"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={applyPrefill}
                        disabled={prefilling || syllabusText.trim().length < 20}
                      >
                        {prefilling ? "Reading..." : "Extract details"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowPrefill(false)}
                        disabled={prefilling}
                      >
                        Cancel
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">
                      We only read the text to fill these fields — always review them before saving.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPrefill(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ck-primary)] hover:opacity-80"
                  >
                    <Wand2 className="h-4 w-4" />
                    Paste syllabus to autofill
                  </button>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="project-name" className="text-slate-900">
                  Course Name
                </Label>
                <Input
                  id="project-name"
                  placeholder="Organic Chemistry I"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  className="text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="subject-area" className="text-slate-900">Subject area</Label>
                <Input
                  id="subject-area"
                  list="subject-suggestions"
                  placeholder="Biology"
                  value={form.field_of_study}
                  onChange={(e) => updateField("field_of_study", e.target.value)}
                  className="text-slate-900 placeholder:text-slate-400"
                />
                <datalist id="subject-suggestions">
                  {SUBJECT_SUGGESTIONS.map((subject) => (
                    <option key={subject} value={subject} />
                  ))}
                </datalist>
              </div>

              {form.project_type === "school" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-slate-900">Course Code</Label>
                    <Input
                      placeholder="CHEM 101"
                      value={form.course_code}
                      onChange={(e) => updateField("course_code", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-900">Instructor</Label>
                    <Input
                      placeholder="Prof. Santos"
                      value={form.instructor}
                      onChange={(e) => updateField("instructor", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-slate-900">Term</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        value={semester}
                        onValueChange={(value) => updateTerm(value, academicYear)}
                      >
                        <SelectTrigger className="text-slate-700">
                          <SelectValue placeholder="Semester" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEMESTERS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={academicYear}
                        onValueChange={(value) => updateTerm(semester, value)}
                      >
                        <SelectTrigger className="text-slate-700">
                          <SelectValue placeholder="Academic year" />
                        </SelectTrigger>
                        <SelectContent>
                          {ayOptions.map((item) => (
                            <SelectItem key={item} value={item}>
                              AY {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.term && (
                      <p className="text-xs text-slate-500">Saved as: {form.term}</p>
                    )}
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <Label className="text-slate-900">Class Schedule</Label>
                    {scheduleBlocks.map((block, index) => (
                      <div
                        key={index}
                        className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {DAY_OPTIONS.map((day) => {
                            const active = block.days.includes(day.label);
                            return (
                              <button
                                key={day.label}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleDay(index, day.label)}
                                className={cn(
                                  "h-9 min-w-9 rounded-lg border px-2.5 text-sm font-medium transition",
                                  active
                                    ? "border-[var(--ck-primary)] bg-[var(--ck-primary)] text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                )}
                              >
                                {day.short}
                              </button>
                            );
                          })}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500">Start</Label>
                            <Input
                              type="time"
                              value={block.start}
                              onChange={(e) =>
                                updateBlock(index, { start: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500">End</Label>
                            <Input
                              type="time"
                              value={block.end}
                              onChange={(e) =>
                                updateBlock(index, { end: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500">Room</Label>
                            <Input
                              placeholder="Rm 204"
                              value={block.room}
                              onChange={(e) =>
                                updateBlock(index, { room: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        {scheduleBlocks.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSchedule(
                                scheduleBlocks.filter((_, i) => i !== index)
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
                          >
                            <X className="h-3.5 w-3.5" />
                            Remove block
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => updateSchedule([...scheduleBlocks, emptyBlock()])}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ck-primary)] hover:opacity-80"
                    >
                      <Plus className="h-4 w-4" />
                      Add another meeting time
                    </button>
                    {form.meeting_schedule && (
                      <p className="text-xs text-slate-500">
                        Saved as: {form.meeting_schedule}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-900">How should the notebook explain material?</Label>
                <Select
                  value={form.learning_mode}
                  onValueChange={(value) => updateField("learning_mode", value)}
                >
                  <SelectTrigger className="text-slate-700">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Clear and simple</SelectItem>
                    <SelectItem value="exam-cram">Focused exam review</SelectItem>
                    <SelectItem value="deep">Detailed study</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                You can still ask for simpler explanations, worked examples, or deeper detail inside the course later.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <Label className="text-slate-900">What may CourseKin use when answering?</Label>
              <Select
                value={form.source_mode}
                onValueChange={(value) => updateField("source_mode", value)}
              >
                <SelectTrigger className="text-slate-700">
                  <SelectValue placeholder="Choose source mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="source-only">Only my course materials</SelectItem>
                  <SelectItem value="source-web">Course materials plus cited web references</SelectItem>
                  <SelectItem value="compare">Compare uploaded sources</SelectItem>
                </SelectContent>
              </Select>
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
                {isSubmitting ? "Creating..." : "Add Course"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-slate-50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            <div className="flex-1">
              <p className="font-medium text-slate-900">Course setup preview</p>
              <p className="mt-1 text-sm text-slate-500">
                {templateId
                  ? `Template "${TEMPLATE_LABELS[templateId]}" will pre-configure your generation settings.`
                  : "Your course starts private. Add materials and choose when to build a notebook from them."}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <PreviewItem label="Course Name" value={form.title} />
                <PreviewItem label="Subject Area" value={form.field_of_study} />
                <PreviewItem label="Course Code" value={form.course_code} />
                <PreviewItem label="Instructor" value={form.instructor} />
                {form.project_type === "school" && (
                  <PreviewItem label="Term" value={form.term} />
                )}
                {form.project_type === "school" && (
                  <PreviewItem label="Class Schedule" value={form.meeting_schedule} />
                )}
                <PreviewItem
                  label="Study Approach"
                  value={form.learning_mode.replace("-", " ")}
                  capitalize
                />
                <PreviewItem
                  label={templateId ? "Template" : "Material Policy"}
                  value={
                    templateId
                      ? TEMPLATE_LABELS[templateId]
                      : form.source_mode.replace("-", " ")
                  }
                  capitalize
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewItem({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-medium text-slate-900",
          capitalize && "capitalize"
        )}
      >
        {value || "Not set"}
      </p>
    </div>
  );
}
