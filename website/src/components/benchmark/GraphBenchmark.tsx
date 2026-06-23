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

/** A horizontal savings bar: 0% is empty, 100% is full. */
function SavingsBar({
  pct,
  label,
  baseline,
  graph,
  light,
}: {
  pct: number;
  label: string;
  baseline: string;
  graph: string;
  light?: boolean;
}) {
  const widthPct = Math.max(0, Math.min(100, pct));
  const barColor = light ? "bg-emerald-600" : "bg-emerald-400";
  const pctColor = light ? "text-emerald-400" : "text-emerald-300";
  const showPct = pct > 0;

  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-neutral-400">
          {label}
        </p>
        <div className="flex shrink-0 items-baseline gap-2 font-mono text-[11px]">
          <span className="text-neutral-500">
            {baseline} &rarr; {graph}
          </span>
          {showPct ? (
            <span className={`font-semibold ${pctColor}`}>{pct}% saved</span>
          ) : (
            <span className="text-neutral-600">no change</span>
          )}
        </div>
      </div>
      <div className="h-5 w-full rounded bg-[#171d28]">
        <div
          className={`h-full rounded ${barColor}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
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
            Higher bar = more saved.
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
                    tokens saved
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <SavingsBar
                  label="tokens"
                  pct={tokensPct}
                  baseline={fmt(Math.round(baseTokens))}
                  graph={fmt(Math.round(graphTokens))}
                />
                <SavingsBar
                  label="tool calls"
                  pct={toolsPct}
                  baseline={fmt(Math.round(baseTools))}
                  graph={
                    graphTools % 1 === 0
                      ? fmt(Math.round(graphTools))
                      : graphTools.toFixed(1)
                  }
                />
                {guidedTokens !== undefined && guidedTools !== undefined ? (
                  <>
                    <SavingsBar
                      label="tokens (with AGENTS.md)"
                      pct={pctSaved(baseTokens, guidedTokens)}
                      baseline={fmt(Math.round(baseTokens))}
                      graph={fmt(Math.round(guidedTokens))}
                      light
                    />
                    <SavingsBar
                      label="tool calls (with AGENTS.md)"
                      pct={pctSaved(baseTools, guidedTools)}
                      baseline={fmt(Math.round(baseTools))}
                      graph={
                        guidedTools % 1 === 0
                          ? fmt(Math.round(guidedTools))
                          : guidedTools.toFixed(1)
                      }
                      light
                    />
                  </>
                ) : null}
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
