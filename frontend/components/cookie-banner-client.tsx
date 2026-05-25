"use client";

import { useState } from "react";

function setConsentCookie(value: "all" | "essential") {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  document.cookie = `reviewflow-consent=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function CookieBannerClient() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  function handleAcceptAll() {
    setConsentCookie("all");
    setVisible(false);
  }

  function handleEssentialOnly() {
    setConsentCookie("essential");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-4 py-4 shadow-lg sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          We use essential cookies for authentication (Clerk) and error tracking (Sentry). No
          advertising or analytics cookies are used.{" "}
          <a href="/privacy#9-cookies" className="font-medium text-slate-900 underline">
            Learn more
          </a>
          .
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={handleEssentialOnly}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Only essential
          </button>
          <button
            onClick={handleAcceptAll}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
