"use client";

import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function TurnstileWidget({ onSuccess, onExpire }: TurnstileWidgetProps) {
  if (!SITE_KEY) {
    // Dev mode: call onSuccess immediately so the generate flow isn't blocked
    // when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured
    return (
      <div className="flex h-[65px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
        Turnstile disabled in dev
      </div>
    );
  }

  return (
    <Turnstile
      siteKey={SITE_KEY}
      onSuccess={onSuccess}
      onExpire={onExpire}
      options={{ theme: "light", size: "normal" }}
    />
  );
}
