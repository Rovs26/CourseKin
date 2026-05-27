import Link from "next/link";

export const metadata = {
  title: "Terms of Use — CourseKin",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--ck-primary)]">
            CourseKin
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: May 26, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptance</h2>
            <p className="mt-3">
              By creating an account or using CourseKin, you agree to these terms. If you do not
              agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. Eligibility</h2>
            <p className="mt-3">
              You must be at least <strong>16 years old</strong> to use CourseKin. If you are
              between 13 and 16, you may only use the service with verifiable parental consent as
              required by COPPA or applicable local law.
            </p>
            <p className="mt-3">
              By using CourseKin, you confirm that you meet this age requirement. We chose 16 as
              the minimum because GDPR Article 8 sets 16 as the default age of consent for data
              processing across the EU. If we discover that a user is under 16 without parental
              consent, we will delete their account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. What CourseKin Does</h2>
            <p className="mt-3">
              CourseKin is a study tool that generates structured review materials (summaries, key
              points, definitions, Q&amp;A, quizzes, and flashcards) from content you provide.
              It may also extract proposed assessments and due dates from a syllabus for your
              review. Content generation and extraction are powered by third-party AI models
              (currently OpenAI).
            </p>
            <p className="mt-3">
              Extracted course obligations are proposals only. You must review and confirm them
              before using a generated calendar file or relying on a deadline.
            </p>
            <p className="mt-3">
              Preparation sessions are scheduling suggestions based on deadlines you confirm and
              the daily capacity you select. Completing sessions tracks preparation activity only;
              it does not guarantee subject mastery or assessment performance.
            </p>
            <p className="mt-3">
              In-app reminders are convenience prompts based on your saved plan and settings.
              You remain responsible for tracking official course deadlines and submissions.
            </p>
            <p className="mt-3">
              The private course stream stores notes, questions, reflections, and references to
              course materials that you add to a course timeline. Saving an entry does not
              generate an AI answer. When you request an answer for a question, CourseKin attempts
              to answer only from the course materials you attached and displays the cited
              evidence; it does not automatically search the web.
            </p>
            <p className="mt-3">
              Coursework coaching supports preparation for light assignments, short papers, and
              office hours by providing evidence-linked checklists and feedback from selected
              course materials and confirmed rubric context. It does not provide finished
              submissions, presentations or slide decks, thesis-level writing, complex data-heavy
              papers, or group-paper authorship.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Your Content</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>You retain ownership of all content you upload to CourseKin.</li>
              <li>
                You grant CourseKin a limited, non-exclusive license to process your content
                solely for the purpose of generating your requested study materials and providing
                the service to you.
              </li>
              <li>
                You are responsible for ensuring you have the right to upload and process any
                content you submit.
              </li>
              <li>
                Generated reviewer content is derived from your source material and is provided for
                your personal educational use.
              </li>
              <li>
                You can edit or delete your private course-stream entries, and they are included
                when you export or delete your account data.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Acceptable Use</h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Upload copyrighted material that you do not own or do not have a license to use.
              </li>
              <li>
                Upload material that violates another person&apos;s privacy (e.g., private
                communications, personal medical records belonging to others).
              </li>
              <li>
                Use generated content to cheat on exams or assessments where the use of AI-assisted
                tools is explicitly prohibited by your institution.
              </li>
              <li>Upload content that is illegal, harmful, or violates the rights of others.</li>
              <li>
                Attempt to circumvent rate limits, authentication, or other security measures.
              </li>
              <li>Resell or redistribute generated content commercially.</li>
              <li>Use automated tools to scrape or bulk-access the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. AI Accuracy Disclaimer</h2>
            <p className="mt-3">
              Generated flashcards, summaries, and quizzes may contain errors, omissions, or
              inaccuracies. <strong>CourseKin is a study aid, not a source of truth.</strong>{" "}
              Always verify important facts against your original source material before relying on
              generated content for exams, research, or any consequential purpose.
            </p>
            <p className="mt-3">
              AI-generated content reflects patterns in training data and may reflect biases or
              outdated information. CourseKin makes no warranty as to the accuracy, completeness,
              or fitness for any particular purpose of any generated output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Service Availability</h2>
            <p className="mt-3">
              CourseKin is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
              We do not guarantee uptime or uninterrupted access. We may modify, suspend, or
              discontinue the service at any time, with or without notice, particularly during the
              early/free access period. We will make reasonable efforts to notify users of
              significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Account Termination</h2>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
            <p className="mt-3">
              You may delete your account at any time using the{" "}
              <Link href="/settings/account" className="font-medium text-slate-900 underline">
                Delete my account
              </Link>{" "}
              button in Settings → Account. Upon deletion, your personal data will be permanently
              removed from our systems within 30 days, in accordance with our{" "}
              <Link href="/privacy" className="font-medium text-slate-900 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Intellectual Property</h2>
            <p className="mt-3">
              The CourseKin application, including its design, code, and branding, is our
              intellectual property. Your use of the service does not grant you any rights to our
              intellectual property beyond what is necessary to use the service.
            </p>
            <p className="mt-3">
              If you believe content on CourseKin infringes your intellectual property rights,
              contact us at{" "}
              <a href="mailto:legal@coursekin.app" className="font-medium text-slate-900 underline">
                legal@coursekin.app
              </a>{" "}
              with details of the alleged infringement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Limitation of Liability</h2>
            <p className="mt-3">
              To the maximum extent permitted by law, CourseKin and its operators are not liable
              for any indirect, incidental, or consequential damages arising from your use of the
              service, including any reliance on AI-generated content. Our total liability is
              limited to the amount you have paid for the service in the three months preceding
              the claim, if any.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">11. Governing Law</h2>
            <p className="mt-3">
              These terms are governed by the laws of the Republic of the Philippines, without
              regard to conflict-of-law principles. Any disputes arising from these terms or your
              use of CourseKin shall be resolved in the courts of the Philippines, unless
              applicable consumer protection law in your jurisdiction requires otherwise.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">12. Changes to These Terms</h2>
            <p className="mt-3">
              We may update these terms from time to time. Continued use of the service after
              changes constitutes acceptance of the updated terms. We will update the date at the
              top of this page when changes are made.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">13. Contact</h2>
            <p className="mt-3">
              Questions about these terms? Contact us at{" "}
              <a href="mailto:legal@coursekin.app" className="font-medium text-slate-900 underline">
                legal@coursekin.app
              </a>
              .
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} CourseKin</p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="font-medium text-slate-900">Terms</Link>
            <Link href="/legal/dpa" className="hover:text-slate-900">Subprocessors</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
