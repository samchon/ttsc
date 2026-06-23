"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentSample {
  tokens: number;
  tools: number;
  [key: string]: unknown;
}

interface AgentCell {
  harness: string;
  repo: string;
  model: string;
  runs?: number;
  tool?: string;
  samples: {
    baseline: AgentSample[];
    graph: AgentSample[];
    guided?: AgentSample[];
  };
}

interface StructuralData {
  sourceFiles?: number;
  nodes?: number;
  externalNodes?: number;
  edges?: {
    heritage?: number;
    "type-ref"?: number;
    "value-call"?: number;
  };
  totalEdges?: number;
  symbolFiles?: number;
  coveredFiles?: number;
  coverage?: number;
  loadMsMedian?: number;
  buildMsMedian?: number;
}

interface GraphReport {
  structural?: StructuralData;
  agent?: {
    cells: AgentCell[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function pctSaved(base: number, graph: number): number {
  if (base <= 0) return 0;
  return Math.round((1 - graph / base) * 100);
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function modelLabel(cell: AgentCell): string {
  if (cell.model === "sonnet") return "Claude Sonnet 4.6";
  if (cell.model === "opus") return "Claude Opus 4.8";
  if (cell.model === "gpt-5.5") return "GPT-5.5 (codex)";
  return `${cell.model} (${cell.harness})`;
}

// ---------------------------------------------------------------------------
// Visual sub-components
// ---------------------------------------------------------------------------

const panelClass =
  "overflow-hidden rounded-md border border-[#262b36] bg-[#0f1115] shadow-[0_12px_30px_rgba(0,0,0,0.22)]";
const panelHeaderClass =
  "flex flex-wrap items-end justify-between gap-2 border-b border-[#262b36] bg-[#121620] px-4 py-3";

/**
 * Paired before/after bars for one metric.
 *
 * The baseline bar is always full-width (muted gray track). The graph bar's
 * WIDTH is graphMedian/baselineMedian of the track, so a large reduction (e.g.
 * 86% fewer tokens) renders as a short green sliver — the geometry matches the
 * meaning rather than filling the bar to the saved percentage.
 *
 * An optional third bar ("guided") is shown when the cell has a guided arm.
 */
function SavingsBar({
  pct,
  label,
  baselineRaw,
  graphRaw,
  graphWidthPct,
  guidedRaw,
  guidedWidthPct,
  guidedPct,
  light,
}: {
  pct: number;
  label: string;
  baselineRaw: string;
  graphRaw: string;
  graphWidthPct: number;
  guidedRaw?: string;
  guidedWidthPct?: number;
  guidedPct?: number;
  light?: boolean;
}) {
  const pctColor = light ? "text-emerald-400" : "text-emerald-300";
  const graphBarColor = light ? "bg-emerald-600" : "bg-emerald-400";

  return (
    <div className="space-y-1 py-1.5">
      {/* Header row: metric label + "N% fewer" headline */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-400">
          {label}
        </p>
        {pct > 0 ? (
          <span className={`shrink-0 font-mono text-[11px] font-semibold ${pctColor}`}>
            {pct}% fewer
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[11px] text-neutral-600">
            no change
          </span>
        )}
      </div>

      {/* Baseline bar — always full width, muted */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-500">
          baseline
        </span>
        <div className="flex-1 overflow-hidden rounded bg-neutral-700/60">
          <div className="flex h-5 w-full items-center justify-end rounded bg-neutral-600 px-2">
            <span className="font-mono text-[10px] font-semibold text-neutral-300">
              {baselineRaw}
            </span>
          </div>
        </div>
      </div>

      {/* Graph bar — width proportional to graph/baseline ratio */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-500">
          graph
        </span>
        <div className="flex-1 overflow-hidden rounded bg-[#171d28]">
          <div
            className={`flex h-5 min-w-[1.5rem] items-center justify-end rounded px-2 ${graphBarColor}`}
            style={{ width: `${Math.max(2, graphWidthPct)}%` }}
          >
            <span className="font-mono text-[10px] font-semibold text-emerald-950">
              {graphRaw}
            </span>
          </div>
        </div>
      </div>

      {/* Guided arm (optional) */}
      {guidedRaw !== undefined && guidedWidthPct !== undefined ? (
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-right font-mono text-[10px] text-neutral-500">
            guided
          </span>
          <div className="flex-1 overflow-hidden rounded bg-[#171d28]">
            <div
              className="flex h-5 min-w-[1.5rem] items-center justify-end rounded bg-emerald-600 px-2"
              style={{ width: `${Math.max(2, guidedWidthPct)}%` }}
            >
              <span className="font-mono text-[10px] font-semibold text-emerald-950">
                {guidedRaw}
              </span>
            </div>
          </div>
          {guidedPct !== undefined && guidedPct > 0 ? (
            <span className="shrink-0 font-mono text-[10px] text-emerald-400">
              {guidedPct}% fewer
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AgentCostSection({ cells }: { cells: AgentCell[] }) {
  return (
    <section className={panelClass}>
      <div className={panelHeaderClass}>
        <div>
          <h2 className="text-base font-semibold text-neutral-50">
            Agent cost
          </h2>
          <p className="mt-1 text-[13px] text-neutral-400">
            Median tokens and tool calls: empty-MCP baseline vs. graph arm.
            Shorter graph bar = less usage.
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase text-neutral-500">
          {cells.length} model{cells.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="divide-y divide-[#252b36]">
        {cells.map((cell) => {
          const baseTokens = median(
            cell.samples.baseline.map((s) => s.tokens),
          );
          const graphTokens = median(cell.samples.graph.map((s) => s.tokens));
          const baseTools = median(cell.samples.baseline.map((s) => s.tools));
          const graphTools = median(cell.samples.graph.map((s) => s.tools));
          const tokensPct = pctSaved(baseTokens, graphTokens);
          const toolsPct = pctSaved(baseTools, graphTools);

          const guided = Array.isArray(cell.samples.guided)
            ? cell.samples.guided
            : undefined;
          const guidedTokens = guided
            ? median(guided.map((s) => s.tokens))
            : undefined;
          const guidedTools = guided
            ? median(guided.map((s) => s.tools))
            : undefined;

          return (
            <div
              key={`${cell.harness}:${cell.repo}:${cell.model}`}
              className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)]"
            >
              <div>
                <p className="font-mono text-sm font-semibold text-neutral-100">
                  {modelLabel(cell)}
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {cell.repo} &middot; {cell.harness}
                </p>
                {cell.runs !== undefined ? (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {cell.runs} runs
                  </p>
                ) : null}
                <div className="mt-3">
                  <div
                    className={`font-mono text-3xl font-bold leading-none md:text-4xl ${
                      tokensPct > 0 ? "text-emerald-300" : "text-neutral-500"
                    }`}
                  >
                    {tokensPct > 0 ? `${tokensPct}%` : "0%"}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    tokens fewer
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <SavingsBar
                  label="tokens"
                  pct={tokensPct}
                  baselineRaw={fmt(Math.round(baseTokens))}
                  graphRaw={fmt(Math.round(graphTokens))}
                  graphWidthPct={
                    baseTokens > 0 ? (graphTokens / baseTokens) * 100 : 100
                  }
                  guidedRaw={
                    guidedTokens !== undefined
                      ? fmt(Math.round(guidedTokens))
                      : undefined
                  }
                  guidedWidthPct={
                    guidedTokens !== undefined && baseTokens > 0
                      ? (guidedTokens / baseTokens) * 100
                      : undefined
                  }
                  guidedPct={
                    guidedTokens !== undefined
                      ? pctSaved(baseTokens, guidedTokens)
                      : undefined
                  }
                />
                <SavingsBar
                  label="tool calls"
                  pct={toolsPct}
                  baselineRaw={fmt(Math.round(baseTools))}
                  graphRaw={
                    graphTools % 1 === 0
                      ? fmt(Math.round(graphTools))
                      : graphTools.toFixed(1)
                  }
                  graphWidthPct={
                    baseTools > 0 ? (graphTools / baseTools) * 100 : 100
                  }
                  guidedRaw={
                    guidedTools !== undefined
                      ? guidedTools % 1 === 0
                        ? fmt(Math.round(guidedTools))
                        : guidedTools.toFixed(1)
                      : undefined
                  }
                  guidedWidthPct={
                    guidedTools !== undefined && baseTools > 0
                      ? (guidedTools / baseTools) * 100
                      : undefined
                  }
                  guidedPct={
                    guidedTools !== undefined
                      ? pctSaved(baseTools, guidedTools)
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StructuralSection({ data }: { data: StructuralData }) {
  const coverage =
    data.coverage !== undefined ? `${(data.coverage * 100).toFixed(1)}%` : "—";
  const coverageDetail =
    data.coveredFiles !== undefined && data.symbolFiles !== undefined
      ? `${data.coveredFiles} of ${data.symbolFiles} symbol-bearing files`
      : undefined;

  const stats: { label: string; value: string; note?: string }[] = [
    {
      label: "Source files",
      value: data.sourceFiles !== undefined ? fmt(data.sourceFiles) : "—",
    },
    {
      label: "Nodes",
      value: data.nodes !== undefined ? fmt(data.nodes) : "—",
      note:
        data.externalNodes !== undefined
          ? `${data.externalNodes} external`
          : undefined,
    },
    {
      label: "Total edges",
      value: data.totalEdges !== undefined ? fmt(data.totalEdges) : "—",
      note: data.edges
        ? [
            data.edges.heritage !== undefined
              ? `heritage ${data.edges.heritage}`
              : null,
            data.edges["type-ref"] !== undefined
              ? `type-ref ${data.edges["type-ref"]}`
              : null,
            data.edges["value-call"] !== undefined
              ? `value-call ${data.edges["value-call"]}`
              : null,
          ]
            .filter(Boolean)
            .join(", ")
        : undefined,
    },
    {
      label: "Fair coverage",
      value: coverage,
      note: coverageDetail,
    },
  ];

  const timingStats: { label: string; value: string }[] = [];
  if (data.loadMsMedian !== undefined)
    timingStats.push({
      label: "Load (median)",
      value: `${Math.round(data.loadMsMedian)} ms`,
    });
  if (data.buildMsMedian !== undefined)
    timingStats.push({
      label: "Graph build (median)",
      value: `${Math.round(data.buildMsMedian)} ms`,
    });

  return (
    <section className={panelClass}>
      <div className={panelHeaderClass}>
        <div>
          <h2 className="text-base font-semibold text-neutral-50">
            Structural coverage
          </h2>
          <p className="mt-1 text-[13px] text-neutral-400">
            Node and edge counts plus the share of symbol-bearing source files
            with at least one resolved cross-file edge.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-[#262b36] xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#0f1115] px-4 py-3">
            <dt className="font-mono text-[11px] uppercase text-neutral-500">
              {stat.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-50">
              {stat.value}
            </dd>
            {stat.note ? (
              <dd className="mt-1 truncate text-[11px] text-neutral-500" title={stat.note}>
                {stat.note}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>

      {timingStats.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px border-t border-[#262b36] bg-[#262b36] sm:grid-cols-4">
          {timingStats.map((stat) => (
            <div key={stat.label} className="bg-[#0f1115] px-4 py-3">
              <dt className="font-mono text-[11px] uppercase text-neutral-500">
                {stat.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-neutral-50">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface GraphBenchmarkProps {
  variant?: "summary" | "full";
}

export default function GraphBenchmark({
  variant = "full",
}: GraphBenchmarkProps) {
  const [report, setReport] = useState<GraphReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/benchmark/graph.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<GraphReport>;
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
      <p className="not-prose my-6 rounded-md border border-[#262b36] bg-[#0f1115] px-4 py-3 font-mono text-[12px] text-neutral-400">
        Could not load graph benchmark data ({error}).
      </p>
    );

  if (!report)
    return (
      <p className="not-prose my-6 rounded-md border border-[#262b36] bg-[#0f1115] px-4 py-3 font-mono text-[12px] text-neutral-400">
        Loading graph benchmark results...
      </p>
    );

  const cells = report.agent?.cells ?? [];

  return (
    <div className="not-prose my-6 space-y-5">
      {cells.length > 0 ? <AgentCostSection cells={cells} /> : null}
      {variant === "full" && report.structural ? (
        <StructuralSection data={report.structural} />
      ) : null}
    </div>
  );
}
