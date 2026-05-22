"use client";

import { type Speedup, formatDuration, formatMultiplier } from "./format";

/**
 * One head-to-head comparison: a slow baseline bar over a faster ttsc bar.
 *
 * Bar widths are proportional to wall-clock time within the row, so the shorter
 * ttsc bar reads as "less time" at a glance; the multiplier on the right states
 * the win numerically.
 */
export default function SpeedupBar({ speedup }: { speedup: Speedup }) {
  const fastPct = Math.min(
    100,
    Math.max(6, (speedup.fast.ms / speedup.baseline.ms) * 100),
  );
  const faster = speedup.factor >= 1;

  return (
    <div className="not-prose">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {speedup.label}
        </p>
        <p className="font-mono text-[11px] text-neutral-500">
          {speedup.detail}
        </p>
      </div>

      <div className="mt-2 space-y-1.5">
        <BarRow
          tone="baseline"
          tool={speedup.baseline.tool}
          ms={speedup.baseline.ms}
          widthPct={100}
        />
        <BarRow
          tone="fast"
          tool={speedup.fast.tool}
          ms={speedup.fast.ms}
          widthPct={fastPct}
        />
      </div>

      <p className="mt-2 font-mono text-[11px] text-neutral-500">
        <span className="font-bold text-cyan-600 dark:text-cyan-300">
          {formatMultiplier(speedup.factor)}
        </span>{" "}
        {faster ? "faster" : "of baseline"}
      </p>
    </div>
  );
}

function BarRow({
  tone,
  tool,
  ms,
  widthPct,
}: {
  tone: "baseline" | "fast";
  tool: string;
  ms: number;
  widthPct: number;
}) {
  const isFast = tone === "fast";
  return (
    <div className="flex items-center gap-3">
      <code
        className={`w-24 shrink-0 truncate text-right font-mono text-[11px] ${
          isFast
            ? "font-bold text-cyan-700 dark:text-cyan-300"
            : "text-neutral-500"
        }`}
        title={tool}
      >
        {tool}
      </code>
      <div className="relative h-6 flex-1 overflow-hidden rounded bg-neutral-200/70 dark:bg-neutral-800/70">
        <div
          className={`flex h-full items-center justify-end rounded px-2 transition-[width] duration-700 ${
            isFast
              ? "bg-gradient-to-r from-cyan-500 to-cyan-400 dark:from-cyan-500 dark:to-cyan-300"
              : "bg-neutral-400 dark:bg-neutral-600"
          }`}
          style={{ width: `${widthPct}%` }}
        >
          <span
            className={`font-mono text-[11px] font-semibold tabular-nums ${
              isFast ? "text-cyan-950" : "text-white dark:text-neutral-200"
            }`}
          >
            {formatDuration(ms)}
          </span>
        </div>
      </div>
    </div>
  );
}
