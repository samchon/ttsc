"use client";

import { useEffect, useState } from "react";

import {
  findMeasurement,
  formatDuration,
  formatMultiplier,
  measurementMs,
} from "./format";
import type { BenchmarkProject, BenchmarkReport } from "./types";

// ---------------------------------------------------------------------------
// Style tokens — mirrors GraphBenchmark.tsx
// ---------------------------------------------------------------------------

const ACCENT = "#36e2ee";

const panelClass =
  "overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e13] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

function Eyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
      <span style={{ color: ACCENT }}>[</span>
      <span className="mx-2 text-neutral-400">{label}</span>
      <span style={{ color: ACCENT }}>]</span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minMs(samples: number[]): number {
  return samples.length > 0 ? Math.min(...samples) : 0;
}

interface HeadlineStat {
  op: string;
  baselineMs: number;
  fastMs: number;
  factor: number;
  threading: string;
}

function buildHeadlines(project: BenchmarkProject): HeadlineStat[] {
  const m = project.measurements;
  const stats: HeadlineStat[] = [];

  const legacyBuild = findMeasurement(m, {
    branch: "legacy",
    tool: "tsc",
    op: "build",
    threading: "multi",
  });
  const legacyNoEmit = findMeasurement(m, {
    branch: "legacy",
    tool: "tsc",
    op: "noEmit",
    threading: "multi",
  });

  // Pick the fastest ttsc threading for each op (checkers8, then checkers4, …)
  const threadingCandidates = [
    "checkers8",
    "checkers4",
    "checkers2",
    "single",
  ] as const;

  for (const threading of threadingCandidates) {
    const fast = findMeasurement(m, {
      branch: "ttsc",
      tool: "ttsc",
      op: "build",
      threading,
    });
    if (legacyBuild && fast) {
      const baselineMs = measurementMs(legacyBuild);
      const fastMs = measurementMs(fast);
      if (baselineMs > 0 && fastMs > 0) {
        stats.push({
          op: "Build",
          baselineMs,
          fastMs,
          factor: baselineMs / fastMs,
          threading: `--checkers ${threading.replace("checkers", "")}`,
        });
        break;
      }
    }
  }

  for (const threading of threadingCandidates) {
    const fast = findMeasurement(m, {
      branch: "ttsc",
      tool: "ttsc",
      op: "noEmit",
      threading,
    });
    if (legacyNoEmit && fast) {
      const baselineMs = measurementMs(legacyNoEmit);
      const fastMs = measurementMs(fast);
      if (baselineMs > 0 && fastMs > 0) {
        stats.push({
          op: "Type-check",
          baselineMs,
          fastMs,
          factor: baselineMs / fastMs,
          threading: `--checkers ${threading.replace("checkers", "")}`,
        });
        break;
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// SpeedupRow — one operation as a pair of duration bars
// ---------------------------------------------------------------------------

function SpeedupRow({ stat }: { stat: HeadlineStat }) {
  const fastPct = Math.min(
    100,
    Math.max(4, (stat.fastMs / stat.baselineMs) * 100),
  );

  return (
    <div className="space-y-2.5 rounded-md border border-[#1c2230] bg-[#0e1117] px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-300">
          {stat.op}
        </p>
        <p
          className="font-mono text-[13px] font-bold"
          style={{ color: ACCENT }}
        >
          {formatMultiplier(stat.factor)} faster
        </p>
      </div>

      <div className="space-y-1.5">
        {/* Baseline bar */}
        <div className="flex items-center gap-3">
          <code className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-500">
            tsc
          </code>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-[#161b24]">
            <div
              className="flex h-full items-center justify-end rounded px-2 bg-neutral-600"
              style={{ width: "100%" }}
            >
              <span className="font-mono text-[10px] text-neutral-200">
                {formatDuration(stat.baselineMs)}
              </span>
            </div>
          </div>
        </div>
        {/* Fast bar */}
        <div className="flex items-center gap-3">
          <code
            className="w-16 shrink-0 text-right font-mono text-[10px] font-bold"
            style={{ color: ACCENT }}
          >
            ttsc
          </code>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-[#161b24]">
            <div
              className="flex h-full items-center justify-end rounded px-2"
              style={{
                width: `${fastPct}%`,
                background: `linear-gradient(90deg, ${ACCENT}, #19b6c9)`,
                boxShadow: `0 0 8px ${ACCENT}44`,
              }}
            >
              <span className="font-mono text-[10px] font-semibold text-cyan-950">
                {formatDuration(stat.fastMs)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="font-mono text-[10px] text-neutral-500">
        ttsc {stat.threading} vs tsc · vscode · 6,093 files
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="not-prose my-6 rounded-lg border border-[#222834] bg-[#0c0e13] px-4 py-3 font-mono text-[12px] text-neutral-400">
      {children}
    </p>
  );
}

export default function PerformanceSummary() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/benchmark/performance.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<BenchmarkReport>;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error)
    return (
      <Notice>Could not load performance benchmark data ({error}).</Notice>
    );

  if (!report) return <Notice>Loading performance benchmark results…</Notice>;

  const vscode = report.projects.find((p) => p.name === "vscode");
  if (!vscode) return <Notice>vscode project not found in benchmark data.</Notice>;

  const stats = buildHeadlines(vscode);
  if (stats.length === 0)
    return <Notice>No comparable measurements found for vscode.</Notice>;

  const bestFactor = Math.max(...stats.map((s) => s.factor));

  return (
    <div className="not-prose my-6">
      <section className={panelClass}>
        {/* Header */}
        <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#222834] bg-gradient-to-b from-[#13171f] to-[#0e1116] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
            }}
          />
          <div>
            <Eyebrow label="Compiler performance" />
            <h2 className="mt-2.5 text-[17px] font-semibold tracking-tight text-neutral-50">
              vscode — 6,093 TypeScript files
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
              Build and type-check wall-clock time: legacy tsc versus ttsc
              backed by TypeScript-Go. Bars show minimum across{" "}
              {report.runs ?? 5} runs.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span
              className="font-mono text-[28px] font-black leading-none tabular-nums"
              style={{ color: ACCENT }}
            >
              {formatMultiplier(bestFactor)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              peak speedup
            </span>
          </div>
        </div>

        {/* Bars */}
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {stats.map((stat) => (
            <SpeedupRow key={stat.op} stat={stat} />
          ))}
        </div>
      </section>
    </div>
  );
}
