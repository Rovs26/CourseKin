"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Highlighter,
  Loader2,
  MousePointer2,
  Pencil,
  StickyNote,
  RotateCcw,
  Eraser,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { SummaryPanel } from "@/components/reviewer/summary-panel";
import { KeyPointsPanel } from "@/components/reviewer/key-points-panel";
import { DefinitionsPanel } from "@/components/reviewer/definitions-panel";
import { QAPanel } from "@/components/reviewer/qa-panel";
import { QuizPanel } from "@/components/reviewer/quiz-panel";
import { FlashcardsPanel } from "@/components/reviewer/flashcards-panel";
import { useProject } from "@/hooks/use-project";
import { useReviewer } from "@/hooks/use-reviewer";
import { routes } from "@/lib/routes";
import { EmptyState } from "@/components/states/empty-state";
import type { ReviewerContent } from "@/types/reviewer";

/* ── Types ─────────────────────────────────────────── */

type SectionId =
  | "summary"
  | "key_points"
  | "definitions"
  | "qa"
  | "quiz"
  | "flashcards";

type SectionDef = { id: SectionId; label: string; visible: boolean };

const DEFAULT_SECTION_ORDER: SectionDef[] = [
  { id: "summary", label: "Summary", visible: true },
  { id: "key_points", label: "Key Points", visible: true },
  { id: "definitions", label: "Definitions", visible: true },
  { id: "qa", label: "Q&A", visible: true },
  { id: "quiz", label: "Quiz", visible: true },
  { id: "flashcards", label: "Flashcards", visible: true },
];

type HighlightColor = "yellow" | "green" | "blue" | "pink";
type PenColor = "red" | "blue" | "black" | "green";
type ToolMode = "select" | "highlight" | "note" | "draw" | "eraser";

const HIGHLIGHT_COLORS: {
  color: HighlightColor;
  bg: string;
  hex: string;
  ring: string;
}[] = [
  { color: "yellow", bg: "bg-yellow-200", hex: "#fef08a", ring: "ring-yellow-400" },
  { color: "green", bg: "bg-emerald-200", hex: "#a7f3d0", ring: "ring-emerald-400" },
  { color: "blue", bg: "bg-blue-200", hex: "#bfdbfe", ring: "ring-blue-400" },
  { color: "pink", bg: "bg-pink-200", hex: "#fbcfe8", ring: "ring-pink-400" },
];

const PEN_COLORS: { color: PenColor; hex: string; bg: string; ring: string }[] = [
  { color: "red", hex: "#ef4444", bg: "bg-red-500", ring: "ring-red-400" },
  { color: "blue", hex: "#3b82f6", bg: "bg-blue-500", ring: "ring-blue-400" },
  { color: "black", hex: "#1e293b", bg: "bg-slate-800", ring: "ring-slate-400" },
  { color: "green", hex: "#22c55e", bg: "bg-green-500", ring: "ring-green-400" },
];

/* ── Drawing types ───────────────────────────────────── */

type DrawnPath = {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
};

/* ── Helpers ───────────────────────────────────────── */

function hasContent(content: ReviewerContent, sectionId: SectionId): boolean {
  switch (sectionId) {
    case "summary":
      return Boolean(content.summary);
    case "key_points":
      return Boolean(content.key_points?.length);
    case "definitions":
      return Boolean(content.definitions?.length);
    case "qa":
      return Boolean(content.qa?.length);
    case "quiz":
      return Boolean(content.quiz?.length);
    case "flashcards":
      return Boolean(content.flashcards?.length);
    default:
      return false;
  }
}

/**
 * Wraps every text node in a Range with a <mark>.
 * Works even when the selection crosses element boundaries.
 */
function highlightRange(range: Range, hex: string) {
  const ancestor = range.commonAncestorContainer;

  // Case 1: Selection is entirely within a single text node
  if (ancestor.nodeType === Node.TEXT_NODE) {
    const text = ancestor as Text;
    const nodeRange = document.createRange();
    nodeRange.setStart(text, range.startOffset);
    nodeRange.setEnd(text, range.endOffset);

    if (nodeRange.toString() === "") return;

    const mark = document.createElement("mark");
    mark.setAttribute("data-rf-highlight", "true");
    mark.style.backgroundColor = hex;
    mark.style.borderRadius = "2px";
    mark.style.padding = "0 1px";

    try {
      nodeRange.surroundContents(mark);
    } catch {
      const frag = nodeRange.extractContents();
      mark.appendChild(frag);
      nodeRange.insertNode(mark);
    }
    return;
  }

  // Case 2: Selection spans multiple nodes — walk text nodes
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode() as Text | null;
  while (node) {
    if (range.intersectsNode(node)) {
      textNodes.push(node);
    }
    node = walker.nextNode() as Text | null;
  }

  if (textNodes.length === 0) return;

  for (const textNode of textNodes) {
    const nodeRange = document.createRange();

    if (textNode === range.startContainer) {
      nodeRange.setStart(textNode, range.startOffset);
    } else {
      nodeRange.setStart(textNode, 0);
    }

    if (textNode === range.endContainer) {
      nodeRange.setEnd(textNode, range.endOffset);
    } else {
      nodeRange.setEnd(textNode, textNode.length);
    }

    if (nodeRange.toString() === "") continue;

    const mark = document.createElement("mark");
    mark.setAttribute("data-rf-highlight", "true");
    mark.style.backgroundColor = hex;
    mark.style.borderRadius = "2px";
    mark.style.padding = "0 1px";

    try {
      nodeRange.surroundContents(mark);
    } catch {
      const frag = nodeRange.extractContents();
      mark.appendChild(frag);
      nodeRange.insertNode(mark);
    }
  }
}

/** Remove a single <mark data-rf-highlight> by unwrapping it */
function unwrapMark(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
  parent.normalize();
}

/** Convert points array to an SVG path "d" string using quadratic smoothing */
function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/* ── Section Content Renderer ──────────────────────── */

function SectionContent({
  sectionId,
  content,
}: {
  sectionId: SectionId;
  content: ReviewerContent;
}) {
  switch (sectionId) {
    case "summary":
      return <SummaryPanel summary={content.summary} />;
    case "key_points":
      return <KeyPointsPanel keyPoints={content.key_points} />;
    case "definitions":
      return <DefinitionsPanel definitions={content.definitions} />;
    case "qa":
      return <QAPanel items={content.qa} />;
    case "quiz":
      return <QuizPanel quiz={content.quiz} />;
    case "flashcards":
      return <FlashcardsPanel cards={content.flashcards} />;
    default:
      return null;
  }
}

/* ── Sortable Section ──────────────────────────────── */

function SortableSection({
  section,
  content,
  onToggleVisibility,
}: {
  section: SectionDef;
  content: ReviewerContent;
  onToggleVisibility: (id: SectionId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (!hasContent(content, section.id)) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-8"
      data-section-id={section.id}
      data-section-visible={section.visible ? "true" : "false"}
    >
      <div className="flex items-center gap-2 mb-3">
        <button
          className="cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          data-export-ui
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h2 className="flex-1 text-base font-bold text-slate-800 tracking-tight">
          {section.label}
        </h2>
        <button
          onClick={() => onToggleVisibility(section.id)}
          className="rounded p-1 text-slate-300 hover:bg-slate-50 hover:text-slate-500"
          title={section.visible ? "Hide from export" : "Show in export"}
          data-export-ui
        >
          {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Always render content to preserve DOM-based highlights & annotations.
          Use CSS hidden instead of conditional render so marks aren't destroyed. */}
      <div className={section.visible ? "" : "hidden"}>
        <SectionContent sectionId={section.id} content={content} />
      </div>

      {!section.visible && (
        <div
          className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400"
          data-export-ui
        >
          Hidden from export
        </div>
      )}

      <div className="mt-8 border-b border-slate-100" />
    </div>
  );
}

/* ── Inline Text Note ──────────────────────────────── */

type TextNote = { id: string; x: number; y: number; text: string };

function InlineNote({
  note,
  onUpdate,
  onMove,
  onDelete,
  isEraserActive,
}: {
  note: TextNote;
  onUpdate: (id: string, text: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  isEraserActive: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (textareaRef.current && !note.text) {
      textareaRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: note.x,
        originY: note.y,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        onMove(note.id, dragRef.current.originX + dx, dragRef.current.originY + dy);
      };

      const handleUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [note.id, note.x, note.y, onMove]
  );

  return (
    <div
      className={`absolute z-30 group ${isEraserActive ? "cursor-pointer ring-2 ring-red-300 rounded" : ""}`}
      style={{ left: note.x, top: note.y }}
      onClick={(e) => {
        if (isEraserActive) {
          e.stopPropagation();
          onDelete(note.id);
        }
      }}
    >
      {!isEraserActive && (
        <div
          className="flex h-4 cursor-grab items-center justify-center rounded-t-md border border-b-0 border-amber-300 bg-amber-100/80 active:cursor-grabbing"
          onMouseDown={handleDragStart}
          data-export-ui
        >
          <div className="flex gap-0.5">
            <span className="h-0.5 w-0.5 rounded-full bg-amber-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-amber-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-amber-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-amber-400" />
            <span className="h-0.5 w-0.5 rounded-full bg-amber-400" />
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={note.text}
        onChange={(e) => onUpdate(note.id, e.target.value)}
        placeholder="Type a note..."
        rows={1}
        className={`min-w-[140px] max-w-[300px] resize-none border border-amber-300 bg-amber-50/90 px-2 py-1.5 text-xs text-amber-900 shadow-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300 ${
          isEraserActive ? "rounded-md" : "rounded-b-md"
        }`}
        style={{ fieldSizing: "content" } as React.CSSProperties}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        readOnly={isEraserActive}
      />
    </div>
  );
}

/* ── Drawing Canvas Overlay ──────────────────────────── */

function DrawingCanvas({
  paths,
  activePath,
  isDrawMode,
  isEraserMode,
  onDeletePath,
}: {
  paths: DrawnPath[];
  activePath: DrawnPath | null;
  isDrawMode: boolean;
  isEraserMode: boolean;
  onDeletePath: (id: string) => void;
}) {
  return (
    <>
      {/* Render layer for committed paths — always visible, never captures events */}
      <svg
        className="absolute inset-0 z-20 h-full w-full"
        style={{ pointerEvents: isDrawMode ? "auto" : "none" }}
      >
        {paths.map((p) => (
          <path
            key={p.id}
            d={pointsToPath(p.points)}
            stroke={p.color}
            strokeWidth={p.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          />
        ))}
      </svg>

      {/* Active stroke layer — only while drawing, separate SVG to avoid key collisions */}
      {activePath && (
        <svg
          className="absolute inset-0 z-[25] h-full w-full"
          style={{ pointerEvents: "none" }}
        >
          <path
            d={pointsToPath(activePath.points)}
            stroke={activePath.color}
            strokeWidth={activePath.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}

      {/* Eraser hit-area layer — pointer-events:none on SVG so clicks
          pass through to highlights below. Individual paths override
          with pointer-events:auto so drawn strokes are still clickable. */}
      {isEraserMode && paths.length > 0 && (
        <svg
          className="absolute inset-0 z-30 h-full w-full"
          style={{ pointerEvents: "none" }}
        >
          {paths.map((p) => (
            <path
              key={p.id}
              d={pointsToPath(p.points)}
              stroke="rgba(239,68,68,0.15)"
              strokeWidth={20}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              className="hover:stroke-red-400/40 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDeletePath(p.id);
              }}
            />
          ))}
        </svg>
      )}
    </>
  );
}

/* ── Floating Dock ─────────────────────────────────── */

function FloatingDock({
  sections,
  content,
  tool,
  highlightColor,
  penColor,
  isDownloading,
  onToggleVisibility,
  onSetTool,
  onSetHighlightColor,
  onSetPenColor,
  onReset,
  onDownload,
}: {
  sections: SectionDef[];
  content: ReviewerContent;
  tool: ToolMode;
  highlightColor: HighlightColor;
  penColor: PenColor;
  isDownloading: boolean;
  onToggleVisibility: (id: SectionId) => void;
  onSetTool: (t: ToolMode) => void;
  onSetHighlightColor: (c: HighlightColor) => void;
  onSetPenColor: (c: PenColor) => void;
  onReset: () => void;
  onDownload: () => void;
}) {
  const visibleCount = sections.filter(
    (s) => s.visible && hasContent(content, s.id)
  ).length;

  const toolBtn = (t: ToolMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => onSetTool(t)}
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
        tool === t
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100"
      }`}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-2xl border bg-white/95 px-3 py-2 shadow-xl backdrop-blur-sm">
        {/* Tool modes */}
        {toolBtn("select", <MousePointer2 className="h-3.5 w-3.5" />, "Select")}
        {toolBtn("highlight", <Highlighter className="h-3.5 w-3.5" />, "Highlight")}
        {toolBtn("draw", <Pencil className="h-3.5 w-3.5" />, "Draw")}
        {toolBtn("note", <StickyNote className="h-3.5 w-3.5" />, "Note")}
        {toolBtn("eraser", <Eraser className="h-3.5 w-3.5" />, "Eraser")}

        {/* Color picker — highlight tool */}
        {tool === "highlight" && (
          <>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1">
              {HIGHLIGHT_COLORS.map((h) => (
                <button
                  key={h.color}
                  onClick={() => onSetHighlightColor(h.color)}
                  className={`h-5 w-5 rounded-full transition hover:scale-125 ${h.bg} ${
                    highlightColor === h.color
                      ? `ring-2 ${h.ring} ring-offset-1`
                      : ""
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Color picker — draw tool */}
        {tool === "draw" && (
          <>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-1">
              {PEN_COLORS.map((p) => (
                <button
                  key={p.color}
                  onClick={() => onSetPenColor(p.color)}
                  className={`h-5 w-5 rounded-full transition hover:scale-125 ${p.bg} ${
                    penColor === p.color
                      ? `ring-2 ${p.ring} ring-offset-1`
                      : ""
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <div className="h-6 w-px bg-slate-200" />

        {/* Section toggles */}
        <div className="flex items-center gap-0.5">
          {sections.map((section) => {
            if (!hasContent(content, section.id)) return null;
            return (
              <button
                key={section.id}
                onClick={() => onToggleVisibility(section.id)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition ${
                  section.visible
                    ? "bg-slate-200 text-slate-700"
                    : "bg-slate-100 text-slate-400 line-through"
                }`}
                title={`${section.visible ? "Hide" : "Show"} ${section.label}`}
              >
                {section.label}
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <button
          onClick={onReset}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Reset all"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {isDownloading ? "..." : `PDF (${visibleCount})`}
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function ExportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, isLoading: isProjectLoading } = useProject(projectId);
  const { reviewer, isLoading: isReviewerLoading } = useReviewer(projectId);

  const [sections, setSections] = useState<SectionDef[]>(DEFAULT_SECTION_ORDER);
  const [tool, setTool] = useState<ToolMode>("select");
  const [highlightColor, setHighlightColor] = useState<HighlightColor>("yellow");
  const [penColor, setPenColor] = useState<PenColor>("red");
  const [isDownloading, setIsDownloading] = useState(false);
  const [notes, setNotes] = useState<TextNote[]>([]);
  const [drawnPaths, setDrawnPaths] = useState<DrawnPath[]>([]);
  const [activePath, setActivePath] = useState<DrawnPath | null>(null);

  const paperRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const activePathRef = useRef<DrawnPath | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const isLoading = isProjectLoading || isReviewerLoading;
  const hasReviewerContent = reviewer?.content_json && reviewer.status !== "not-ready";

  /* ── Highlight: apply on mouseup ── */
  useEffect(() => {
    if (tool !== "highlight") return;

    const handleMouseUp = () => {
      // Small delay to ensure browser has finalized the selection
      requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const range = selection.getRangeAt(0);

        // Check that selection is inside the paper — walk up from the range
        // start container since commonAncestorContainer can be high in the DOM
        const paper = paperRef.current;
        if (!paper) return;

        const startNode = range.startContainer;
        const endNode = range.endContainer;
        if (!paper.contains(startNode) && !paper.contains(endNode)) return;

        const colorHex =
          HIGHLIGHT_COLORS.find((c) => c.color === highlightColor)?.hex ?? "#fef08a";
        highlightRange(range, colorHex);

        selection.removeAllRanges();
      });
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, [tool, highlightColor]);

  /* ── Eraser: click on highlight marks to remove ── */
  useEffect(() => {
    if (tool !== "eraser") return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "MARK" && target.hasAttribute("data-rf-highlight")) {
        e.preventDefault();
        e.stopPropagation();
        unwrapMark(target);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [tool]);

  /* ── Draw: freehand SVG paths ── */
  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const paper = paperRef.current;
    if (!paper) return { x: 0, y: 0 };
    const rect = paper.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top + paper.scrollTop,
    };
  }, []);

  const handleDrawStart = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== "draw") return;
      e.preventDefault();
      isDrawingRef.current = true;
      const pos = getRelativePos(e);
      const colorHex = PEN_COLORS.find((p) => p.color === penColor)?.hex ?? "#ef4444";
      const newPath: DrawnPath = {
        id: crypto.randomUUID(),
        points: [pos],
        color: colorHex,
        width: 2,
      };
      activePathRef.current = newPath;
      setActivePath(newPath);
    },
    [tool, penColor, getRelativePos]
  );

  const handleDrawMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current || tool !== "draw" || !activePathRef.current) return;
      const pos = getRelativePos(e);
      const updated = {
        ...activePathRef.current,
        points: [...activePathRef.current.points, pos],
      };
      activePathRef.current = updated;
      setActivePath(updated);
    },
    [tool, getRelativePos]
  );

  const handleDrawEnd = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    // Read and clear activePath, then add to drawnPaths as separate calls
    // (nesting setDrawnPaths inside setActivePath causes double-add in Strict Mode)
    const completed = activePathRef.current;
    activePathRef.current = null;
    setActivePath(null);
    if (completed && completed.points.length > 1) {
      setDrawnPaths((paths) => [...paths, completed]);
    }
  }, []);

  const deleteDrawnPath = useCallback((id: string) => {
    setDrawnPaths((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /* ── Note: click on paper to place ── */
  const handlePaperClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (tool !== "note") return;

      const paper = paperRef.current;
      if (!paper) return;

      const rect = paper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top + paper.scrollTop;

      setNotes((prev) => [
        ...prev,
        { id: crypto.randomUUID(), x, y, text: "" },
      ]);
    },
    [tool]
  );

  const updateNote = useCallback((id: string, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  }, []);

  const moveNote = useCallback((id: string, x: number, y: number) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const toggleVisibility = useCallback((id: SectionId) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  }, []);

  const resetAll = useCallback(() => {
    setSections(DEFAULT_SECTION_ORDER);
    setNotes([]);
    setDrawnPaths([]);
    setActivePath(null);
    setTool("select");
    if (paperRef.current) {
      const marks = paperRef.current.querySelectorAll("mark[data-rf-highlight]");
      marks.forEach((mark) => unwrapMark(mark as HTMLElement));
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (isDownloading || !paperRef.current) return;
    setIsDownloading(true);

    const paper = paperRef.current;
    const restoreFns: (() => void)[] = [];

    try {
      // ── 1. Force light mode so PDF always has white background ──
      const htmlEl = document.documentElement;
      const wasDark = htmlEl.classList.contains("dark");
      const prevTheme = htmlEl.dataset.theme;
      if (wasDark) {
        htmlEl.classList.remove("dark");
        htmlEl.dataset.theme = "light";
        restoreFns.push(() => {
          htmlEl.classList.add("dark");
          htmlEl.dataset.theme = prevTheme ?? "dark";
        });
      }

      // ── 2. Hide UI controls (grip handles, eye buttons, placeholders) ──
      const uiElements = paper.querySelectorAll<HTMLElement>("[data-export-ui]");
      uiElements.forEach((el) => (el.style.display = "none"));
      restoreFns.push(() => uiElements.forEach((el) => (el.style.display = "")));

      // ── 3. Completely hide sections toggled off ──
      const hiddenSections = paper.querySelectorAll<HTMLElement>('[data-section-visible="false"]');
      hiddenSections.forEach((el) => (el.style.display = "none"));
      restoreFns.push(() => hiddenSections.forEach((el) => (el.style.display = "")));

      // ── 4. Flatten 3D flashcards — html2canvas can't handle 3D transforms ──
      const flashcardContainers = paper.querySelectorAll<HTMLElement>("[class*='perspective']");

      flashcardContainers.forEach((container) => {
        const inner = container.firstElementChild as HTMLElement | null;
        if (!inner) return;

        const savedTransform = inner.style.transform;
        inner.style.transform = "none";
        inner.style.transformStyle = "flat";

        const faces = inner.children;
        for (let i = 0; i < faces.length; i++) {
          const face = faces[i] as HTMLElement;
          if (i === 0) {
            face.style.position = "relative";
            face.style.backfaceVisibility = "visible";
          } else {
            face.style.display = "none";
          }
        }

        restoreFns.push(() => {
          inner.style.transform = savedTransform;
          inner.style.transformStyle = "";
          for (let i = 0; i < faces.length; i++) {
            const face = faces[i] as HTMLElement;
            if (i === 0) {
              face.style.position = "";
              face.style.backfaceVisibility = "";
            } else {
              face.style.display = "";
            }
          }
        });
      });

      // Capture the paper div as a canvas — includes highlights, drawings, and notes
      const canvas = await html2canvas(paper, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        foreignObjectRendering: false,
      });

      // Restore DOM immediately after capture
      restoreFns.forEach((fn) => fn());

      // A4 dimensions in mm
      const pageW = 210;
      const pageH = 297;

      // Scale: map canvas pixel width to A4 width
      const scale = pageW / canvas.width;
      const fullHeightMm = canvas.height * scale;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      if (fullHeightMm <= pageH) {
        // Fits on one page
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          pageW,
          fullHeightMm,
        );
      } else {
        // Split into pages by slicing the source canvas
        const sliceHeightPx = pageH / scale; // pixels per page
        let yOffset = 0;
        let pageIndex = 0;

        while (yOffset < canvas.height) {
          const remaining = canvas.height - yOffset;
          const h = Math.min(sliceHeightPx, remaining);

          // Create a slice canvas for this page
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = h;
          const ctx = pageCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -yOffset);

          if (pageIndex > 0) pdf.addPage();
          const sliceHMm = h * scale;
          pdf.addImage(
            pageCanvas.toDataURL("image/png"),
            "PNG",
            0,
            0,
            pageW,
            sliceHMm,
          );

          yOffset += h;
          pageIndex++;
        }
      }

      const displayTitle = project?.title ?? "Reviewer";
      const safeTitle = displayTitle
        .toLowerCase()
        .replace(/\s+/g, "-")
        .slice(0, 50);
      const filename = `${safeTitle}-reviewer-v${reviewer?.version ?? 1}.pdf`;

      // Set PDF metadata so it shows the title in browser tabs
      pdf.setProperties({
        title: `${displayTitle} — Reviewer`,
        creator: "CourseKin",
      });

      pdf.save(filename);
    } catch (err) {
      console.error("PDF export failed:", err);
      // Restore DOM on error
      restoreFns.forEach((fn) => fn());
    } finally {
      setIsDownloading(false);
    }
  }, [isDownloading, project, reviewer]);

  /* ── Cursor based on tool ── */
  const cursorClass: Record<ToolMode, string> = {
    select: "",
    highlight: "cursor-text",
    note: "cursor-crosshair",
    draw: "cursor-crosshair",
    eraser: "cursor-pointer",
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Loading export...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project does not exist."
      />
    );
  }

  if (!hasReviewerContent || !reviewer?.content_json) {
    return (
      <div className="space-y-4">
        <Link
          href={routes.projectReviewer(projectId)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reviewer
        </Link>
        <EmptyState
          title="No reviewer content"
          description="Generate a reviewer first before exporting."
        />
      </div>
    );
  }

  const content = reviewer.content_json;

  return (
    <div className="pb-24">
      {/* Minimal top bar */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={routes.projectReviewer(projectId)}
          className="inline-flex items-center justify-center rounded-xl border p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Export Preview
          </h1>
          <p className="text-xs text-slate-400">
            Highlight text, draw annotations, add notes, reorder sections, then download
          </p>
        </div>
      </div>

      {/* Paper canvas */}
      <div className="flex justify-center">
        <div
          className={`relative w-full max-w-[816px] ${cursorClass[tool]}`}
          ref={paperRef}
          onClick={handlePaperClick}
          {...(tool === "draw" ? {
            onMouseDown: handleDrawStart,
            onMouseMove: handleDrawMove,
            onMouseUp: handleDrawEnd,
            onMouseLeave: handleDrawEnd,
          } : {})}
        >
          <div className="rounded-sm bg-white shadow-[0_4px_40px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.03)]">
            {/* Cover */}
            <div className="border-b border-slate-100 px-14 pb-10 pt-16">
              <div className="mb-6 h-1 w-12 rounded-full bg-slate-900" />
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {project.title}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {project.field_of_study}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  Version {reviewer.version}
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Generated by CourseKin
              </p>
            </div>

            {/* Content */}
            <div className="px-14 py-12">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      content={content}
                      onToggleVisibility={toggleVisibility}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-14 py-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-300">{project.title}</p>
                <p className="text-[10px] text-slate-300">
                  CourseKin v{reviewer.version}
                </p>
              </div>
            </div>
          </div>

          {/* Drawing canvas overlay */}
          <DrawingCanvas
            paths={drawnPaths}
            activePath={activePath}
            isDrawMode={tool === "draw"}
            isEraserMode={tool === "eraser"}
            onDeletePath={deleteDrawnPath}
          />

          {/* Inline text notes layer */}
          {notes.map((note) => (
            <InlineNote
              key={note.id}
              note={note}
              onUpdate={updateNote}
              onMove={moveNote}
              onDelete={deleteNote}
              isEraserActive={tool === "eraser"}
            />
          ))}
        </div>
      </div>

      {/* Floating dock */}
      <FloatingDock
        sections={sections}
        content={content}
        tool={tool}
        highlightColor={highlightColor}
        penColor={penColor}
        isDownloading={isDownloading}
        onToggleVisibility={toggleVisibility}
        onSetTool={setTool}
        onSetHighlightColor={setHighlightColor}
        onSetPenColor={setPenColor}
        onReset={resetAll}
        onDownload={handleDownload}
      />
    </div>
  );
}
