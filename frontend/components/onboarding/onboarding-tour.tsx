"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  GraduationCap,
  MessagesSquare,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "coursekin:onboarding-tour:v1";

type Step = {
  icon: typeof Sparkles;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to your course",
    body: "CourseKin turns your syllabus and notes into a study plan, a cited notebook, and timed practice. Here's the quick tour — about 30 seconds.",
  },
  {
    icon: BookOpen,
    title: "1. Add your materials",
    body: "Open Materials and drop in your syllabus (PDF, URL, or pasted text), then your notes and readings. We index everything for citations.",
  },
  {
    icon: CalendarRange,
    title: "2. Plan the term",
    body: "Plan extracts assessment dates and topics from your syllabus. Review each date, then we schedule study sessions on your calendar.",
  },
  {
    icon: MessagesSquare,
    title: "3. Study with your Notebook",
    body: "The Reviewer and Notebook give you summaries, flashcards with spaced review, and a grounded chat that answers only from your own materials.",
  },
  {
    icon: GraduationCap,
    title: "4. Test yourself with Exams",
    body: "Build timed mock exams weighted toward your weak topics. Missed questions become flashcards so the gaps close over time.",
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== "done") {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (private mode) — skip the tour silently.
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white p-6 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]">
          <Icon className="h-6 w-6" />
        </span>
        <h2
          id="onboarding-tour-title"
          className="mt-4 text-lg font-semibold text-slate-900"
        >
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{current.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-5 bg-[var(--ck-primary)]" : "w-1.5 bg-slate-200"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={dismiss}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>

        {!isLast && (
          <button
            onClick={dismiss}
            className="mt-3 w-full text-center text-xs text-slate-400 transition hover:text-slate-600"
          >
            Skip tour
          </button>
        )}
      </div>
    </div>
  );
}
