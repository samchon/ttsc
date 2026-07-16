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

function CrownMark({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-3 w-3 shrink-0 items-center justify-center ${
        active ? "text-[#3178c6]" : "text-transparent"
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

function reductionText(reduction: number | null): string {
  if (reduction === null) return "No data";
  return reduction >= 0 ? `${reduction}% saved` : `${-reduction}% over`;
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
      <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-lg border border-[#b9d5ee] bg-white p-3 text-left shadow-[0_18px_45px_rgba(49,120,198,0.18)] group-hover:block">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {row.label} / {tool.label}
        </p>
        <p className="mt-2 text-[12px] font-medium text-slate-700">
          No published measurement.
        </p>
      </div>
    );

  return (
    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-80 rounded-lg border border-[#b9d5ee] bg-white p-3 text-left shadow-[0_18px_45px_rgba(49,120,198,0.18)] group-hover:block">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${tool.textColor}99, transparent)`,
        }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {row.label}
          </p>
          <p className="mt-1 text-[12px] font-semibold text-slate-800">
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

      <div className="mt-3 rounded border border-[#d2e4f4] bg-[#f7fbff] p-2 font-mono text-[10px]">
        <div className="grid grid-cols-[3.25rem_1fr_1fr] gap-x-2 uppercase tracking-[0.12em] text-slate-400">
          <span />
          <span className="text-right">baseline</span>
          <span className="text-right">tool</span>
        </div>
        {tooltipMetricRows(row.baseline, tool.metrics).map((metric) => (
          <div
            key={metric.label}
            className="mt-1 grid grid-cols-[3.25rem_1fr_1fr] items-baseline gap-x-2"
          >
            <span className="uppercase tracking-[0.12em] text-slate-400">
              {metric.label}
            </span>
            <span className="text-right tabular-nums text-slate-500">
              {metric.base}
            </span>
            <span className="text-right tabular-nums text-slate-700">
              {metric.value}
              {deltaText(metric.delta) ? (
                <span
                  className={`ml-1 ${
                    metric.delta !== null && metric.delta > 0
                      ? "text-rose-400"
                      : "text-[#3178c6]"
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
        <p className="mt-2 font-mono text-[10px] text-slate-500">
          ~ cost estimated from tokens at API list prices (Codex reports no
          cost)
        </p>
      ) : null}
      {tool.setupMs !== undefined ? (
        <p className="mt-2 font-mono text-[10px] text-slate-500">
          index setup: {TtscWebsiteBenchmarkGraphData.fmtSecs(tool.setupMs)}
        </p>
      ) : null}
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
  const { domain } = useMemo(() => ({ domain: tokenDomain(rows) }), [rows]);

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
      <p className="border-b border-[#c7dff4] px-5 py-2.5 font-mono text-[11px] text-slate-500">
        lower is better
      </p>
      <div className="space-y-1.5 px-3 py-3">
        {rows.map((row, index) => {
          const bestSeries = lowestTokenSeries(row);
          const baselineBest = bestSeries === "baseline";
          return (
            <div
              key={row.id}
              className="space-y-1 rounded-lg px-3.5 py-2.5"
              style={{
                // Alternating bands so each case reads as a block, matching the
                // Time-to-answer chart.
                backgroundColor:
                  index % 2 === 0
                    ? "rgba(232,242,251,0.72)"
                    : "rgba(247,251,255,0.72)",
              }}
            >
              <div className="flex items-baseline justify-between gap-3 pb-0.5">
                <span className="truncate text-[13px] font-semibold text-slate-800">
                  {row.label}
                </span>
                {row.meta ? (
                  <span className="shrink-0 font-mono text-[11px] text-slate-500">
                    {row.meta}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex w-32 shrink-0 items-center gap-1 truncate font-mono text-[11px] ${
                    baselineBest
                      ? "font-semibold text-slate-800"
                      : "text-slate-500"
                  }`}
                >
                  <CrownMark active={baselineBest} />
                  <span className="truncate">baseline</span>
                </span>
                <div
                  className={`relative h-3.5 flex-1 overflow-hidden rounded-full bg-[#e7f0f8] ring-1 ring-inset ${
                    baselineBest
                      ? "shadow-[0_0_14px_rgba(49,120,198,0.18)] ring-[#72afe6]/70"
                      : "ring-[#c7dff4]"
                  }`}
                >
                  <div
                    className="absolute top-0 h-full rounded-full bg-[#94a3b8]"
                    style={tokenBarStyle(row.baseline.tokens, domain)}
                  />
                </div>
                <span
                  className={`w-24 shrink-0 whitespace-nowrap text-right font-mono text-[11px] tabular-nums ${
                    baselineBest ? "text-[#102a43]" : "text-slate-700"
                  }`}
                >
                  {tokenUsageText(row.baseline.tokens)}
                </span>
              </div>

              {row.tools.map((tool) => {
                const reduction = toolReduction(row, tool);
                const missing = !tool.metrics;
                const best = bestSeries === tool.key;
                return (
                  <div
                    key={tool.key}
                    className="group relative flex items-center gap-2.5"
                  >
                    <span
                      className={`inline-flex w-32 shrink-0 items-center gap-1 truncate font-mono text-[11px] ${
                        best ? "font-semibold" : ""
                      }`}
                      style={{ color: tool.textColor }}
                    >
                      <CrownMark active={best} />
                      <span className="truncate">{tool.label}</span>
                    </span>
                    <div
                      className={`relative h-3.5 flex-1 overflow-hidden rounded-full bg-[#e7f0f8] ring-1 ring-inset ${
                        best
                          ? "shadow-[0_0_14px_rgba(49,120,198,0.18)] ring-[#72afe6]/70"
                          : "ring-[#c7dff4]"
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
                          background: missing ? "#d3e0ec" : tool.fill,
                        }}
                      />
                    </div>
                    <span
                      className={`w-24 shrink-0 whitespace-nowrap text-right font-mono text-[11px] font-medium tabular-nums ${
                        best
                          ? "text-[#3178c6]"
                          : reduction !== null && reduction < 0
                            ? "text-rose-400"
                            : "text-slate-600"
                      }`}
                    >
                      {tool.metrics ? reductionText(reduction) : "no data"}
                    </span>
                    <ReductionTooltip row={row} tool={tool} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
