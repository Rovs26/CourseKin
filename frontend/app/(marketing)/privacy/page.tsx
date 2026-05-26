import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — CourseKin",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: May 25, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. What We Collect</h2>
            <p className="mt-3">When you use CourseKin, we collect the following categories of information:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Account information:</strong> Your name, email address, and Clerk user ID,
                provided when you sign up through our authentication provider (Clerk).
              </li>
              <li>
                <strong>Content you provide:</strong> PDFs you upload, URLs you paste, and text you
                enter as source material. Generated output (flashcards, summaries, Q&amp;A, quizzes)
                derived from that content.
              </li>
              <li>
                <strong>Course planning information:</strong> Optional course code, academic term,
                instructor, class schedule, syllabus-derived assessment proposals, your corrections,
                and deadlines you confirm for calendar export.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, browser user agent, timestamps of
                requests, API response times, and error logs. This data is used for security,
                abuse prevention, and service reliability.
              </li>
              <li>
                <strong>Payment information:</strong> If you subscribe to a paid plan, payments are
                processed by Polar (our merchant of record). CourseKin never sees or stores your
                card number or full payment details.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. How We Use Your Data</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>To generate study materials from your uploaded content.</li>
              <li>To store your course workspaces, proposed obligations, confirmations, and generated output so you can access them later.</li>
              <li>To create calendar files only from deadlines you explicitly confirm.</li>
              <li>To enforce usage quotas, rate limits, and abuse prevention.</li>
              <li>To improve service reliability through error monitoring and structured logging.</li>
              <li>To send transactional emails (e.g., account-related notifications) via Resend.</li>
            </ul>
            <p className="mt-3">
              We do not sell your data. We do not use your content to train AI models.
              We do not use advertising cookies or share data with ad networks.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. AI-Specific Disclosures</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                Your uploaded text is sent to the <strong>OpenAI API</strong> to generate study
                materials. This processing is covered by OpenAI&apos;s API data usage policy.
              </li>
              <li>
                OpenAI states that API data is <strong>not used to train models by default</strong>.
                Abuse monitoring logs may retain content for up to 30 days by default, subject to
                legal, security, and feature-specific exceptions in OpenAI&apos;s current policy.
              </li>
              <li>
                CourseKin does <strong>not</strong> use your content to train our own models.
              </li>
              <li>
                <strong>Generated output may contain errors.</strong> CourseKin is a study aid,
                not a source of truth. Always verify important facts against your original source
                material.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Subprocessors</h2>
            <p className="mt-3">
              We rely on the following third-party subprocessors to operate CourseKin. Each
              subprocessor is bound by a Data Processing Agreement (DPA) and applicable data
              protection law. Full details are on our{" "}
              <Link href="/legal/dpa" className="font-medium text-slate-900 underline">
                Subprocessor List
              </Link>
              .
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>OpenAI</strong> — AI content generation (USA)</li>
              <li><strong>Clerk</strong> — Authentication and user management (USA)</li>
              <li><strong>Cloudflare</strong> — Hosting, CDN, and file storage via R2 (global)</li>
              <li><strong>Neon</strong> — PostgreSQL database (USA)</li>
              <li><strong>Sentry</strong> — Error tracking (USA / EU)</li>
              <li><strong>Axiom</strong> — Structured logging (USA)</li>
              <li><strong>Resend</strong> — Transactional email (USA)</li>
              <li><strong>Railway</strong> — Backend hosting (USA)</li>
              <li><strong>Vercel</strong> — Frontend hosting (USA)</li>
              <li>
                <strong>Polar</strong> — Payments and billing, merchant of record (Sweden / USA) —
                only active if you subscribe to a paid plan
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Data Retention</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>
                Your course workspaces, sources, planning records, and generated content are
                retained as long as your account is active.
              </li>
              <li>
                After account deletion, your personal data is wiped from our systems within{" "}
                <strong>30 days</strong>, including from database backups.
              </li>
              <li>
                Uploaded files stored on Cloudflare R2 are deleted at the time of account
                deletion or when you delete the associated project.
              </li>
              <li>
                OpenAI API abuse monitoring logs may retain inputs and outputs for up to 30 days
                by default, with the exceptions described in OpenAI&apos;s API data policy.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. International Transfers</h2>
            <p className="mt-3">
              CourseKin is operated from the Philippines and uses subprocessors primarily based
              in the United States. If you are located in the European Economic Area (EEA), United
              Kingdom, or Switzerland, your personal data may be transferred to countries that do
              not have the same data protection laws as your home country.
            </p>
            <p className="mt-3">
              For transfers from the EEA, UK, or Switzerland to the USA, we rely on Standard
              Contractual Clauses (SCCs) incorporated into the DPAs we have signed with each
              subprocessor. A list of those subprocessors and their safeguards is available on our{" "}
              <Link href="/legal/dpa" className="font-medium text-slate-900 underline">
                Subprocessor List
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Your Rights</h2>
            <p className="mt-3">Depending on where you live, you have the following rights:</p>
            <p className="mt-2 font-medium text-slate-800">GDPR (EU/UK/EEA residents)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li><strong>Access:</strong> Request a copy of the data we hold about you.</li>
              <li><strong>Rectification:</strong> Ask us to correct inaccurate data.</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;).</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests.</li>
              <li><strong>Restriction:</strong> Ask us to limit processing of your data in certain circumstances.</li>
            </ul>
            <p className="mt-3 font-medium text-slate-800">CCPA (California residents)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>The right to know what personal information we collect and how we use it.</li>
              <li>The right to delete your personal information.</li>
              <li>The right to opt out of the sale of personal information (we do not sell data).</li>
              <li>The right to non-discrimination for exercising your privacy rights.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@coursekin.app" className="font-medium text-slate-900 underline">
                privacy@coursekin.app
              </a>{" "}
              or use the <strong>Export my data</strong> and <strong>Delete my account</strong>{" "}
              buttons in{" "}
              <Link href="/settings/account" className="font-medium text-slate-900 underline">
                Settings → Account
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Children</h2>
            <p className="mt-3">
              CourseKin is not intended for users under the age of 16. We do not knowingly
              collect personal information from anyone under 16. If we become aware that a user
              is under 16, we will delete their account and associated data promptly. If you
              believe a child under 16 has provided us with personal information, please contact
              us at{" "}
              <a href="mailto:privacy@coursekin.app" className="font-medium text-slate-900 underline">
                privacy@coursekin.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Cookies</h2>
            <p className="mt-3">
              CourseKin uses only essential cookies required for authentication and session
              management (set by Clerk) and for storing your cookie consent preference. We do
              not use advertising or analytics cookies. For users in the EU/EEA/UK, a cookie
              consent banner will appear on your first visit.
            </p>
            <p className="mt-3">
              Local preferences (theme, export settings) are stored in your browser&apos;s
              localStorage and are never sent to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Changes to This Policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. We will notify users of significant
              changes by updating the date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">11. Contact</h2>
            <p className="mt-3">
              Questions about this privacy policy or your data? Contact us at{" "}
              <a href="mailto:privacy@coursekin.app" className="font-medium text-slate-900 underline">
                privacy@coursekin.app
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
            <Link href="/privacy" className="font-medium text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/legal/dpa" className="hover:text-slate-900">Subprocessors</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
