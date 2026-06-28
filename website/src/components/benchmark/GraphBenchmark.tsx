"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentSample {
  tokens: number;
  tools: number;
  ok?: boolean;
  durMs?: number;
  [key: string]: unknown;
}

interface AgentCell {
  harness: string;
  repo: string;
  model: string;
  modelVersion?: string;
  effort?: string;
  promptId?: string;
  promptFamily?: string;
  fixtureBranch?: string;
  daemon?: boolean;
  toolSetupMs?: number;
  runs?: number;
  tool?: string;
  question?: string;
  samples: {
    baseline: AgentSample[];
    graph: AgentSample[];
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

/**
 * Map a harness-qualified, version-agnostic `model` to a "Harness / Model"
 * display string. The harness is the AI coding agent (Claude Code vs Codex);
 * the model tier comes from `model` and its version from `modelVersion`. The
 * version falls back to a sensible default when `modelVersion` is missing on
 * old data, and an unrecognized model falls back to `model (harness)`.
 */
function modelLabel(cell: AgentCell): string {
  const version = cell.modelVersion;
  switch (cell.model) {
    case "claude-code-sonnet":
      return `Claude Code / Sonnet ${version ?? "4.6"}`;
    case "claude-code-opus":
      return `Claude Code / Opus ${version ?? "4.8"}`;
    case "codex-gpt":
      return `Codex / ${gptVersionLabel(version) ?? "GPT-5.5"}`;
    case "codex-gpt-mini":
      return `Codex / ${gptVersionLabel(version) ?? "GPT-5.4 mini"}`;
    default:
      return `${cell.model} (${cell.harness})`;
  }
}

/**
 * Turn a Codex model id (e.g. "gpt-5.5", "gpt-5.4-mini") into a display label
 * ("GPT-5.5", "GPT-5.4 mini"). Returns undefined when there is no version.
 */
function gptVersionLabel(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.replace(/^gpt-/i, "GPT-").replace(/-mini$/i, " mini");
}

function repoLabel(repo: string): string {
  switch (repo) {
    case "vscode":
      return "VS Code";
    case "rxjs":
      return "RxJS";
    case "typeorm":
      return "TypeORM";
    case "nestjs":
      return "NestJS";
    case "excalidraw":
      return "Excalidraw";
    case "vue":
      return "Vue";
    case "zod":
      return "Zod";
    default:
      return repo;
  }
}

function promptFamilyLabel(promptFamily: string): string {
  switch (promptFamily) {
    case "common":
    case "shared-onboarding":
      return "Shared onboarding";
    case "dedicated":
    case "project-specific":
      return "Project prompt";
    case "overview":
      return "Overview";
    case "custom":
      return "Custom prompt";
    default:
      return promptFamily;
  }
}

const TOOL_TTSC = "ttsc-graph";
const TOOL_CODEGRAPH = "codegraph";
const TOOL_CODEBASE_MEMORY = "codebase-memory";
const TOOL_BASELINE = "baseline";

function cellTool(cell: AgentCell): string {
  return cell.tool ?? TOOL_TTSC;
}

/**
 * Display order for the model rows inside a project tab: Claude Code first,
 * then Codex; within each harness the larger model first. Unknown models sort
 * last.
 */
function modelOrder(model: string): number {
  const order = [
    "claude-code-opus",
    "claude-code-sonnet",
    "codex-gpt",
    "codex-gpt-mini",
  ];
  const index = order.indexOf(model);
  return index === -1 ? order.length : index;
}

/** Stable group-by that preserves first-appearance order of the keys. */
function groupBy<T>(
  items: T[],
  key: (item: T) => string,
): { key: string; items: T[] }[] {
  const out: { key: string; items: T[] }[] = [];
  const index = new Map<string, { key: string; items: T[] }>();
  for (const item of items) {
    const k = key(item);
    let bucket = index.get(k);
    if (!bucket) {
      bucket = { key: k, items: [] };
      index.set(k, bucket);
      out.push(bucket);
    }
    bucket.items.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grouped model: one comparable model cell against baseline / graph tools
// ---------------------------------------------------------------------------

interface Metrics {
  tokens: number;
  tools: number;
  dur: number;
}

interface ModelGroup {
  id: string;
  model: string;
  label: string;
  harness: string;
  effort?: string;
  fixtureBranch?: string;
  daemon: boolean;
  runs?: number;
  codegraphSetupMs?: number;
  codebaseMemorySetupMs?: number;
  baseline: Metrics;
  ttsc?: Metrics;
  codegraph?: Metrics;
  codebaseMemory?: Metrics;
}

interface ProjectGroup {
  id: string;
  repo: string;
  promptId?: string;
  promptFamily: string;
  question?: string;
  models: ModelGroup[];
}

interface PromptModeGroup {
  id: string;
  promptFamily: string;
  projects: ProjectGroup[];
}

function medianMetrics(samples: AgentSample[]): Metrics {
  const valid = validSamples(samples);
  return {
    tokens: median(valid.map((s) => s.tokens)),
    tools: median(valid.map((s) => s.tools)),
    dur: median(valid.map((s) => s.durMs ?? 0)),
  };
}

function validSamples(samples: AgentSample[]): AgentSample[] {
  return samples.filter((sample) => sample.ok !== false);
}

function modelGroupKey(cell: AgentCell): string {
  return [
    cell.harness,
    cell.model,
    cell.modelVersion ?? "",
    cell.effort ?? "",
    cell.fixtureBranch ?? "",
    cell.daemon === true ? "daemon" : "oneshot",
  ].join("\0");
}

function projectGroupKey(cell: AgentCell): string {
  return [
    cell.promptId ?? "",
    cell.promptFamily ?? "project-specific",
    cell.repo,
  ].join("\0");
}

function promptModeKey(promptFamily: string): string {
  switch (promptFamily) {
    case "dedicated":
    case "project-specific":
      return "dedicated";
    case "common":
    case "shared-onboarding":
      return "common";
    default:
      return promptFamily;
  }
}

function promptModeOrder(mode: PromptModeGroup): number {
  const order = ["dedicated", "common", "overview", "custom"];
  const index = order.indexOf(mode.id);
  return index === -1 ? order.length : index;
}

function buildPromptModeGroups(projects: ProjectGroup[]): PromptModeGroup[] {
  return groupBy(projects, (project) => promptModeKey(project.promptFamily))
    .map(
      ({ key, items }): PromptModeGroup => ({
        id: key,
        promptFamily: items[0]?.promptFamily ?? key,
        projects: items,
      }),
    )
    .sort(
      (a, b) =>
        promptModeOrder(a) - promptModeOrder(b) ||
        promptFamilyLabel(a.promptFamily).localeCompare(
          promptFamilyLabel(b.promptFamily),
        ),
    );
}

/**
 * Reshape the flat cell list into project -> model groups. Each model row
 * carries one empty-MCP baseline for the same harness/model
 * version/effort/fixture mode in this repo, plus graph-tool medians when those
 * cells exist. Dedicated baseline cells win; older combined A/B cells remain
 * readable through their embedded baseline samples.
 */
function buildProjectGroups(cells: AgentCell[]): ProjectGroup[] {
  return groupBy(cells, projectGroupKey).map(({ key, items: repoCells }) => {
    const [promptId = "", promptFamily = "project-specific", repo = ""] =
      key.split("\0");
    const models = groupBy(repoCells, modelGroupKey)
      .map(({ key: modelKey, items: modelCells }): ModelGroup => {
        const ttscCell = modelCells.find((c) => cellTool(c) === TOOL_TTSC);
        const codegraphCell = modelCells.find(
          (c) => cellTool(c) === TOOL_CODEGRAPH,
        );
        const codebaseMemoryCell = modelCells.find(
          (c) => cellTool(c) === TOOL_CODEBASE_MEMORY,
        );
        const baselineCells = modelCells.filter(
          (c) => cellTool(c) === TOOL_BASELINE,
        );
        const baselineCell = baselineCells[0];
        const dedicatedBaselineSamples = baselineCells.flatMap(
          (c) => c.samples.baseline,
        );
        const embeddedBaselineSamples = modelCells
          .filter((c) => cellTool(c) !== TOOL_BASELINE)
          .flatMap((c) => c.samples.baseline);
        const baselineSamples =
          dedicatedBaselineSamples.length > 0
            ? dedicatedBaselineSamples
            : embeddedBaselineSamples;
        const head = modelCells[0]!;
        return {
          id: modelKey,
          model: head.model,
          label: modelLabel(head),
          harness: head.harness,
          effort: head.effort,
          fixtureBranch: head.fixtureBranch,
          daemon: head.daemon === true,
          runs:
            ttscCell?.runs ??
            codegraphCell?.runs ??
            codebaseMemoryCell?.runs ??
            baselineCell?.runs,
          codegraphSetupMs: codegraphCell?.toolSetupMs,
          codebaseMemorySetupMs: codebaseMemoryCell?.toolSetupMs,
          baseline: medianMetrics(baselineSamples),
          ttsc:
            ttscCell && validSamples(ttscCell.samples.graph).length > 0
              ? medianMetrics(ttscCell.samples.graph)
              : undefined,
          codegraph:
            codegraphCell &&
            validSamples(codegraphCell.samples.graph).length > 0
              ? medianMetrics(codegraphCell.samples.graph)
              : undefined,
          codebaseMemory:
            codebaseMemoryCell &&
            validSamples(codebaseMemoryCell.samples.graph).length > 0
              ? medianMetrics(codebaseMemoryCell.samples.graph)
              : undefined,
        };
      })
      .sort(
        (a, b) =>
          modelOrder(a.model) - modelOrder(b.model) ||
          a.label.localeCompare(b.label) ||
          a.id.localeCompare(b.id),
      );
    const question = repoCells.find((c) => c.question)?.question;
    return {
      id: key,
      repo,
      promptId: promptId || undefined,
      promptFamily,
      question,
      models,
    };
  });
}

// ---------------------------------------------------------------------------
// Shared style tokens (harmonized with BenchmarkDashboard + landing movies)
// ---------------------------------------------------------------------------

const ACCENT = "#36e2ee";

const TTSC_FILL = `linear-gradient(90deg, ${ACCENT}, #19b6c9)`;
const CODEGRAPH_FILL = "linear-gradient(90deg, #f5b042, #d97706)";
const CODEGRAPH_TEXT = "#f5b042";
const CODEBASE_MEMORY_FILL = "linear-gradient(90deg, #8bdc65, #3f9f4a)";
const CODEBASE_MEMORY_TEXT = "#8bdc65";

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

function modelTabMeta(model: ModelGroup): string | undefined {
  const parts: string[] = [];
  if (model.effort) parts.push(model.effort);
  parts.push(model.daemon ? "daemon" : "one-shot");
  return parts.join(" / ");
}

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

// ---------------------------------------------------------------------------
// Token reduction charts
// ---------------------------------------------------------------------------

type ToolKey = "ttsc" | "codegraph" | "codebaseMemory";

interface ReductionTool {
  key: ToolKey;
  label: string;
  metrics?: Metrics;
  setupMs?: number;
  fill: string;
  textColor: string;
}

interface ReductionRow {
  id: string;
  label: string;
  meta?: string;
  baseline: Metrics;
  tools: ReductionTool[];
}

function toolReduction(row: ReductionRow, tool: ReductionTool): number | null {
  if (!tool.metrics) return null;
  return pctSaved(row.baseline.tokens, tool.metrics.tokens);
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

interface ReductionDomain {
  min: number;
  max: number;
}

const REDUCTION_DOMAIN: ReductionDomain = { min: -5, max: 100 };

function reductionPosition(value: number, domain: ReductionDomain): number {
  const range = domain.max - domain.min;
  if (range <= 0) return 0;
  return Math.max(0, Math.min(100, ((value - domain.min) / range) * 100));
}

function reductionBarStyle(
  reduction: number | null,
  domain: ReductionDomain,
): { width: string } {
  if (reduction === null) return { width: "0%" };
  const value = reductionPosition(reduction, domain);
  return { width: `${Math.max(2, value)}%` };
}

function reductionTicks(domain: ReductionDomain): number[] {
  return [...new Set([domain.min, 0, 50, 100])]
    .filter((tick) => tick >= domain.min && tick <= domain.max)
    .sort((a, b) => a - b);
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
    <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-72 rounded-md border border-[#2a313e] bg-[#090b10] p-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.45)] group-hover:block">
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

      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px]">
        <div className="rounded border border-[#1c2230] bg-[#0e1117] p-2">
          <p className="uppercase tracking-[0.12em] text-neutral-600">
            baseline
          </p>
          <p className="mt-1 tabular-nums text-neutral-200">
            {fmt(Math.round(row.baseline.tokens))}
          </p>
        </div>
        <div className="rounded border border-[#1c2230] bg-[#0e1117] p-2">
          <p className="uppercase tracking-[0.12em] text-neutral-600">tool</p>
          <p className="mt-1 tabular-nums text-neutral-200">
            {fmt(Math.round(tool.metrics.tokens))}
          </p>
        </div>
        <div className="rounded border border-[#1c2230] bg-[#0e1117] p-2">
          <p className="uppercase tracking-[0.12em] text-neutral-600">calls</p>
          <p className="mt-1 tabular-nums text-neutral-200">
            {fmt(Math.round(tool.metrics.tools))}
          </p>
        </div>
        <div className="rounded border border-[#1c2230] bg-[#0e1117] p-2">
          <p className="uppercase tracking-[0.12em] text-neutral-600">time</p>
          <p className="mt-1 tabular-nums text-neutral-200">
            {fmtSecs(tool.metrics.dur)}
          </p>
        </div>
      </div>
      {tool.setupMs !== undefined ? (
        <p className="mt-2 font-mono text-[10px] text-neutral-500">
          index setup: {fmtSecs(tool.setupMs)}
        </p>
      ) : null}
    </div>
  );
}

function reductionTools(model: ModelGroup): ReductionTool[] {
  return [
    {
      key: "ttsc",
      label: "@ttsc/graph",
      metrics: model.ttsc,
      fill: TTSC_FILL,
      textColor: ACCENT,
    },
    {
      key: "codegraph",
      label: "codegraph",
      metrics: model.codegraph,
      setupMs: model.codegraphSetupMs,
      fill: CODEGRAPH_FILL,
      textColor: CODEGRAPH_TEXT,
    },
    {
      key: "codebaseMemory",
      label: "codebase-memory",
      metrics: model.codebaseMemory,
      setupMs: model.codebaseMemorySetupMs,
      fill: CODEBASE_MEMORY_FILL,
      textColor: CODEBASE_MEMORY_TEXT,
    },
  ];
}

function ChartLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-neutral-500">
      <LegendDot fill="#6f7787" label="baseline" />
      <LegendDot fill={ACCENT} label="@ttsc/graph" />
      <LegendDot fill={CODEGRAPH_TEXT} label="codegraph" />
      <LegendDot fill={CODEBASE_MEMORY_TEXT} label="codebase-memory" />
      <span className="text-neutral-600">
        bars show token reduction vs empty-MCP baseline; baseline is 0%
      </span>
    </div>
  );
}

function ReductionChart({
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
  const ttscAverage = averageReduction(rows, "ttsc");
  const codegraphAverage = averageReduction(rows, "codegraph");
  const codebaseMemoryAverage = averageReduction(rows, "codebaseMemory");
  const domain = REDUCTION_DOMAIN;
  const ticks = reductionTicks(domain);
  const zeroPosition = reductionPosition(0, domain);

  return (
    <section className={`${panelClass} overflow-visible`}>
      <SectionHeader
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
          </div>
        </div>

        <div className="grid grid-cols-[9rem_1fr] items-center gap-3 border-y border-[#1a1f29] py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600 sm:grid-cols-[12rem_1fr]">
          <span>case</span>
          <div className="relative h-4">
            <span
              className="absolute inset-y-0 w-px bg-[#364153]"
              style={{ left: `${zeroPosition}%` }}
            />
            {ticks.map((tick) => {
              const position = reductionPosition(tick, domain);
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
                  {tick}%
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((row) => (
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
                <div className="grid grid-cols-[5.75rem_minmax(0,1fr)_3.25rem] items-center gap-2">
                  <span className="truncate font-mono text-[10px] text-neutral-500">
                    baseline
                  </span>
                  <div className="relative h-3.5 overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ring-white/[0.04]">
                    <div
                      className="absolute top-0 h-full rounded-full bg-[#6f7787]"
                      style={reductionBarStyle(0, domain)}
                    />
                    <span
                      className="absolute inset-y-0 z-10 w-px bg-white/25"
                      style={{ left: `${zeroPosition}%` }}
                    />
                  </div>
                  <span className="text-right font-mono text-[10px] tabular-nums text-neutral-300">
                    0%
                  </span>
                </div>
                {row.tools.map((tool) => {
                  const reduction = toolReduction(row, tool);
                  const missing = !tool.metrics;
                  return (
                    <div
                      key={tool.key}
                      className="group relative grid grid-cols-[5.75rem_minmax(0,1fr)_3.25rem] items-center gap-2"
                    >
                      <span
                        className="truncate font-mono text-[10px]"
                        style={{ color: tool.textColor }}
                      >
                        {tool.label}
                      </span>
                      <div className="relative h-3.5 overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ring-white/[0.04]">
                        <div
                          className={`absolute top-0 h-full rounded-full ${
                            missing ? "opacity-25" : ""
                          }`}
                          style={{
                            ...reductionBarStyle(reduction, domain),
                            background: missing ? "#303644" : tool.fill,
                          }}
                        />
                        <span
                          className="absolute inset-y-0 z-10 w-px bg-white/25"
                          style={{ left: `${zeroPosition}%` }}
                        />
                      </div>
                      <span
                        className={`text-right font-mono text-[10px] tabular-nums ${
                          reduction !== null && reduction < 0
                            ? "text-rose-400"
                            : "text-neutral-300"
                        }`}
                      >
                        {reductionLabel(reduction)}
                      </span>
                      <ReductionTooltip row={row} tool={tool} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function commonRowsForModel(
  mode: PromptModeGroup,
  modelId: string,
): ReductionRow[] {
  const rows: ReductionRow[] = [];
  for (const project of mode.projects) {
    const model = project.models.find((candidate) => candidate.id === modelId);
    if (!model) continue;
    rows.push({
      id: project.id,
      label: repoLabel(project.repo),
      baseline: model.baseline,
      tools: reductionTools(model),
    });
  }
  return rows;
}

interface ReductionTab {
  id: string;
  label: string;
  meta?: string;
}

function ReductionTabs({
  label,
  items,
  active,
  onSelect,
}: {
  label: string;
  items: ReductionTab[];
  active: string;
  onSelect: (id: string) => void;
}) {
  if (items.length <= 1) return null;
  return (
    <div className="grid gap-2 rounded-lg border border-[#222834] bg-[#0c0e13] p-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>
      <nav className="flex min-w-0 gap-1 overflow-x-auto">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              className={`shrink-0 rounded-md px-3 py-1.5 text-left text-[12px] font-medium transition-colors ${
                selected
                  ? "bg-[#1b212c] text-neutral-50 shadow-sm"
                  : "text-neutral-400 hover:bg-[#13171f] hover:text-neutral-100"
              }`}
              onClick={() => onSelect(item.id)}
            >
              <span className="block max-w-[13rem] truncate">{item.label}</span>
              {item.meta ? (
                <span className="mt-0.5 block font-mono text-[10px] text-neutral-500">
                  {item.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function CommonReductionSection({
  mode,
  modelFilter,
}: {
  mode: PromptModeGroup;
  modelFilter?: (model: ModelGroup) => boolean;
}) {
  const models = groupBy(
    mode.projects.flatMap((project) => project.models),
    (model) => model.id,
  )
    .map(({ items }) => items[0]!)
    .filter((model) => (modelFilter ? modelFilter(model) : true))
    .sort(
      (a, b) =>
        modelOrder(a.model) - modelOrder(b.model) ||
        a.label.localeCompare(b.label),
    );

  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const activeModel =
    (activeModelId
      ? models.find((model) => model.id === activeModelId)
      : undefined) ?? models[0];
  const activeRows = activeModel
    ? commonRowsForModel(mode, activeModel.id)
    : [];

  return (
    <section className="space-y-3">
      <div className="px-1">
        <Eyebrow label="Shared onboarding" />
        <h2 className="mt-2 text-[19px] font-semibold tracking-tight text-neutral-50">
          Common prompt by model
        </h2>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-neutral-400">
          Each model keeps the same onboarding question and plots every project
          in one token-reduction chart.
        </p>
      </div>
      <ReductionTabs
        label="Model"
        items={models.map((model) => ({
          id: model.id,
          label: model.label,
          ...(modelTabMeta(model) ? { meta: modelTabMeta(model) } : {}),
        }))}
        active={activeModel?.id ?? ""}
        onSelect={setActiveModelId}
      />
      {activeModel ? (
        <ReductionChart
          eyebrow="Common prompt"
          title={activeModel.label}
          description="All projects use the same repository-onboarding request."
          rows={activeRows}
          aside={modelTabMeta(activeModel)}
        />
      ) : null}
    </section>
  );
}

function DedicatedReductionSection({ mode }: { mode: PromptModeGroup }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProject =
    (activeProjectId
      ? mode.projects.find((project) => project.id === activeProjectId)
      : undefined) ?? mode.projects[0];

  return (
    <section className="space-y-3">
      <div className="px-1">
        <Eyebrow label="Project prompts" />
        <h2 className="mt-2 text-[19px] font-semibold tracking-tight text-neutral-50">
          Dedicated prompts by project
        </h2>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-neutral-400">
          Each project keeps its mechanism-specific request and plots every
          measured model in one token-reduction chart.
        </p>
      </div>
      <ReductionTabs
        label="Project"
        items={mode.projects.map((project) => ({
          id: project.id,
          label: repoLabel(project.repo),
        }))}
        active={activeProject?.id ?? ""}
        onSelect={setActiveProjectId}
      />
      {activeProject ? (
        <ReductionChart
          eyebrow="Dedicated prompt"
          title={repoLabel(activeProject.repo)}
          description={
            activeProject.question ?? "Project-specific mechanism request."
          }
          rows={activeProject.models.map((model) => ({
            id: model.id,
            label: model.label,
            ...(modelTabMeta(model) ? { meta: modelTabMeta(model) } : {}),
            baseline: model.baseline,
            tools: reductionTools(model),
          }))}
          aside={`${activeProject.models.length} model${
            activeProject.models.length === 1 ? "" : "s"
          }`}
        />
      ) : null}
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

  const groups = buildProjectGroups(report.agent?.cells ?? []);
  const modes = buildPromptModeGroups(groups);
  const commonMode = modes.find((mode) => mode.id === "common");
  const dedicatedMode = modes.find((mode) => mode.id === "dedicated");

  // The landing summary keeps the shared onboarding comparison only. The full
  // page follows with dedicated project prompts and structural coverage.
  if (variant === "summary") {
    return (
      <div className="not-prose my-6 space-y-5">
        {commonMode ? (
          <CommonReductionSection
            mode={commonMode}
            modelFilter={(model) => model.model === "codex-gpt-mini"}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="not-prose my-6 space-y-5">
      {commonMode ? <CommonReductionSection mode={commonMode} /> : null}
      {dedicatedMode ? (
        <DedicatedReductionSection mode={dedicatedMode} />
      ) : null}
      {report.structural ? (
        <StructuralSection data={report.structural} />
      ) : null}
    </div>
  );
}
