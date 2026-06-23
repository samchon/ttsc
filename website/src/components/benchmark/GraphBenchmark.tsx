"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentSample {
  tokens: number;
  tools: number;
  durMs?: number;
  [key: string]: unknown;
}

interface AgentCell {
  harness: string;
  repo: string;
  model: string;
  effort?: string;
  fixtureBranch?: string;
  daemon?: boolean;
  runs?: number;
  tool?: string;
  question?: string;
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

function fmtSecs(ms: number): string {
  return `${Math.round(ms / 1000)}s`;
}

function modelLabel(cell: AgentCell): string {
  if (cell.model === "sonnet") return "Claude Sonnet 4.6";
  if (cell.model === "opus") return "Claude Opus 4.8";
  if (cell.model === "gpt-5.5")
    return `GPT-5.5 (codex${cell.effort ? `/${cell.effort}` : ""})`;
  return `${cell.model} (${cell.harness})`;
}

// ---------------------------------------------------------------------------
// Shared style tokens (harmonized with BenchmarkDashboard + landing movies)
// ---------------------------------------------------------------------------

const ACCENT = "#36e2ee";

const panelClass =
  "overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e13] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

/** Mono uppercase eyebrow, mirrors the landing SectionEyebrow voice. */
function Eyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
      <span style={{ color: ACCENT }}>[</span>
      <span className="mx-2 text-neutral-400">{label}</span>
      <span style={{ color: ACCENT }}>]</span>
    </p>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#222834] bg-gradient-to-b from-[#13171f] to-[#0e1116] px-5 py-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
        }}
      />
      <div>
        <Eyebrow label={eyebrow} />
        <h2 className="mt-2.5 text-[17px] font-semibold tracking-tight text-neutral-50">
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
          {description}
        </p>
      </div>
      {aside ? (
        <span className="shrink-0 rounded-full border border-[#2a313e] bg-[#0c0e13] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent cost: the percentages are the hero
// ---------------------------------------------------------------------------

/**
 * One metric as a split usage bar.
 *
 * The whole track is the empty-MCP baseline (100%). The cyan segment is how
 * much the graph still uses (graphMedian / baselineMedian), the grey remainder
 * is what it saves. So "86% saved" shows as a bar that is mostly the grey
 * "saved" region, never an 86%-full bar that could read as "86% remains". The
 * raw token and tool counts appear only on hover (the bar's title); the
 * percentages stay visible. An optional second row shows the guided arm.
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
  // A hair of cyan always shows so a 0%-saved row still reads as deliberate.
  const fillWidth = Math.max(1.5, usedWidth);
  const comparisonLabel = rowLabel ?? "graph";

  return (
    <div
      className="space-y-1.5"
      title={`${metric}: baseline ${baselineRaw} -> ${comparisonLabel} ${graphRaw}`}
    >
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider">
        <span style={{ color: ACCENT }}>
          {used}% used
          {rowLabel ? (
            <span className="ml-1 text-neutral-500 normal-case tracking-normal">
              {rowLabel}
            </span>
          ) : null}
        </span>
        <span className="text-neutral-500">{saved}% saved</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ring-white/[0.04]">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_6px,transparent_6px,transparent_12px)]" />
        <div
          className="relative h-full rounded-full"
          style={{
            width: `${fillWidth}%`,
            background: rowLabel
              ? `linear-gradient(90deg, ${ACCENT}aa, ${ACCENT}66)`
              : `linear-gradient(90deg, ${ACCENT}, #19b6c9)`,
            boxShadow: rowLabel
              ? "none"
              : `0 0 12px ${ACCENT}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}
        >
          <span className="absolute right-0 top-0 h-full w-px bg-white/40" />
        </div>
      </div>
    </div>
  );
}

function MetricBlock({
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
    <div className="space-y-2.5 rounded-md border border-[#1c2230] bg-[#0e1117] px-3.5 py-3">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-300">
          {metric}
        </p>
        <p className="font-mono text-[10px] text-neutral-500">
          baseline {baselineRaw} to graph {graphRaw}
        </p>
      </div>
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
          rowLabel="guided (AGENTS.md)"
        />
      ) : null}
    </div>
  );
}

/** Oversized used / saved headline: the hero numerals of each model row. */
function SavingHeadline({ tokensPct }: { tokensPct: number }) {
  const used = 100 - tokensPct;
  return (
    <div className="mt-4">
      <div className="flex items-end gap-1.5 font-mono font-black tabular-nums leading-none tracking-tight">
        <span className="text-[44px] md:text-[52px]" style={{ color: ACCENT }}>
          {used}
          <span className="align-top text-[26px] font-bold md:text-[30px]">%</span>
        </span>
        <span className="text-[30px] font-bold text-neutral-700 md:text-[36px]">
          /
        </span>
        <span className="text-[44px] text-neutral-300 md:text-[52px]">
          {tokensPct}
          <span className="align-top text-[26px] font-bold md:text-[30px]">%</span>
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        <span style={{ color: ACCENT }}>used</span>
        <span className="text-neutral-700">/</span>
        <span>saved / tokens</span>
      </div>
    </div>
  );
}

function AgentCostSection({ cells }: { cells: AgentCell[] }) {
  return (
    <section className={panelClass}>
      <SectionHeader
        eyebrow="Agent cost"
        title="What the code graph saves a coding agent"
        description="Each bar compares the baseline run with graph, and the optional second bar shows guided. Hover any bar for the raw median counts."
        aside={`${cells.length} model${cells.length !== 1 ? "s" : ""}`}
      />

      <div className="divide-y divide-[#1a1f29]">
        {cells.map((cell) => {
          const baseTokens = median(
            cell.samples.baseline.map((s) => s.tokens),
          );
          const graphTokens = median(cell.samples.graph.map((s) => s.tokens));
          const baseTools = median(cell.samples.baseline.map((s) => s.tools));
          const graphTools = median(cell.samples.graph.map((s) => s.tools));
          const baseDur = median(
            cell.samples.baseline.map((s) => s.durMs ?? 0),
          );
          const graphDur = median(cell.samples.graph.map((s) => s.durMs ?? 0));
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
          const guidedDur = guided
            ? median(guided.map((s) => s.durMs ?? 0))
            : undefined;

          return (
            <div
              key={`${cell.harness}:${cell.repo}:${cell.model}:${cell.effort ?? ""}:${cell.fixtureBranch ?? ""}:${cell.daemon === true ? "daemon" : "single"}`}
              className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(9rem,15rem)_minmax(0,1fr)] md:gap-6"
            >
              <div className="md:border-r md:border-[#1a1f29] md:pr-6">
                <p className="text-[15px] font-semibold tracking-tight text-neutral-50">
                  {modelLabel(cell)}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-neutral-500">
                  {cell.repo} - {cell.harness}
                  {cell.fixtureBranch ? ` - ${cell.fixtureBranch}` : ""}
                  {cell.daemon !== undefined
                    ? ` - ${cell.daemon ? "daemon" : "single"}`
                    : ""}
                  {cell.runs !== undefined ? ` - ${cell.runs} runs` : ""}
                </p>
                {cell.question ? (
                  <p className="mt-2 max-w-[18rem] text-[12px] italic leading-snug text-neutral-400">
                    {cell.question}
                  </p>
                ) : null}
                <SavingHeadline tokensPct={tokensPct} />
              </div>

              <div className="space-y-2.5">
                <MetricBlock
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
                <MetricBlock
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
                <MetricBlock
                  metric="wall time"
                  baseMedian={baseDur}
                  graphMedian={graphDur}
                  baselineRaw={fmtSecs(baseDur)}
                  graphRaw={fmtSecs(graphDur)}
                  guided={
                    guidedDur !== undefined
                      ? {
                          median: guidedDur,
                          raw: fmtSecs(guidedDur),
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

// ---------------------------------------------------------------------------
// Structural coverage: elegant stat cards
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  unit,
  note,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="group relative bg-[#0c0e13] px-4 py-4 transition-colors hover:bg-[#0f1219]">
      {accent ? (
        <span
          className="pointer-events-none absolute inset-y-3 left-0 w-px"
          style={{ background: ACCENT }}
        />
      ) : null}
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1">
        <span
          className="font-mono text-[26px] font-bold leading-none tabular-nums tracking-tight"
          style={accent ? { color: ACCENT } : { color: "#f5f5f5" }}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[12px] font-medium text-neutral-500">
            {unit}
          </span>
        ) : null}
      </dd>
      {note ? (
        <dd
          className="mt-2 truncate font-mono text-[10px] text-neutral-500"
          title={note}
        >
          {note}
        </dd>
      ) : null}
    </div>
  );
}

interface Stat {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: boolean;
}

function StructuralSection({ data }: { data: StructuralData }) {
  const coverage =
    data.coverage !== undefined
      ? `${(data.coverage * 100).toFixed(data.coverage === 1 ? 0 : 1)}`
      : "n/a";
  const coverageDetail =
    data.coveredFiles !== undefined && data.symbolFiles !== undefined
      ? `${data.coveredFiles} of ${data.symbolFiles} symbol-bearing files`
      : undefined;

  const stats: Stat[] = [
    {
      label: "Source files",
      value: data.sourceFiles !== undefined ? fmt(data.sourceFiles) : "n/a",
    },
    {
      label: "Nodes",
      value: data.nodes !== undefined ? fmt(data.nodes) : "n/a",
      note:
        data.externalNodes !== undefined
          ? `${data.externalNodes} external`
          : undefined,
    },
    {
      label: "Total edges",
      value: data.totalEdges !== undefined ? fmt(data.totalEdges) : "n/a",
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
            .join(" / ")
        : undefined,
    },
    {
      label: "Fair coverage",
      value: coverage,
      unit: coverage === "n/a" ? undefined : "%",
      note: coverageDetail,
      accent: true,
    },
  ];

  const timingStats: Stat[] = [];
  if (data.loadMsMedian !== undefined)
    timingStats.push({
      label: "Load median",
      value: `${Math.round(data.loadMsMedian)}`,
      unit: "ms",
    });
  if (data.buildMsMedian !== undefined)
    timingStats.push({
      label: "Graph build median",
      value: `${Math.round(data.buildMsMedian)}`,
      unit: "ms",
    });

  return (
    <section className={panelClass}>
      <SectionHeader
        eyebrow="Structural coverage"
        title="What the graph actually resolves"
        description="Node and edge counts plus the share of symbol-bearing source files with at least one resolved cross-file edge."
      />

      <dl className="grid grid-cols-2 gap-px bg-[#1a1f29] xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </dl>

      {timingStats.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px border-t border-[#1a1f29] bg-[#1a1f29] sm:grid-cols-4">
          {timingStats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="not-prose my-6 rounded-lg border border-[#222834] bg-[#0c0e13] px-4 py-3 font-mono text-[12px] text-neutral-400">
      {children}
    </p>
  );
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
    return <Notice>Could not load graph benchmark data ({error}).</Notice>;

  if (!report) return <Notice>Loading graph benchmark results...</Notice>;

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
