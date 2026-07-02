"use client";

import { useEffect, useState } from "react";

import type { ITtscWebsiteBenchmark } from "../../structures/ITtscWebsiteBenchmark";
import TtscWebsiteBenchmarkFormat from "./TtscWebsiteBenchmarkFormat";

const {
  findMeasurement,
  formatDuration,
  formatMultiplier,
  lintPluginMs,
  measurementMs,
} = TtscWebsiteBenchmarkFormat;

type BenchmarkOp = ITtscWebsiteBenchmark.Operation;
type BenchmarkProject = ITtscWebsiteBenchmark.Project;
type BenchmarkReport = ITtscWebsiteBenchmark.Report;
type BenchmarkThreading = ITtscWebsiteBenchmark.Threading;

// ---------------------------------------------------------------------------
// Style tokens, mirrored with the graph benchmark panels.
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
// Headline stats — one per operation, in display order
// ---------------------------------------------------------------------------

interface HeadlineStat {
  op: string;
  baselineLabel: string;
  fastLabel: string;
  baselineMs: number;
  fastMs: number;
  factor: number;
  note: string;
}

/** Fastest-first so the first cell found with data is the fastest available. */
const TTSC_CANDIDATES: readonly BenchmarkThreading[] = [
  "checkers8",
  "checkers4",
  "checkers2",
  "single",
];

/** CLI flag suffix for a threading variant. */
function flagLabel(threading: BenchmarkThreading): string {
  switch (threading) {
    case "single":
      return "--singleThreaded";
    case "checkers2":
      return "--checkers 2";
    case "checkers4":
      return "--checkers 4";
    case "checkers8":
      return "--checkers 8";
    case "multi":
      return "";
  }
}

function fastestTtsc(
  m: BenchmarkProject["measurements"],
  op: BenchmarkOp,
): { ms: number; threading: BenchmarkThreading } | undefined {
  for (const threading of TTSC_CANDIDATES) {
    const cell = findMeasurement(m, {
      branch: "ttsc",
      tool: "ttsc",
      op,
      threading,
    });
    if (cell && measurementMs(cell) > 0)
      return { ms: measurementMs(cell), threading };
  }
  return undefined;
}

/**
 * The native `@ttsc/lint` pass time — the single line the project reports as
 * lint cost — at the fastest threading. This is the headline the dashboard
 * sells (eslint vs the measured lint pass), not the whole check sidecar.
 */
function fastestLintPass(
  m: BenchmarkProject["measurements"],
): { ms: number; threading: BenchmarkThreading } | undefined {
  for (const threading of TTSC_CANDIDATES) {
    for (const op of ["noEmit", "build"] as BenchmarkOp[]) {
      const cell = findMeasurement(m, {
        branch: "ttsc-lint",
        tool: "ttsc+@ttsc/lint",
        op,
        threading,
      });
      if (cell) {
        const ms = lintPluginMs(cell);
        if (ms > 0) return { ms, threading };
      }
    }
  }
  return undefined;
}

function fastestFormat(
  m: BenchmarkProject["measurements"],
): { ms: number; threading: BenchmarkThreading } | undefined {
  // The format cell's tool value ("ttsc-format") is outside the typed
  // BenchmarkTool union, so match on branch + op + threading like the dashboard.
  for (const threading of ["multi", "single"] as BenchmarkThreading[]) {
    const cell = findMeasurement(m, {
      branch: "ttsc-lint",
      op: "format",
      threading,
    });
    if (cell && measurementMs(cell) > 0)
      return { ms: measurementMs(cell), threading };
  }
  return undefined;
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
  const fastBuild = fastestTtsc(m, "build");
  if (legacyBuild && fastBuild && measurementMs(legacyBuild) > 0) {
    const baselineMs = measurementMs(legacyBuild);
    stats.push({
      op: "Build",
      baselineLabel: "tsc",
      fastLabel: "ttsc",
      baselineMs,
      fastMs: fastBuild.ms,
      factor: baselineMs / fastBuild.ms,
      note: `ttsc ${flagLabel(fastBuild.threading)} vs tsc`
        .replace(/\s+/g, " ")
        .trim(),
    });
  }

  const legacyNoEmit = findMeasurement(m, {
    branch: "legacy",
    tool: "tsc",
    op: "noEmit",
    threading: "multi",
  });
  const fastNoEmit = fastestTtsc(m, "noEmit");
  if (legacyNoEmit && fastNoEmit && measurementMs(legacyNoEmit) > 0) {
    const baselineMs = measurementMs(legacyNoEmit);
    stats.push({
      op: "Type-check",
      baselineLabel: "tsc --noEmit",
      fastLabel: "ttsc --noEmit",
      baselineMs,
      fastMs: fastNoEmit.ms,
      factor: baselineMs / fastNoEmit.ms,
      note: `ttsc ${flagLabel(fastNoEmit.threading)} vs tsc`
        .replace(/\s+/g, " ")
        .trim(),
    });
  }

  const eslint =
    findMeasurement(m, {
      branch: "legacy",
      tool: "eslint",
      op: "eslint",
      threading: "multi",
    }) ??
    findMeasurement(m, {
      branch: "legacy",
      tool: "eslint",
      threading: "multi",
    });
  const fastLint = fastestLintPass(m);
  if (eslint && fastLint && measurementMs(eslint) > 0) {
    const baselineMs = measurementMs(eslint);
    stats.push({
      op: "Lint",
      baselineLabel: "eslint",
      fastLabel: "@ttsc/lint",
      baselineMs,
      fastMs: fastLint.ms,
      factor: baselineMs / fastLint.ms,
      note: "@ttsc/lint pass vs eslint",
    });
  }

  const prettier = findMeasurement(m, {
    branch: "legacy",
    tool: "prettier",
    op: "format",
    threading: "multi",
  });
  const fastFormat = fastestFormat(m);
  if (prettier && fastFormat && measurementMs(prettier) > 0) {
    const baselineMs = measurementMs(prettier);
    stats.push({
      op: "Format",
      baselineLabel: "prettier",
      fastLabel: "ttsc format",
      baselineMs,
      fastMs: fastFormat.ms,
      factor: baselineMs / fastFormat.ms,
      note:
        fastFormat.threading === "single"
          ? "ttsc format --singleThreaded vs prettier"
          : "ttsc format vs prettier",
    });
  }

  return stats;
}

// ---------------------------------------------------------------------------
// SpeedupRow — one operation as a full-width pair of duration bars
// ---------------------------------------------------------------------------

function Bar({
  label,
  ms,
  pct,
  accent,
}: {
  label: string;
  ms: number;
  pct: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <code
        className={`w-24 shrink-0 truncate text-right font-mono text-[10px] ${
          accent ? "font-bold" : "text-neutral-500"
        }`}
        style={accent ? { color: ACCENT } : undefined}
        title={label}
      >
        {label}
      </code>
      <div className="relative h-5 flex-1 overflow-hidden rounded bg-[#161b24] ring-1 ring-inset ring-white/[0.04]">
        <div
          className="h-full rounded"
          style={{
            width: `${pct}%`,
            background: accent
              ? `linear-gradient(90deg, ${ACCENT}, #19b6c9)`
              : "#4b5563",
            boxShadow: accent ? `0 0 8px ${ACCENT}44` : undefined,
          }}
        />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-neutral-300">
        {formatDuration(ms)}
      </span>
    </div>
  );
}

function SpeedupRow({ stat, files }: { stat: HeadlineStat; files: number }) {
  const fastPct = Math.min(
    100,
    Math.max(3, (stat.fastMs / stat.baselineMs) * 100),
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
        <Bar label={stat.baselineLabel} ms={stat.baselineMs} pct={100} />
        <Bar label={stat.fastLabel} ms={stat.fastMs} pct={fastPct} accent />
      </div>

      <p className="font-mono text-[10px] text-neutral-500">
        {stat.note} · vscode · {files.toLocaleString()} files
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

export default function TtscWebsiteBenchmarkPerformanceSummary() {
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
  if (!vscode)
    return <Notice>vscode project not found in benchmark data.</Notice>;

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
              Build, type-check, lint and format wall-clock time: the legacy tsc
              / eslint / prettier toolchain versus ttsc backed by TypeScript-Go.
              Bars show the minimum across {report.runs ?? 5} runs.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
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

        {/* Bars — one operation per row */}
        <div className="space-y-3 p-4">
          {stats.map((stat) => (
            <SpeedupRow key={stat.op} stat={stat} files={vscode.files} />
          ))}
        </div>
      </section>
    </div>
  );
}
