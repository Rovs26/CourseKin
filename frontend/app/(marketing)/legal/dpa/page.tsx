import Link from "next/link";

export const metadata = {
  title: "Subprocessor List — ReviewFlow",
};

const subprocessors = [
  {
    name: "OpenAI",
    role: "AI content generation",
    location: "United States",
    data: "Source text you upload (to generate study materials)",
    safeguards: "Standard Contractual Clauses (SCCs); API data not used for model training per OpenAI API data usage policy",
    dpa: "platform.openai.com/account/data-controls",
  },
  {
    name: "Clerk",
    role: "Authentication and user management",
    location: "United States",
    data: "Email address, name, login credentials, session tokens",
    safeguards: "SCCs; SOC 2 Type II certified; DPA available on Clerk's website (automatic for paid tier)",
    dpa: "clerk.com/legal/dpa",
  },
  {
    name: "Cloudflare",
    role: "CDN, DDoS protection, and file storage (R2)",
    location: "Global (data centres in USA, EU, and other regions)",
    data: "All HTTP traffic passes through Cloudflare. Uploaded PDF files are stored in Cloudflare R2.",
    safeguards: "SCCs; ISO 27001; DPA available in Cloudflare dashboard under Billing",
    dpa: "cloudflare.com/cloudflare-customer-dpa",
  },
  {
    name: "Neon",
    role: "PostgreSQL database hosting",
    location: "United States (AWS us-east-1 by default)",
    data: "All application data: projects, sources, generated content, usage logs",
    safeguards: "SCCs; data encrypted at rest and in transit; DPA available on Neon's website (automatic on Launch plan and above)",
    dpa: "neon.tech/dpa",
  },
  {
    name: "Sentry",
    role: "Error tracking and performance monitoring",
    location: "United States (with EU data residency option)",
    data: "Error stack traces, request metadata (URL, HTTP method, status code). Configured with send_default_pii=false — no email addresses or user content in error reports.",
    safeguards: "SCCs; SOC 2 Type II; DPA available at sentry.io/legal/dpa",
    dpa: "sentry.io/legal/dpa",
  },
  {
    name: "Axiom",
    role: "Structured log aggregation",
    location: "United States",
    data: "Application logs: log level, logger name, module, message. No user content in logs.",
    safeguards: "SCCs; data encrypted at rest and in transit",
    dpa: "axiom.co/legal/dpa",
  },
  {
    name: "Resend",
    role: "Transactional email delivery",
    location: "United States",
    data: "Email address and email content for transactional messages (e.g., account notifications)",
    safeguards: "SCCs; data encrypted in transit",
    dpa: "resend.com/legal/dpa",
  },
  {
    name: "Railway",
    role: "Backend API hosting",
    location: "United States",
    data: "API application code and environment variables (including secrets)",
    safeguards: "SCCs; SOC 2 Type II; data encrypted at rest and in transit",
    dpa: "railway.app/legal/privacy",
  },
  {
    name: "Vercel",
    role: "Frontend hosting and edge functions",
    location: "United States (global edge network)",
    data: "Frontend application code; request logs at the edge",
    safeguards: "SCCs; SOC 2 Type II; DPA available at vercel.com/legal/dpa",
    dpa: "vercel.com/legal/dpa",
  },
  {
    name: "Polar",
    role: "Payment processing and billing (merchant of record)",
    location: "Sweden / United States",
    data: "Payment information, subscription status, billing email. ReviewFlow does not see full card numbers.",
    safeguards: "GDPR-compliant as EU-based merchant; PCI DSS compliant for payment processing; DPA available from Polar",
    dpa: "polar.sh/legal",
    note: "Only active if you subscribe to a paid plan.",
  },
];

export default function DpaPage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            ReviewFlow
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Subprocessor List</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: April 25, 2026</p>

        <div className="mt-6 text-sm leading-7 text-slate-600">
          <p>
            ReviewFlow uses the following third-party subprocessors to provide its service. All
            subprocessors are bound by a Data Processing Agreement (DPA) and handle personal data
            only as instructed by ReviewFlow, for the purposes described below.
          </p>
          <p className="mt-3">
            For transfers from the EU/EEA/UK to the United States, we rely on Standard Contractual
            Clauses (SCCs) incorporated into each subprocessor&apos;s DPA. We review this list
            when adding or removing subprocessors and update the date above.
          </p>
          <p className="mt-3">
            To receive advance notice of subprocessor changes, or to object to a new subprocessor,
            contact{" "}
            <a href="mailto:privacy@reviewflow.app" className="font-medium text-slate-900 underline">
              privacy@reviewflow.app
            </a>
            .
          </p>
        </div>

        <div className="mt-10 space-y-6">
          {subprocessors.map((sp) => (
            <div key={sp.name} className="rounded-2xl border border-slate-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{sp.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{sp.role}</p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {sp.location}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="font-medium text-slate-700">Data processed</dt>
                  <dd className="text-slate-600">{sp.data}</dd>
                </div>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <dt className="font-medium text-slate-700">Safeguards</dt>
                  <dd className="text-slate-600">{sp.safeguards}</dd>
                </div>
                {sp.note && (
                  <div className="grid grid-cols-[140px_1fr] gap-2">
                    <dt className="font-medium text-slate-700">Note</dt>
                    <dd className="text-slate-600">{sp.note}</dd>
                  </div>
                )}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
          <h2 className="font-semibold text-slate-900">Signing DPAs</h2>
          <p className="mt-2">
            If you require a signed DPA with ReviewFlow for your own GDPR compliance, contact{" "}
            <a href="mailto:privacy@reviewflow.app" className="font-medium text-slate-900 underline">
              privacy@reviewflow.app
            </a>
            . During early access, we will review DPA requests on a case-by-case basis.
          </p>
        </div>
      </article>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
          <p className="text-sm text-slate-500">&copy; {new Date().getFullYear()} ReviewFlow</p>
          <div className="flex gap-4 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
            <Link href="/legal/dpa" className="font-medium text-slate-900">Subprocessors</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
