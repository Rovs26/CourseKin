import Link from "next/link";

export const metadata = {
  title: "Terms of Use — ReviewFlow",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            ReviewFlow
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: April 15, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. Acceptance</h2>
            <p className="mt-3">
              By creating an account or using ReviewFlow, you agree to these terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. What ReviewFlow Does</h2>
            <p className="mt-3">
              ReviewFlow is a study tool that generates structured review materials (summaries, key points, definitions, Q&A, quizzes, and flashcards) from content you provide. Content generation is powered by third-party AI models (currently OpenAI).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Your Content</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>You retain ownership of all content you upload to ReviewFlow.</li>
              <li>You grant ReviewFlow a limited license to process your content solely for the purpose of generating reviewer materials.</li>
              <li>You are responsible for ensuring you have the right to upload and process any content you submit. Do not upload copyrighted material you do not have permission to use.</li>
              <li>Generated reviewer content is derived from your source material and is provided for your personal educational use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Acceptable Use</h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Upload content that is illegal, harmful, or violates the rights of others.</li>
              <li>Attempt to circumvent rate limits, authentication, or other security measures.</li>
              <li>Use the service to generate content for purposes other than personal study and education.</li>
              <li>Resell or redistribute generated content commercially.</li>
              <li>Use automated tools to scrape or bulk-access the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Service Availability</h2>
            <p className="mt-3">
              ReviewFlow is provided on an &quot;as is&quot; basis. We do not guarantee uptime, accuracy of generated content, or uninterrupted access. We may modify, suspend, or discontinue the service at any time. Generated content may contain errors — always verify important information independently.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Intellectual Property</h2>
            <p className="mt-3">
              The ReviewFlow application, including its design, code, and branding, is our intellectual property. Your use of the service does not grant you any rights to our intellectual property beyond what is necessary to use the service.
            </p>
            <p className="mt-3">
              If you believe content on ReviewFlow infringes your intellectual property rights, contact us at{" "}
              <a href="mailto:legal@reviewflow.app" className="font-medium text-slate-900 underline">
                legal@reviewflow.app
              </a>{" "}
              with details of the alleged infringement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Limitation of Liability</h2>
            <p className="mt-3">
              To the maximum extent permitted by law, ReviewFlow and its operators are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you have paid for the service, if any.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Account Termination</h2>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time by contacting us. Upon deletion, your data will be permanently removed.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Changes to These Terms</h2>
            <p className="mt-3">
              We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">10. Contact</h2>
            <p className="mt-3">
              Questions about these terms? Contact us at{" "}
              <a href="mailto:legal@reviewflow.app" className="font-medium text-slate-900 underline">
                legal@reviewflow.app
              </a>.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} ReviewFlow</p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="font-medium text-slate-900">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
