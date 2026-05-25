import Link from "next/link";
import { CheckCircle, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FREE_FEATURES = [
  "3 generations per day",
  "$0.25 / month generation budget",
  "All reviewer sections (summary, Q&A, flashcards, quiz…)",
  "Unlimited projects and sources",
  "PDF upload + URL sources",
];

const PLUS_FEATURES = [
  "50 generations per day",
  "$5.00 / month generation budget",
  "Everything in Free",
  "Priority support",
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 text-slate-600">
          Free to start. Upgrade to Plus when you need more.
          All payments handled by{" "}
          <a
            href="https://polar.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Polar
          </a>
          , our Merchant of Record — they handle taxes and receipts.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {/* Free */}
        <Card className="rounded-2xl shadow-sm md:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl text-slate-900">Free</CardTitle>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              $0
              <span className="text-base font-normal text-slate-500"> / month</span>
            </p>
            <p className="text-sm text-slate-500">No credit card required.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button variant="outline" className="w-full rounded-xl">
                Get started free
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Plus Monthly */}
        <Card className="rounded-2xl shadow-sm ring-1 ring-amber-200 md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl text-slate-900">Plus Monthly</CardTitle>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <Zap className="h-3 w-3" /> Popular
              </span>
            </div>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              $5.99
              <span className="text-base font-normal text-slate-500"> / month</span>
            </p>
            <p className="text-sm text-slate-500">Cancel anytime.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2.5">
              {PLUS_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button className="w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600">
                Upgrade to Plus
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Plus Yearly */}
        <Card className="rounded-2xl shadow-sm ring-2 ring-amber-400 md:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl text-slate-900">Plus Yearly</CardTitle>
              <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
                Save 44%
              </span>
            </div>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              $39.99
              <span className="text-base font-normal text-slate-500"> / year</span>
            </p>
            <p className="text-sm text-slate-500">
              Same as $3.33 / month. Billed once a year.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2.5">
              {PLUS_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button className="w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600">
                Upgrade to Plus Yearly
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="mt-12 text-sm text-slate-500">
        Questions?{" "}
        <a href="mailto:support@coursekin.app" className="underline underline-offset-2">
          Email us
        </a>
        . All prices in USD. Taxes calculated at checkout by Polar.
      </p>
    </main>
  );
}
