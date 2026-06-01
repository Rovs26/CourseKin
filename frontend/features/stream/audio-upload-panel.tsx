"use client";

import { useEffect, useState } from "react";
import { Mic, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  acceptAudioConsent,
  createAudioUploadUrl,
  getAudioConsentStatus,
  startAudioTranscription,
  type AudioConsentStatus,
} from "@/lib/coursekin-api";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
]);

const MAX_BYTES = 100 * 1024 * 1024;

export function AudioUploadPanel({
  projectId,
  onSubmitted,
}: {
  projectId: string;
  onSubmitted: () => void;
}) {
  const [consent, setConsent] = useState<AudioConsentStatus | null>(null);
  const [available, setAvailable] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const status = await getAudioConsentStatus(projectId);
        if (active) setConsent(status);
      } catch (err) {
        // 404 means the feature flag is off — hide the panel.
        if (active) setAvailable(false);
        console.debug("Audio E1 not enabled", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!available) return null;
  if (!consent) {
    return (
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Lecture audio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500">Checking consent status...</p>
        </CardContent>
      </Card>
    );
  }

  const acceptConsent = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await acceptAudioConsent(projectId, {
        consent_version: consent.consent_required_version,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      setConsent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record consent.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setInfo(null);
    if (file.size > MAX_BYTES) {
      setError("Audio file must be 100 MB or smaller.");
      return;
    }
    const mime = (file.type || "").toLowerCase();
    if (mime && !ALLOWED_MIME.has(mime)) {
      setError("Unsupported audio format. Use mp3, m4a, wav, webm, or ogg.");
      return;
    }
    setBusy(true);
    try {
      const presign = await createAudioUploadUrl(projectId, {
        filename: file.name,
        content_type: mime || "audio/mpeg",
        size_bytes: file.size,
      });
      const putRes = await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": mime || "audio/mpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Direct upload to storage failed.");
      await startAudioTranscription(projectId, {
        storage_key: presign.key,
        original_filename: file.name,
      });
      setInfo(
        "Audio queued for transcription. Refresh in a moment to see the summary in your timeline.",
      );
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start transcription.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2">
        <Mic className="h-4 w-4 text-[var(--ck-primary)]" />
        <CardTitle className="text-lg">Lecture audio</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {consent.needs_consent ? (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Before you upload</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  <li>
                    Only record sessions where the speaker has given consent, or
                    where local law permits recording educational lectures.
                  </li>
                  <li>
                    Audio is processed by OpenAI Whisper. The audio file itself
                    is deleted after transcription. The transcript stays in your
                    account.
                  </li>
                  <li>
                    Don&apos;t upload audio containing other students&apos;
                    personal information, graded feedback for someone else, or
                    anything you wouldn&apos;t paste into a study group chat.
                  </li>
                </ul>
              </div>
            </div>
            <Button size="sm" onClick={acceptConsent} disabled={busy}>
              {busy ? "Saving..." : "I understand — enable audio"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Upload a single lecture (up to 60 minutes, 100 MB). You&apos;ll get
              a notes-style summary and proposed flashcards in your timeline.
            </p>
            <label className="block">
              <span className="sr-only">Audio file</span>
              <input
                type="file"
                accept="audio/*"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50"
              />
            </label>
            {busy && (
              <p className="text-xs text-slate-500">
                Uploading and queuing transcription...
              </p>
            )}
          </div>
        )}
        {info && (
          <p className="rounded-xl bg-emerald-50 p-2.5 text-xs text-emerald-800">
            {info}
          </p>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
