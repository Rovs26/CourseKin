import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function LandingPage() {
  return (
    <main className="brand-wash min-h-screen">
      <nav className="border-b border-[var(--rf-border)] bg-[var(--rf-card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ck-primary)] text-xs font-bold tracking-tight text-white">
              CK
            </span>
            <p className="text-lg font-semibold tracking-tight text-slate-900">CourseKin</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/sign-up">Sign up</Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] px-3 py-1 text-sm font-medium text-[var(--ck-primary)]">
            Your course desk
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.12]">
            Keep each class organized.<br />Study from what you actually learned.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Add a course, bring in its syllabus and materials, confirm important dates,
            and build a cited study notebook when you are ready.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link href={routes.newCourse}>Add your first course</Link>
            </Button>
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-[var(--rf-border)] bg-[var(--rf-card)] p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ck-primary)]">
            The first course workflow
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">
            From syllabus to a study plan you approved
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { step: "01", title: "Add a course", desc: "Set the term and schedule." },
              { step: "02", title: "Add materials", desc: "Upload a syllabus or class notes." },
              { step: "03", title: "Confirm dates", desc: "Review tasks before export." },
              { step: "04", title: "Capture class", desc: "Save notes and questions." },
              { step: "05", title: "Build notebook", desc: "Study with cited output." },
            ].map((item) => (
              <div key={item.step}>
                <p className="text-xs font-semibold text-[var(--ck-primary)]">{item.step}</p>
                <p className="mt-3 font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[var(--rf-border)] bg-[var(--rf-border)] sm:grid-cols-3">
          {[
            "No calendar date is exported until you confirm it.",
            "Answers can stay grounded in your course material.",
            "Assignment help is guidance for short work, not finished submissions.",
          ].map((item) => (
            <p key={item} className="bg-[var(--rf-card)] p-6 text-sm leading-6 text-slate-600">
              {item}
            </p>
          ))}
        </div>
      </section>

      <footer className="border-t border-[var(--rf-border)] bg-[var(--rf-card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CourseKin</p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
