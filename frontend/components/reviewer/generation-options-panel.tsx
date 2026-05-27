"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TurnstileWidget } from "@/components/reviewer/turnstile-widget";
import type {
  ReviewerSectionId,
  SectionCounts,
  MergeMode,
  SourceGenerationConfig,
} from "@/lib/coursekin-api";
import type { Source } from "@/types/source";

type SectionConfig = {
  id: ReviewerSectionId;
  label: string;
  countable: boolean;
  options: number[];
  defaultCount: number;
};

const SECTION_CONFIGS: SectionConfig[] = [
  { id: "summary", label: "Summary", countable: false, options: [], defaultCount: 0 },
  { id: "key_points", label: "Key Points", countable: true, options: [5, 10, 15, 20], defaultCount: 15 },
  { id: "definitions", label: "Definitions", countable: true, options: [5, 10, 15, 20], defaultCount: 10 },
  { id: "qa", label: "Q&A", countable: true, options: [5, 10, 15, 20], defaultCount: 10 },
  { id: "quiz", label: "Quiz", countable: true, options: [5, 10, 15, 20], defaultCount: 8 },
  { id: "flashcards", label: "Flashcards", countable: true, options: [10, 15, 20, 25, 30], defaultCount: 15 },
];

const MERGE_LABELS: Record<MergeMode, { label: string; description: string }> = {
  append: { label: "Merge (append)", description: "Add items to existing sections" },
  replace: { label: "Replace", description: "Overwrite existing section content" },
  skip: { label: "Skip existing", description: "Only fill empty sections" },
};

/** Map of section_id -> source title(s), from _meta.sources resolved against sources list */
export type SectionOwnership = Partial<Record<ReviewerSectionId, string>>;

/** Per-source configuration state */
type SourceState = {
  source: Source;
  expanded: boolean;
  sections: Set<ReviewerSectionId>;
  counts: SectionCounts;
  mergeMode: MergeMode;
};

export type GenerationOptions = {
  sections: ReviewerSectionId[];
  counts: SectionCounts;
  merge_mode: MergeMode;
  turnstile_token?: string;
};

export type MultiSourceGenerationResult = {
  configs: SourceGenerationConfig[];
  turnstile_token?: string;
};

export function GenerationOptionsPanel({
  onGenerate,
  onCancel,
  isRegenerating = false,
  defaultSections,
  defaultCounts,
  sourceName,
  sectionOwnership,
}: {
  onGenerate: (options: GenerationOptions) => void;
  onCancel: () => void;
  isRegenerating?: boolean;
  defaultSections?: ReviewerSectionId[];
  defaultCounts?: SectionCounts;
  sourceName?: string;
  sectionOwnership?: SectionOwnership;
}) {
  const [selectedSections, setSelectedSections] = useState<Set<ReviewerSectionId>>(
    new Set(defaultSections ?? SECTION_CONFIGS.map((s) => s.id))
  );

  const [counts, setCounts] = useState<SectionCounts>({
    key_points: 15,
    definitions: 10,
    qa: 10,
    quiz: 8,
    flashcards: 15,
    ...defaultCounts,
  });

  const [mergeMode, setMergeMode] = useState<MergeMode>("append");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const siteKeyConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  // Generate is allowed when: no site key (dev), or token has been acquired
  const turnstileReady = !siteKeyConfigured || Boolean(turnstileToken);

  const toggleSection = (id: ReviewerSectionId) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const updateCount = (id: ReviewerSectionId, value: number) => {
    setCounts((prev) => ({ ...prev, [id]: value }));
  };

  const handleGenerate = () => {
    const sections = SECTION_CONFIGS.filter((s) => selectedSections.has(s.id)).map((s) => s.id);
    if (sections.length === 0) return;

    const filteredCounts: SectionCounts = {};
    for (const section of sections) {
      if (section !== "summary" && counts[section as keyof SectionCounts]) {
        (filteredCounts as Record<string, number>)[section] = counts[section as keyof SectionCounts]!;
      }
    }

    onGenerate({
      sections,
      counts: filteredCounts,
      merge_mode: mergeMode,
      turnstile_token: turnstileToken ?? undefined,
    });
  };

  const allSelected = selectedSections.size === SECTION_CONFIGS.length;
  const hasAnyOwnership = sectionOwnership && Object.keys(sectionOwnership).length > 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">
              {isRegenerating ? "Update notebook" : "Build notebook"}
            </CardTitle>
            {sourceName && (
              <p className="mt-1 text-sm font-medium text-slate-600">
                Material: {sourceName}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              if (allSelected) {
                setSelectedSections(new Set());
              } else {
                setSelectedSections(new Set(SECTION_CONFIGS.map((s) => s.id)));
              }
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
        <p className="text-sm text-slate-500">
          Choose which study sections to build and how much practice to include.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {SECTION_CONFIGS.map((config) => {
          const isSelected = selectedSections.has(config.id);
          const owner = sectionOwnership?.[config.id];

          return (
            <div
              key={config.id}
              className={`flex items-center justify-between rounded-xl border p-3 transition ${
                isSelected
                  ? "border-slate-300 bg-slate-50"
                  : "border-slate-200 bg-slate-50/50 opacity-60"
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSection(config.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                />
                <span className="text-sm font-medium text-slate-900">
                  {config.label}
                </span>
                {owner && (
                  <span className="truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    from {owner}
                  </span>
                )}
              </label>

              {config.countable && isSelected && (
                <div className="flex items-center gap-1 shrink-0">
                  {config.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => updateCount(config.id, opt)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        counts[config.id as keyof SectionCounts] === opt
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Merge mode selector */}
        {hasAnyOwnership && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              When sections already exist
            </p>
            <div className="flex gap-2">
              {(["append", "replace", "skip"] as MergeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMergeMode(mode)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    mergeMode === mode
                      ? mode === "replace"
                        ? "bg-amber-500 text-white"
                        : "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {MERGE_LABELS[mode].label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {MERGE_LABELS[mergeMode].description}
            </p>
          </div>
        )}

        <TurnstileWidget
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
        />

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={selectedSections.size === 0 || !turnstileReady}
            className="flex-1 rounded-xl"
          >
            {isRegenerating ? "Update Notebook" : "Build Notebook"} ({selectedSections.size}{" "}
            {selectedSections.size === 1 ? "section" : "sections"})
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


/* ────────────────────────────────────────────────────────────────
   Multi-Source Generation Panel
   - Shows all project sources with checkboxes
   - Each selected source expands to show section/count/merge config
   - "Generate All" triggers batch generation
   ──────────────────────────────────────────────────────────────── */

export function MultiSourcePanel({
  sources,
  onBatchGenerate,
  onCancel,
  defaultSections,
  defaultCounts,
  sectionOwnership,
}: {
  sources: Source[];
  onBatchGenerate: (configs: SourceGenerationConfig[], turnstileToken?: string) => void;
  onCancel: () => void;
  defaultSections?: ReviewerSectionId[];
  defaultCounts?: SectionCounts;
  sectionOwnership?: SectionOwnership;
}) {
  const processedSources = sources.filter((s) => s.status === "processed");

  const [sourceStates, setSourceStates] = useState<Map<string, SourceState>>(() => {
    const map = new Map<string, SourceState>();
    for (const source of processedSources) {
      map.set(source.id, {
        source,
        expanded: false,
        sections: new Set(defaultSections ?? SECTION_CONFIGS.map((s) => s.id)),
        counts: {
          key_points: 15,
          definitions: 10,
          qa: 10,
          quiz: 8,
          flashcards: 15,
          ...defaultCounts,
        },
        mergeMode: "append",
      });
    }
    return map;
  });

  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const siteKeyConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const turnstileReady = !siteKeyConfigured || Boolean(turnstileToken);

  const toggleSourceSelected = (sourceId: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const toggleSourceExpanded = (sourceId: string) => {
    setSourceStates((prev) => {
      const next = new Map(prev);
      const state = next.get(sourceId);
      if (state) {
        next.set(sourceId, { ...state, expanded: !state.expanded });
      }
      return next;
    });
  };

  const toggleSection = (sourceId: string, sectionId: ReviewerSectionId) => {
    setSourceStates((prev) => {
      const next = new Map(prev);
      const state = next.get(sourceId);
      if (state) {
        const sections = new Set(state.sections);
        if (sections.has(sectionId)) {
          sections.delete(sectionId);
        } else {
          sections.add(sectionId);
        }
        next.set(sourceId, { ...state, sections });
      }
      return next;
    });
  };

  const updateCount = (sourceId: string, sectionId: ReviewerSectionId, value: number) => {
    setSourceStates((prev) => {
      const next = new Map(prev);
      const state = next.get(sourceId);
      if (state) {
        next.set(sourceId, {
          ...state,
          counts: { ...state.counts, [sectionId]: value },
        });
      }
      return next;
    });
  };

  const updateMergeMode = (sourceId: string, mode: MergeMode) => {
    setSourceStates((prev) => {
      const next = new Map(prev);
      const state = next.get(sourceId);
      if (state) {
        next.set(sourceId, { ...state, mergeMode: mode });
      }
      return next;
    });
  };

  const handleGenerate = () => {
    const configs: SourceGenerationConfig[] = [];

    for (const sourceId of selectedSourceIds) {
      const state = sourceStates.get(sourceId);
      if (!state) continue;

      const sections = SECTION_CONFIGS.filter((s) => state.sections.has(s.id)).map((s) => s.id);
      if (sections.length === 0) continue;

      const filteredCounts: SectionCounts = {};
      for (const section of sections) {
        if (section !== "summary" && state.counts[section as keyof SectionCounts]) {
          (filteredCounts as Record<string, number>)[section] = state.counts[section as keyof SectionCounts]!;
        }
      }

      configs.push({
        source_id: sourceId,
        sections,
        counts: filteredCounts,
        merge_mode: state.mergeMode,
      });
    }

    if (configs.length > 0) {
      onBatchGenerate(configs, turnstileToken ?? undefined);
    }
  };

  // Compute totals for the generate button
  const totalsBySection: Record<string, number> = {};
  for (const sourceId of selectedSourceIds) {
    const state = sourceStates.get(sourceId);
    if (!state) continue;
    for (const section of state.sections) {
      const config = SECTION_CONFIGS.find((s) => s.id === section);
      if (config?.countable) {
        const count = state.counts[section as keyof SectionCounts] ?? config.defaultCount;
        totalsBySection[section] = (totalsBySection[section] ?? 0) + count;
      }
    }
  }

  const hasAnyOwnership = sectionOwnership && Object.keys(sectionOwnership).length > 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">
              Build from multiple materials
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Choose course materials and the study sections each one should support.
            </p>
          </div>
          <button
            onClick={() => {
              if (selectedSourceIds.size === processedSources.length) {
                setSelectedSourceIds(new Set());
              } else {
                setSelectedSourceIds(new Set(processedSources.map((s) => s.id)));
              }
            }}
            className="text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            {selectedSourceIds.size === processedSources.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {processedSources.map((source) => {
          const isSelected = selectedSourceIds.has(source.id);
          const state = sourceStates.get(source.id)!;
          const isExpanded = state.expanded && isSelected;

          return (
            <div
              key={source.id}
              className={`rounded-xl border transition ${
                isSelected ? "border-slate-300 bg-slate-50/50" : "border-slate-200"
              }`}
            >
              {/* Source header */}
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSourceSelected(source.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                />
                <button
                  onClick={() => {
                    if (!isSelected) {
                      toggleSourceSelected(source.id);
                    }
                    toggleSourceExpanded(source.id);
                  }}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {source.title}
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400">
                    {source.type}
                  </span>
                </button>
              </div>

              {/* Expanded config */}
              {isExpanded && (
                <div className="border-t border-slate-200 px-3 pb-3 pt-2 space-y-2">
                  {/* Sections */}
                  {SECTION_CONFIGS.map((config) => {
                    const sectionSelected = state.sections.has(config.id);
                    return (
                      <div
                        key={config.id}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 transition ${
                          sectionSelected ? "bg-white" : "bg-slate-50/80 opacity-50"
                        }`}
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sectionSelected}
                            onChange={() => toggleSection(source.id, config.id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            {config.label}
                          </span>
                        </label>

                        {config.countable && sectionSelected && (
                          <div className="flex items-center gap-0.5">
                            {config.options.map((opt) => (
                              <button
                                key={opt}
                                onClick={() => updateCount(source.id, config.id, opt)}
                                className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
                                  state.counts[config.id as keyof SectionCounts] === opt
                                    ? "bg-slate-900 text-white"
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Merge mode */}
                  {hasAnyOwnership && (
                    <div className="flex gap-1.5 pt-1">
                      {(["append", "replace", "skip"] as MergeMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => updateMergeMode(source.id, mode)}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition ${
                            state.mergeMode === mode
                              ? mode === "replace"
                                ? "bg-amber-500 text-white"
                                : "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {MERGE_LABELS[mode].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Totals preview */}
        {Object.keys(totalsBySection).length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Combined totals
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(totalsBySection).map(([section, count]) => {
                const config = SECTION_CONFIGS.find((s) => s.id === section);
                return (
                  <span
                    key={section}
                    className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 shadow-sm"
                  >
                    {config?.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <TurnstileWidget
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
        />

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleGenerate}
            disabled={selectedSourceIds.size === 0 || !turnstileReady}
            className="flex-1 rounded-xl"
          >
            Build from {selectedSourceIds.size}{" "}
            {selectedSourceIds.size === 1 ? "material" : "materials"}
          </Button>
          <Button variant="outline" onClick={onCancel} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
