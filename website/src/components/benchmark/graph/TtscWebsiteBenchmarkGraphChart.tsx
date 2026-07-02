"use client";

import { useMemo } from "react";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";

type Metrics = ITtscWebsiteBenchmarkGraph.Metrics;
type ReductionRow = ITtscWebsiteBenchmarkGraph.ReductionRow;
type ReductionSeriesKey = ITtscWebsiteBenchmarkGraph.ReductionSeriesKey;
type ReductionTool = ITtscWebsiteBenchmarkGraph.ReductionTool;
type ToolKey = ITtscWebsiteBenchmarkGraph.ToolKey;

function LegendDot({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: fill }}
      />
      {label}
    </span>
  );
}

function CrownMark({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-3 w-3 shrink-0 items-center justify-center ${
        active ? "text-[#36e2ee]" : "text-transparent"
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none">
        <path
          d="M2.5 5.5 5.4 8l2.6-4 2.6 4 2.9-2.5-.8 6H3.3l-.8-6Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.35"
        />
        <path
          d="M3.5 12.5h9"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.35"
        />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Token reduction charts
// ---------------------------------------------------------------------------

function toolReduction(row: ReductionRow, tool: ReductionTool): number | null {
  if (!tool.metrics) return null;
  return TtscWebsiteBenchmarkGraphData.pctSaved(
    row.baseline.tokens,
    tool.metrics.tokens,
  );
}

function reductionLabel(reduction: number | null): string {
  if (reduction === null) return "n/a";
  return `${reduction}%`;
}

function averageReduction(
  rows: ReductionRow[],
  toolKey: ToolKey,
): number | null {
  const values = rows
    .map((row) => {
      const tool = row.tools.find((candidate) => candidate.key === toolKey);
      return tool ? toolReduction(row, tool) : null;
    })
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function reductionText(reduction: number | null): string {
  if (reduction === null) return "No data";
  return reduction >= 0
    ? `${reduction}% saved`
    : `${-reduction}% over baseline`;
}

interface TokenDomain {
  maxTokens: number;
}

function tokenDomain(rows: ReductionRow[]): TokenDomain {
  const values = rows
    .flatMap((row) => [
      row.baseline.tokens,
      ...row.tools
        .map((tool) => tool.metrics?.tokens)
        .filter((value): value is number => value !== undefined),
    ])
    .filter((value) => Number.isFinite(value) && value > 0);
  const max = Math.max(1, ...values);
  return { maxTokens: max * 1.05 };
}

function tokenPosition(tokens: number, domain: TokenDomain): number {
  if (domain.maxTokens <= 0) return 0;
  return Math.max(0, Math.min(100, (tokens / domain.maxTokens) * 100));
}

function tokenBarStyle(
  tokens: number | null,
  domain: TokenDomain,
): { width: string } {
  if (tokens === null) return { width: "0%" };
  return { width: `${Math.max(1.2, tokenPosition(tokens, domain))}%` };
}

function tokenTicks(domain: TokenDomain): number[] {
  // Clamp the domain first: a non-finite or non-positive max would otherwise
  // poison the step computation below and hang the render loop.
  const max =
    Number.isFinite(domain.maxTokens) && domain.maxTokens > 0
      ? domain.maxTokens
      : 1;
  const rawStep = max / 4;
  const base = 10 ** Math.floor(Math.log10(rawStep));
  const candidate =
    [1, 2, 5, 10].find((factor) => factor * base >= rawStep) ?? 10 * base;
  // step MUST be a finite positive number, or the for-loop never terminates.
  const step = Number.isFinite(candidate) && candidate > 0 ? candidate : max;
  const ticks: number[] = [];
  // Hard cap on iterations as a final backstop: no data shape can ever spin
  // this loop forever.
  for (let tick = 0; tick <= max && ticks.length < 64; tick += step)
    ticks.push(tick);
  if (ticks.length <= 1) return [0, max];
  return ticks;
}

function fmtTokenShort(tokens: number): string {
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k`;
  return `${Math.round(tokens)}`;
}

function tokenUsageText(tokens: number): string {
  return `${fmtTokenShort(tokens)} tokens`;
}

function lowestTokenSeries(row: ReductionRow): ReductionSeriesKey {
  const entries: { key: ReductionSeriesKey; tokens: number }[] = [
    { key: "baseline", tokens: row.baseline.tokens },
    ...row.tools
      .filter(
        (tool): tool is ReductionTool & { metrics: Metrics } =>
          tool.metrics !== undefined,
      )
      .map((tool) => ({ key: tool.key, tokens: tool.metrics.tokens })),
  ];
  return entries.reduce((best, entry) =>
    entry.tokens < best.tokens ? entry : best,
  ).key;
}

/**
 * Signed percentage change of a tool value against its baseline, for the
 * parenthesized annotation next to each non-baseline metric: negative is a
 * reduction, positive is over baseline. Null when the baseline is missing.
 */
function pctDelta(base: number, value: number): number | null {
  if (base <= 0) return null;
  return Math.round((value / base - 1) * 100);
}

function deltaText(delta: number | null): string | null {
  if (delta === null) return null;
  return `(${delta > 0 ? "+" : ""}${delta}%)`;
}

interface TooltipMetricRow {
  label: string;
  base: string;
  value: string;
  delta: number | null;
}

function tooltipMetricRows(
  baseline: Metrics,
  metrics: Metrics,
): TooltipMetricRow[] {
  const rows: TooltipMetricRow[] = [
    {
      label: "tokens",
      base: TtscWebsiteBenchmarkGraphData.fmt(Math.round(baseline.tokens)),
      value: TtscWebsiteBenchmarkGraphData.fmt(Math.round(metrics.tokens)),
      delta: pctDelta(baseline.tokens, metrics.tokens),
    },
    {
      label: "calls",
      base: TtscWebsiteBenchmarkGraphData.fmt(Math.round(baseline.tools)),
      value: TtscWebsiteBenchmarkGraphData.fmt(Math.round(metrics.tools)),
      delta: pctDelta(baseline.tools, metrics.tools),
    },
    {
      label: "time",
      base: TtscWebsiteBenchmarkGraphData.fmtSecs(baseline.dur),
      value: TtscWebsiteBenchmarkGraphData.fmtSecs(metrics.dur),
      delta: pctDelta(baseline.dur, metrics.dur),
    },
  ];
  // Cost is measured on harnesses that report it (Claude Code) and estimated
  // from tokens at API list prices otherwise (Codex); an estimate carries a
  // leading ~. The row is omitted only when neither value exists.
  if (baseline.cost !== undefined || metrics.cost !== undefined)
    rows.push({
      label: "cost",
      base:
        baseline.cost !== undefined
          ? `${baseline.costEstimated ? "~" : ""}${TtscWebsiteBenchmarkGraphData.fmtCost(baseline.cost)}`
          : "n/a",
      value:
        metrics.cost !== undefined
          ? `${metrics.costEstimated ? "~" : ""}${TtscWebsiteBenchmarkGraphData.fmtCost(metrics.cost)}`
          : "n/a",
      delta:
        baseline.cost !== undefined && metrics.cost !== undefined
          ? pctDelta(baseline.cost, metrics.cost)
          : null,
    });
  return rows;
}

function ReductionTooltip({
  row,
  tool,
}: {
  row: ReductionRow;
  tool: ReductionTool;
}) {
  const reduction = toolReduction(row, tool);
  if (!tool.metrics)
    return (
      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-md border border-[#2a313e] bg-[#090b10] p-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] group-hover:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
          {row.label} / {tool.label}
        </p>
        <p className="mt-2 text-[12px] font-medium text-neutral-300">
          No published measurement.
        </p>
      </div>
    );

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-80 rounded-md border border-[#2a313e] bg-[#090b10] p-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] group-hover:block">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${tool.textColor}99, transparent)`,
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
            {row.label}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-neutral-100">
            {tool.label}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-1 font-mono text-[11px] tabular-nums"
          style={{ borderColor: `${tool.textColor}66`, color: tool.textColor }}
        >
          {reductionText(reduction)}
        </span>
      </div>

      <div className="mt-3 rounded border border-[#1c2230] bg-[#0e1117] p-2 font-mono text-[10px]">
        <div className="grid grid-cols-[3.25rem_1fr_1fr] gap-x-2 uppercase tracking-[0.12em] text-neutral-600">
          <span />
          <span className="text-right">baseline</span>
          <span className="text-right">tool</span>
        </div>
        {tooltipMetricRows(row.baseline, tool.metrics).map((metric) => (
          <div
            key={metric.label}
            className="mt-1 grid grid-cols-[3.25rem_1fr_1fr] items-baseline gap-x-2"
          >
            <span className="uppercase tracking-[0.12em] text-neutral-600">
              {metric.label}
            </span>
            <span className="text-right tabular-nums text-neutral-400">
              {metric.base}
            </span>
            <span className="text-right tabular-nums text-neutral-200">
              {metric.value}
              {deltaText(metric.delta) ? (
                <span
                  className={`ml-1 ${
                    metric.delta !== null && metric.delta > 0
                      ? "text-rose-400"
                      : "text-[#36e2ee]"
                  }`}
                >
                  {deltaText(metric.delta)}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
      {row.baseline.costEstimated || tool.metrics.costEstimated ? (
        <p className="mt-2 font-mono text-[10px] text-neutral-500">
          ~ cost estimated from tokens at API list prices (Codex reports no
          cost)
        </p>
      ) : null}
      {tool.setupMs !== undefined ? (
        <p className="mt-2 font-mono text-[10px] text-neutral-500">
          index setup: {TtscWebsiteBenchmarkGraphData.fmtSecs(tool.setupMs)}
        </p>
      ) : null}
    </div>
  );
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-neutral-500">
      <LegendDot fill="#6f7787" label="baseline" />
      <LegendDot
        fill={TtscWebsiteBenchmarkGraphUi.ACCENT}
        label="@ttsc/graph"
      />
      <LegendDot
        fill={TtscWebsiteBenchmarkGraphUi.CODEGRAPH_TEXT}
        label="codegraph"
      />
      <LegendDot
        fill={TtscWebsiteBenchmarkGraphUi.CODEBASE_MEMORY_TEXT}
        label="codebase-memory"
      />
      <LegendDot
        fill={TtscWebsiteBenchmarkGraphUi.SERENA_TEXT}
        label="serena"
      />
      <span className="text-neutral-400">lower is better</span>
      <span className="text-neutral-600">
        bars show token usage; right labels show tokens and baseline reduction
      </span>
      <span className="text-neutral-600">
        crown marks the lowest-token series
      </span>
    </div>
  );
}

export default function TtscWebsiteBenchmarkGraphChart({
  eyebrow,
  title,
  description,
  rows,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows: ReductionRow[];
  aside?: string;
}) {
  const {
    ttscAverage,
    codegraphAverage,
    codebaseMemoryAverage,
    serenaAverage,
    domain,
    ticks,
  } = useMemo(() => {
    const d = tokenDomain(rows);
    return {
      ttscAverage: averageReduction(rows, "ttsc"),
      codegraphAverage: averageReduction(rows, "codegraph"),
      codebaseMemoryAverage: averageReduction(rows, "codebaseMemory"),
      serenaAverage: averageReduction(rows, "serena"),
      domain: d,
      ticks: tokenTicks(d),
    };
  }, [rows]);

  return (
    <section
      className={`${TtscWebsiteBenchmarkGraphUi.panelClass} overflow-visible`}
    >
      <TtscWebsiteBenchmarkGraphUi.SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        aside={aside}
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChartLegend />
          <div className="flex flex-wrap gap-2 font-mono text-[10px] tabular-nums">
            {ttscAverage !== null ? (
              <span className="rounded-full border border-[#1f3e46] bg-[#0d1a1d] px-2 py-1 text-[#36e2ee]">
                @ttsc/graph avg {reductionLabel(ttscAverage)}
              </span>
            ) : null}
            {codegraphAverage !== null ? (
              <span className="rounded-full border border-[#49351a] bg-[#1b140b] px-2 py-1 text-[#f5b042]">
                codegraph avg {reductionLabel(codegraphAverage)}
              </span>
            ) : null}
            {codebaseMemoryAverage !== null ? (
              <span className="rounded-full border border-[#2f4b28] bg-[#111a10] px-2 py-1 text-[#8bdc65]">
                codebase-memory avg {reductionLabel(codebaseMemoryAverage)}
              </span>
            ) : null}
            {serenaAverage !== null ? (
              <span className="rounded-full border border-[#553066] bg-[#1a0f21] px-2 py-1 text-[#e879f9]">
                serena avg {reductionLabel(serenaAverage)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-[9rem_1fr] items-center gap-3 border-y border-[#1a1f29] py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600 sm:grid-cols-[12rem_1fr]">
          <span>case</span>
          <div className="relative h-4">
            <span className="sr-only">token usage scale</span>
            {ticks.map((tick) => {
              const position = tokenPosition(tick, domain);
              return (
                <span
                  key={tick}
                  className={`absolute top-0 ${
                    position <= 1
                      ? "text-left"
                      : position >= 99
                        ? "-translate-x-full text-right"
                        : "-translate-x-1/2 text-center"
                  }`}
                  style={{ left: `${position}%` }}
                >
                  {fmtTokenShort(tick)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((row) => {
            const bestSeries = lowestTokenSeries(row);
            const baselineBest = bestSeries === "baseline";
            return (
              <div
                key={row.id}
                className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-neutral-100">
                    {row.label}
                  </p>
                  {row.meta ? (
                    <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-500">
                      {row.meta}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-[5.75rem_minmax(0,1fr)_7.5rem] items-center gap-2">
                    <span
                      className={`inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] ${
                        baselineBest
                          ? "font-semibold text-neutral-100"
                          : "text-neutral-500"
                      }`}
                    >
                      <CrownMark active={baselineBest} />
                      <span className="truncate">baseline</span>
                    </span>
                    <div
                      className={`relative h-3.5 overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ${
                        baselineBest
                          ? "shadow-[0_0_14px_rgba(54,226,238,0.16)] ring-[#d7f9ff]/70"
                          : "ring-white/[0.04]"
                      }`}
                    >
                      <div
                        className="absolute top-0 h-full rounded-full bg-[#6f7787]"
                        style={tokenBarStyle(row.baseline.tokens, domain)}
                      />
                    </div>
                    <span
                      className={`text-right font-mono text-[10px] leading-tight tabular-nums ${
                        baselineBest ? "text-neutral-50" : "text-neutral-300"
                      }`}
                    >
                      <span className="block">
                        {tokenUsageText(row.baseline.tokens)}
                      </span>
                      <span
                        className={`block ${
                          baselineBest ? "text-[#36e2ee]" : "text-neutral-600"
                        }`}
                      >
                        baseline
                      </span>
                    </span>
                  </div>
                  {row.tools.map((tool) => {
                    const reduction = toolReduction(row, tool);
                    const missing = !tool.metrics;
                    const best = bestSeries === tool.key;
                    return (
                      <div
                        key={tool.key}
                        className="group relative grid grid-cols-[5.75rem_minmax(0,1fr)_7.5rem] items-center gap-2"
                      >
                        <span
                          className={`inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] ${
                            best ? "font-semibold" : ""
                          }`}
                          style={{ color: tool.textColor }}
                        >
                          <CrownMark active={best} />
                          <span className="truncate">{tool.label}</span>
                        </span>
                        <div
                          className={`relative h-3.5 overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ${
                            best
                              ? "shadow-[0_0_14px_rgba(54,226,238,0.16)] ring-[#d7f9ff]/70"
                              : "ring-white/[0.04]"
                          }`}
                        >
                          <div
                            className={`absolute top-0 h-full rounded-full ${
                              missing ? "opacity-25" : ""
                            }`}
                            style={{
                              ...tokenBarStyle(
                                tool.metrics?.tokens ?? null,
                                domain,
                              ),
                              background: missing ? "#303644" : tool.fill,
                            }}
                          />
                        </div>
                        <span
                          className={`text-right font-mono text-[10px] leading-tight tabular-nums ${
                            best
                              ? "text-neutral-50"
                              : reduction !== null && reduction < 0
                                ? "text-rose-400"
                                : "text-neutral-300"
                          }`}
                        >
                          <span className="block">
                            {tool.metrics
                              ? tokenUsageText(tool.metrics.tokens)
                              : "n/a"}
                          </span>
                          <span
                            className={`block ${
                              best ? "text-[#36e2ee]" : "text-neutral-500"
                            }`}
                          >
                            {tool.metrics
                              ? reductionText(reduction)
                              : "no data"}
                          </span>
                        </span>
                        <ReductionTooltip row={row} tool={tool} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
