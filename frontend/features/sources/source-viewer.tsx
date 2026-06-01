"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listSourceChunks, type SourceChunkList } from "@/lib/coursekin-api";
import { routes } from "@/lib/routes";

export function SourceViewer({
  projectId,
  sourceId,
}: {
  projectId: string;
  sourceId: string;
}) {
  const searchParams = useSearchParams();
  const highlightChunkId = searchParams.get("highlight");
  const highlightOrdinalParam = searchParams.get("ordinal");

  const [data, setData] = useState<SourceChunkList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSourceChunks(sourceId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load source.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [data, highlightChunkId, highlightOrdinalParam]);

  const highlightOrdinal = highlightOrdinalParam
    ? Number.parseInt(highlightOrdinalParam, 10)
    : null;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={`${routes.projectSources(projectId)}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to materials
          </Link>
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-slate-600">
            <BookOpen className="h-5 w-5 text-[var(--ck-primary)]" />
            <p className="text-xs uppercase tracking-wide">Source</p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {data?.source_title ?? "Source"}
          </h1>
          {highlightChunkId && (
            <p className="mt-2 text-sm text-amber-700">
              Highlighting cited passage from the notebook.
            </p>
          )}
        </CardContent>
      </Card>

      {loading && (
        <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          Loading source...
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      )}

      {data && data.items.length === 0 && !loading && (
        <p className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          This source has not been indexed yet. Citations will become available once
          processing completes.
        </p>
      )}

      <div className="space-y-3">
        {data?.items.map((chunk) => {
          const isHighlight =
            chunk.id === highlightChunkId ||
            (highlightOrdinal !== null && chunk.ordinal === highlightOrdinal);
          return (
            <div
              key={chunk.id}
              ref={isHighlight ? highlightRef : undefined}
              className={`rounded-2xl border p-4 transition ${
                isHighlight
                  ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="mb-2 flex items-center gap-3 text-xs text-slate-500">
                <span>Passage {chunk.ordinal + 1}</span>
                {chunk.page_number != null && (
                  <span>· page {chunk.page_number}</span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {chunk.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
