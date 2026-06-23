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
 * One metric as a split usage bar.
 *
 * The whole track is the empty-MCP baseline (100%). The left segment is how much
 * the graph still uses (graphMedian / baselineMedian), the right segment is what
 * it saves. So "86% saved" shows as a bar that is mostly the green "saved"
 * region, never an 86%-full bar that could read as "86% remains". The raw token
 * and tool counts appear only on hover (the bar's title); the percentages stay
 * visible. An optional second row shows the guided (AGENTS.md) arm.
 */
function UsageBar({
  metric,
  baseMedian,
  graphMedian,
  baselineRaw,
  graphRaw,
  rowLabel,
}: {
  metric: string;
  baseMedian: number;
  graphMedian: number;
  baselineRaw: string;
  graphRaw: string;
  rowLabel?: string;
}) {
  const usedWidth =
    baseMedian > 0 ? Math.min(100, (graphMedian / baseMedian) * 100) : 100;
  const saved = pctSaved(baseMedian, graphMedian);
  const used = 100 - saved;
  return (
    <div
      className="space-y-1"
      title={`${metric}: baseline ${baselineRaw} ${"→"} ${rowLabel ? "with AGENTS.md " : ""}${graphRaw}`}
    >
      <div className="flex h-5 w-full overflow-hidden rounded bg-[#171d28]">
        <div
          className="h-full bg-neutral-500/80"
          style={{ width: `${usedWidth}%` }}
        />
        <div className="h-full flex-1 bg-emerald-500" />
      </div>
      <div className="flex justify-between font-mono text-[10px]">
        <span className="text-neutral-400">
          {used}% used{rowLabel ? ` (${rowLabel})` : ""}
        </span>
        <span className="text-emerald-300">{saved}% saved</span>
      </div>
    </div>
  );
}

function SavingsBar({
  metric,
  baseMedian,
  graphMedian,
  baselineRaw,
  graphRaw,
  guided,
}: {
  metric: string;
  baseMedian: number;
  graphMedian: number;
  baselineRaw: string;
  graphRaw: string;
  guided?: { median: number; raw: string };
}) {
  return (
    <div className="space-y-1.5 py-1.5">
      <p className="font-mono text-[11px] text-neutral-400">{metric}</p>
      <UsageBar
        metric={metric}
        baseMedian={baseMedian}
        graphMedian={graphMedian}
        baselineRaw={baselineRaw}
        graphRaw={graphRaw}
      />
      {guided ? (
        <UsageBar
          metric={metric}
          baseMedian={baseMedian}
          graphMedian={guided.median}
          baselineRaw={baselineRaw}
          graphRaw={guided.raw}
          rowLabel="AGENTS.md"
        />
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
            Each bar is the empty-MCP baseline. The grey part is what the graph
            still uses, the green part is what it saves. Hover for the raw counts.
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
                    tokens saved
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <SavingsBar
                  metric="tokens"
                  baseMedian={baseTokens}
                  graphMedian={graphTokens}
                  baselineRaw={fmt(Math.round(baseTokens))}
                  graphRaw={fmt(Math.round(graphTokens))}
                  guided={
                    guidedTokens !== undefined
                      ? {
                          median: guidedTokens,
                          raw: fmt(Math.round(guidedTokens)),
                        }
                      : undefined
                  }
                />
                <SavingsBar
                  metric="tool calls"
                  baseMedian={baseTools}
                  graphMedian={graphTools}
                  baselineRaw={fmt(Math.round(baseTools))}
                  graphRaw={
                    graphTools % 1 === 0
                      ? fmt(Math.round(graphTools))
                      : graphTools.toFixed(1)
                  }
                  guided={
                    guidedTools !== undefined
                      ? {
                          median: guidedTools,
                          raw:
                            guidedTools % 1 === 0
                              ? fmt(Math.round(guidedTools))
                              : guidedTools.toFixed(1),
                        }
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
