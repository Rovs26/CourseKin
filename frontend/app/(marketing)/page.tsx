import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export default function LandingPage() {
  return (
    <main className="brand-wash min-h-screen">
      <nav className="border-b border-[var(--rf-border)] bg-white/70 backdrop-blur">
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

      <section className="mx-auto max-w-5xl px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <span className="inline-flex rounded-full border border-[var(--ck-primary-border)] bg-[var(--ck-primary-soft)] px-3 py-1 text-sm font-medium text-[var(--ck-primary)]">
            Your academic course companion
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Turn course material<br />into study momentum.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Paste text, upload a PDF, or add a URL. CourseKin builds summaries, key points, definitions, flashcards, and quizzes for focused preparation.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link href={routes.newProject}>Start a project</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-px overflow-hidden rounded-2xl border border-[var(--rf-border)] bg-[var(--rf-border)] shadow-sm sm:grid-cols-3">
          {[
            { title: "Summaries & Key Points", desc: "Condensed overviews and the most important takeaways from your material." },
            { title: "Definitions & Q&A", desc: "Key terms with clear definitions, plus question-and-answer pairs for active recall." },
            { title: "Flashcards & Quiz", desc: "Flip-card flashcards and multiple-choice quizzes generated from your content." },
          ].map((item) => (
            <div key={item.title} className="bg-white p-6">
              <p className="font-medium text-slate-900">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-[var(--rf-border)] bg-white/75 p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">How it works</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Add your source", desc: "Paste notes, upload a PDF, or enter a URL." },
              { step: "2", title: "Generate reviewer", desc: "CourseKin creates 6 study sections from your content." },
              { step: "3", title: "Study or export", desc: "Review online, annotate, then download as PDF." },
            ].map((item) => (
              <div key={item.step}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--ck-primary-soft)] text-sm font-semibold text-[var(--ck-primary)]">
                  {item.step}
                </div>
                <p className="mt-3 font-medium text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--rf-border)] bg-white/60">
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
