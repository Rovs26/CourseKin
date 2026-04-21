"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Flashcard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setFlipped((prev) => !prev)}
      className="group h-56 w-full [perspective:1000px]"
    >
      <div
        className={cn(
          "relative h-full w-full rounded-3xl transition-transform duration-500 [transform-style:preserve-3d]",
          flipped && "[transform:rotateY(180deg)]"
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center rounded-3xl border bg-white p-6 text-center shadow-sm [backface-visibility:hidden]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Front
            </p>
            <p className="mt-4 text-lg font-semibold leading-7 text-slate-900">
              {front}
            </p>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center rounded-3xl border bg-slate-900 p-6 text-center text-white shadow-sm [transform:rotateY(180deg)] [backface-visibility:hidden]">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Back
            </p>
            <p className="mt-4 text-lg font-semibold leading-7">{back}</p>
          </div>
        </div>
      </div>
    </button>
  );
}