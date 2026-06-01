"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Copy, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CalendarSubscription,
  getCalendarSubscription,
  rotateCalendarSubscription,
} from "@/lib/coursekin-api";

const glassSurfaceSubtle =
  "rounded-3xl border border-white/40 bg-white/50 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl";

export function CalendarSubscribeCard() {
  const [sub, setSub] = useState<CalendarSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSub(await getCalendarSubscription());
    } catch {
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async () => {
    if (!sub) return;
    try {
      await navigator.clipboard.writeText(sub.feed_url);
      setCopied(true);
      toast.success("Feed URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy the URL manually.");
    }
  };

  const rotate = async () => {
    setRotating(true);
    try {
      setSub(await rotateCalendarSubscription());
      toast.success("Subscription link reset", {
        description: "The old URL no longer works. Re-subscribe with the new link.",
      });
    } catch (err) {
      toast.error("Could not reset link", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRotating(false);
    }
  };

  return (
    <Card className={`${glassSurfaceSubtle} p-5`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ck-primary-soft)] text-[var(--ck-primary)]">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">
            Subscribe in your calendar app
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Add your confirmed deadlines, study sessions, and dated tasks to Apple or Google
            Calendar. It refreshes automatically as your plan changes.
          </p>

          {loading ? (
            <div className="mt-3 h-9 animate-pulse rounded-xl bg-white/60" />
          ) : sub ? (
            <>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="sm"
                  className="rounded-full"
                >
                  <a href={sub.webcal_url}>Add to calendar</a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full bg-white/70 backdrop-blur-md hover:bg-white"
                  onClick={copy}
                >
                  {copied ? (
                    <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="mr-1.5 h-4 w-4" />
                  )}
                  Copy feed URL
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-slate-500 hover:text-slate-900"
                  onClick={rotate}
                  disabled={rotating}
                >
                  <RotateCw className={`mr-1.5 h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
                  Reset link
                </Button>
              </div>
              <p className="mt-2 break-all rounded-xl bg-white/50 px-3 py-2 text-[11px] text-slate-500">
                {sub.feed_url}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-rose-600">
              Could not load your subscription link.{" "}
              <button onClick={() => void load()} className="underline">
                Retry
              </button>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
