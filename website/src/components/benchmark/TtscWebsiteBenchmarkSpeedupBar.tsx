"use client";

import type { ITtscWebsiteBenchmark } from "../../structures/ITtscWebsiteBenchmark";
import TtscWebsiteBenchmarkFormat from "./TtscWebsiteBenchmarkFormat";

/**
 * One head-to-head comparison: a slow baseline bar over a faster ttsc bar.
 *
 * Bar widths are proportional to wall-clock time within the row, so the shorter
 * ttsc bar reads as "less time" at a glance; the multiplier on the right states
 * the win numerically.
 */
export default function TtscWebsiteBenchmarkSpeedupBar({
  speedup,
}: {
  speedup: ITtscWebsiteBenchmark.Speedup;
}) {
  const fastPct = Math.min(
    100,
    Math.max(6, (speedup.fast.ms / speedup.baseline.ms) * 100),
  );
  const faster = speedup.factor >= 1;

  return (
    <div className="not-prose">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-[#102a43]">{speedup.label}</p>
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
        <span className="font-bold text-[#3178c6]">
          {TtscWebsiteBenchmarkFormat.formatMultiplier(speedup.factor)}
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
          isFast ? "font-bold text-[#235a97]" : "text-neutral-500"
        }`}
        title={tool}
      >
        {tool}
      </code>
      <div className="relative h-6 flex-1 overflow-hidden rounded bg-[#e7f0f8]">
        <div
          className={`flex h-full items-center justify-end rounded px-2 transition-[width] duration-700 ${
            isFast
              ? "bg-gradient-to-r from-[#235a97] to-[#4d9adb]"
              : "bg-[#8aa6bd]"
          }`}
          style={{ width: `${widthPct}%` }}
        >
          <span className="font-mono text-[11px] font-semibold tabular-nums text-white">
            {TtscWebsiteBenchmarkFormat.formatDuration(ms)}
          </span>
        </div>
      </div>
    </div>
  );
}
