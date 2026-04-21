import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ReviewFlow",
};

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: April 15, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">1. What We Collect</h2>
            <p className="mt-3">
              When you use ReviewFlow, we collect the following information:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Account information:</strong> Your name and email address, provided through our authentication provider (Clerk).</li>
              <li><strong>Content you upload:</strong> Text, PDFs, and URLs you submit as source material for reviewer generation.</li>
              <li><strong>Generated content:</strong> Summaries, key points, definitions, Q&A, quiz questions, and flashcards created from your sources.</li>
              <li><strong>Usage data:</strong> Basic request logs including timestamps, API endpoints accessed, and response times. We do not track page views or use analytics cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">2. How We Use Your Data</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>To generate study reviewers from your uploaded content.</li>
              <li>To store your projects and generated reviewers so you can access them later.</li>
              <li>To improve service reliability through error monitoring and request logging.</li>
            </ul>
            <p className="mt-3">
              We do not sell your data. We do not use your content to train AI models. Your uploaded materials are used solely to generate your requested reviewer content via the OpenAI API.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">3. Third-Party Services</h2>
            <p className="mt-3">We use the following third-party services:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>OpenAI API:</strong> Your source text is sent to OpenAI to generate reviewer content. OpenAI&apos;s data usage policies apply to this processing. Per OpenAI&apos;s API data usage policy, API inputs and outputs are not used to train their models.</li>
              <li><strong>Clerk:</strong> Handles user authentication. Clerk stores your email address and login credentials according to their privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">4. Data Storage and Security</h2>
            <p className="mt-3">
              Your data is stored in our database. Uploaded PDF files are stored on our server. We use standard security practices including HTTPS encryption, rate limiting, and input validation. However, no system is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">5. Data Retention and Deletion</h2>
            <p className="mt-3">
              Your projects, sources, and generated reviewers are retained as long as your account is active. You can delete individual projects at any time, which permanently removes the project, its sources, uploaded files, and generated reviewer content. To delete your account entirely, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">6. Your Rights</h2>
            <p className="mt-3">You have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access the data we store about you.</li>
              <li>Delete your projects and uploaded content at any time.</li>
              <li>Request complete account deletion.</li>
              <li>Export your generated reviewer content as PDF.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">7. Cookies</h2>
            <p className="mt-3">
              ReviewFlow uses only essential cookies required for authentication and session management. We do not use advertising or analytics cookies. Local preferences (theme, export settings) are stored in your browser&apos;s localStorage and are never sent to our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">8. Changes to This Policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. We will notify users of significant changes by updating the date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900">9. Contact</h2>
            <p className="mt-3">
              If you have questions about this privacy policy or your data, contact us at{" "}
              <a href="mailto:privacy@reviewflow.app" className="font-medium text-slate-900 underline">
                privacy@reviewflow.app
              </a>.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} ReviewFlow</p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="font-medium text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
