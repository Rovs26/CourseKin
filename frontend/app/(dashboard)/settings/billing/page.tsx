"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Zap, CheckCircle, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/coursekin-api";
const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

type SubscriptionData = {
  plan: string;                     // "free" | "plus_monthly" | "plus_yearly"
  status: string | null;
  current_period_end: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "free") {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
        Free
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
      <Zap className="h-3.5 w-3.5" />
      Plus
    </span>
  );
}

function BillingContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "1";

  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [checkingOut, setCheckingOut] = useState<string | null>(null); // plan being checked out
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Fetch current subscription on mount
  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/billing/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Failed to load subscription (${res.status})`);
        setSub(await res.json());
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load billing info");
      }
    }
    load();
  }, [getToken]);

  async function handleUpgrade(plan: "plus_monthly" | "plus_yearly") {
    setCheckingOut(plan);
    setCheckoutError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/billing/checkout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `Checkout failed (${res.status})`);
      }
      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
      setCheckingOut(null);
    }
  }

  const isPlus = sub !== null && sub.plan !== "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your plan and subscription.
        </p>
      </div>

      {upgraded && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
          Welcome to Plus! Your subscription is now active.
        </div>
      )}

      {!BILLING_ENABLED && !isPlus && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Plus plans are in controlled testing and are not available for purchase yet.
        </div>
      )}

      {/* Current plan */}
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <CreditCard className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl text-slate-900">Current plan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
          ) : sub === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <PlanBadge plan={sub.plan} />
              {isPlus && sub.current_period_end && (
                <p className="text-sm text-slate-500">
                  Renews {formatDate(sub.current_period_end)}
                </p>
              )}
              {!isPlus && (
                <p className="text-sm text-slate-500">
                  3 generations / day &nbsp;·&nbsp; $0.25 / month limit
                </p>
              )}
              {isPlus && (
                <a
                  href="https://polar.sh/purchases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  Manage subscription on Polar
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade cards — shown only on free plan */}
      {sub !== null && !isPlus && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Monthly */}
          <Card className="rounded-2xl shadow-sm ring-1 ring-amber-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl text-slate-900">Plus Monthly</CardTitle>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                  $5.99 / mo
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  50 generations per day
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  $5.00 monthly spend allowance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  Cancel anytime
                </li>
              </ul>
              {checkoutError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}
              <Button
                onClick={() => handleUpgrade("plus_monthly")}
                disabled={!BILLING_ENABLED || checkingOut !== null}
                className="w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600"
              >
                {!BILLING_ENABLED
                  ? "Coming soon"
                  : checkingOut === "plus_monthly"
                  ? "Redirecting…"
                  : "Upgrade to Plus Monthly"}
              </Button>
            </CardContent>
          </Card>

          {/* Yearly */}
          <Card className="rounded-2xl shadow-sm ring-2 ring-amber-400">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <CardTitle className="text-xl text-slate-900">Plus Yearly</CardTitle>
                  <p className="text-xs text-amber-700 font-medium">Save 44% vs monthly</p>
                </div>
                <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-semibold text-white">
                  $39.99 / yr
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  50 generations per day
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  $5.00 monthly spend allowance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  Best value — billed once a year
                </li>
              </ul>
              {checkoutError && checkingOut !== "plus_monthly" && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}
              <Button
                onClick={() => handleUpgrade("plus_yearly")}
                disabled={!BILLING_ENABLED || checkingOut !== null}
                className="w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600"
              >
                {!BILLING_ENABLED
                  ? "Coming soon"
                  : checkingOut === "plus_yearly"
                  ? "Redirecting…"
                  : "Upgrade to Plus Yearly"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Payments are processed by{" "}
        <a
          href="https://polar.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          Polar
        </a>
        , our Merchant of Record. They handle billing, taxes, and receipts on our behalf.
      </p>
    </div>
  );
}

// useSearchParams requires a Suspense boundary in Next.js 15
export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
