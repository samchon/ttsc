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

/**
 * Display name for an AI coding agent (the benchmark harness): Claude Code is
 * Anthropic's CLI, Codex is OpenAI's CLI. Unknown harnesses pass through.
 */
function harnessLabel(harness: string): string {
  switch (harness) {
    case "claude-code":
      return "Claude Code";
    case "codex":
      return "Codex";
    default:
      return harness;
  }
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
  reasoning: number;
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
  baseline: Metrics;
  ttsc?: Metrics;
  codegraph?: Metrics;
}

interface ProjectGroup {
  id: string;
  repo: string;
  promptId?: string;
  promptFamily: string;
  question?: string;
  models: ModelGroup[];
}

function medianMetrics(samples: AgentSample[]): Metrics {
  const valid = validSamples(samples);
  return {
    tokens: median(valid.map((s) => s.tokens)),
    reasoning: median(
      valid.map((s) => (typeof s.reasoning === "number" ? s.reasoning : 0)),
    ),
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

/**
 * Reshape the flat cell list into project -> model groups. Each model row
 * carries one empty-MCP baseline for the same harness/model
 * version/effort/fixture mode in this repo, plus the ttsc-graph and codegraph
 * graph medians when those cells exist. Dedicated baseline cells win; older
 * combined A/B cells remain readable through their embedded baseline samples.
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
          runs: ttscCell?.runs ?? codegraphCell?.runs ?? baselineCell?.runs,
          codegraphSetupMs: codegraphCell?.toolSetupMs,
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

const BASELINE_FILL = "#4b5563";
const TTSC_FILL = `linear-gradient(90deg, ${ACCENT}, #19b6c9)`;
const CODEGRAPH_FILL = "linear-gradient(90deg, #f5b042, #d97706)";
const CODEGRAPH_TEXT = "#f5b042";

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
// Agent cost: each metric is a grouped bar (baseline / ttsc-graph / codegraph)
// ---------------------------------------------------------------------------

interface BarSpec {
  key: string;
  label: string;
  mode?: string;
  value: number;
  fill: string;
  textColor: string;
  baseline?: boolean;
}

interface Metric {
  key: keyof Metrics;
  label: string;
  fmt: (n: number) => string;
}

const METRICS: Metric[] = [
  { key: "tokens", label: "tokens", fmt: (n) => fmt(Math.round(n)) },
  {
    key: "reasoning",
    label: "reasoning tokens",
    fmt: (n) => fmt(Math.round(n)),
  },
  {
    key: "tools",
    label: "tool calls",
    fmt: (n) => (n % 1 === 0 ? fmt(Math.round(n)) : n.toFixed(1)),
  },
  { key: "dur", label: "wall time", fmt: (n) => fmtSecs(n) },
];

/** One horizontal bar in a metric group, scaled against the group's max. */
function BarRow({
  bar,
  max,
  baseValue,
  raw,
}: {
  bar: BarSpec;
  max: number;
  baseValue: number;
  raw: string;
}) {
  const width = max > 0 ? Math.max(2, (bar.value / max) * 100) : 2;
  const saved = bar.baseline ? null : pctSaved(baseValue, bar.value);

  return (
    <div
      className="flex items-center gap-2.5"
      title={`${bar.label}${bar.mode ? ` ${bar.mode}` : ""}: ${raw}`}
    >
      <span
        className="w-32 shrink-0 truncate font-mono text-[10px]"
        style={{ color: bar.textColor }}
      >
        {bar.label}
        {bar.mode ? (
          <span className="text-neutral-500"> - {bar.mode}</span>
        ) : null}
      </span>
      <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-[#161b24] ring-1 ring-inset ring-white/[0.04]">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: bar.fill }}
        />
      </div>
      <span className="w-[4.75rem] shrink-0 text-right font-mono text-[10px] tabular-nums text-neutral-300">
        {raw}
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums">
        {saved === null ? (
          <span className="text-neutral-600">baseline</span>
        ) : saved >= 0 ? (
          <span style={{ color: ACCENT }}>{saved}%</span>
        ) : (
          <span className="text-rose-400">+{-saved}%</span>
        )}
      </span>
    </div>
  );
}

/** One metric (tokens / tool calls / wall time) as a group of bars. */
function MetricGroup({ metric, model }: { metric: Metric; model: ModelGroup }) {
  const baseValue = model.baseline[metric.key];
  const bars: BarSpec[] = [
    {
      key: "baseline",
      label: "baseline",
      value: baseValue,
      fill: BASELINE_FILL,
      textColor: "#9ca3af",
      baseline: true,
    },
  ];
  if (model.ttsc)
    bars.push({
      key: "ttsc",
      label: "@ttsc/graph",
      mode: "mcp",
      value: model.ttsc[metric.key],
      fill: TTSC_FILL,
      textColor: ACCENT,
    });
  if (model.codegraph)
    bars.push({
      key: "codegraph",
      label: "codegraph",
      mode: "mcp",
      value: model.codegraph[metric.key],
      fill: CODEGRAPH_FILL,
      textColor: CODEGRAPH_TEXT,
    });

  const max = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <div className="space-y-1.5 rounded-md border border-[#1c2230] bg-[#0e1117] px-3.5 py-3">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-neutral-300">
        {metric.label}
      </p>
      <div className="space-y-1.5">
        {bars.map((bar) => (
          <BarRow
            key={bar.key}
            bar={bar}
            max={max}
            baseValue={baseValue}
            raw={metric.fmt(bar.value)}
          />
        ))}
      </div>
    </div>
  );
}

function modelMeta(model: ModelGroup): string {
  const parts = [harnessLabel(model.harness)];
  if (model.effort) parts.push(`effort ${model.effort}`);
  if (model.fixtureBranch) parts.push(model.fixtureBranch);
  parts.push(model.daemon ? "daemon" : "one-shot");
  if (model.runs !== undefined)
    parts.push(`${model.runs} run${model.runs !== 1 ? "s" : ""}`);
  return parts.join(" - ");
}

/** One model row: its identity on the left, the metric groups on the right. */
function ModelBlock({ model }: { model: ModelGroup }) {
  const metrics = METRICS.filter(
    (metric) =>
      metric.key !== "reasoning" ||
      model.baseline.reasoning > 0 ||
      (model.ttsc?.reasoning ?? 0) > 0 ||
      (model.codegraph?.reasoning ?? 0) > 0,
  );

  return (
    <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] md:gap-6">
      <div className="md:border-r md:border-[#1a1f29] md:pr-6">
        <p className="text-[15px] font-semibold tracking-tight text-neutral-50">
          {model.label}
        </p>
        <p className="mt-1.5 font-mono text-[11px] text-neutral-500">
          {modelMeta(model)}
        </p>
        {model.codegraphSetupMs !== undefined ? (
          <p className="mt-1 font-mono text-[11px] text-neutral-500">
            codegraph index {fmtSecs(model.codegraphSetupMs)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2.5">
        {metrics.map((metric) => (
          <MetricGroup key={metric.key} metric={metric} model={model} />
        ))}
      </div>
    </div>
  );
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

function ProjectPanel({
  group,
  aside,
}: {
  group: ProjectGroup;
  aside?: string;
}) {
  const hasTtsc = group.models.some((model) => model.ttsc);
  const hasCodegraph = group.models.some((model) => model.codegraph);
  const hasComparator = hasTtsc || hasCodegraph;

  return (
    <section className={panelClass}>
      <SectionHeader
        eyebrow="Agent cost"
        title={repoLabel(group.repo)}
        description={
          group.question ??
          (hasComparator
            ? "Median tokens, tool calls and wall time per model, against the empty-MCP baseline. Each tool is shown as mcp (the server alone)."
            : "Median tokens, tool calls and wall time for the empty-MCP baseline. Graph comparator measurements have not been published for this slice yet.")
        }
        aside={aside}
      />

      <div className="divide-y divide-[#1a1f29]">
        {group.models.map((model) => (
          <ModelBlock key={model.id} model={model} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#1a1f29] px-5 py-3 font-mono text-[10px] text-neutral-500">
        <LegendDot fill={BASELINE_FILL} label="empty-MCP baseline" />
        {hasTtsc ? <LegendDot fill={ACCENT} label="@ttsc/graph" /> : null}
        {hasCodegraph ? (
          <LegendDot fill={CODEGRAPH_TEXT} label="codegraph" />
        ) : null}
        <span className="text-neutral-600">
          {hasComparator
            ? "mcp = server only; saved vs baseline; over baseline"
            : "comparator measurements pending"}
        </span>
      </div>
    </section>
  );
}

/** Project tab strip; mirrors the BenchmarkDashboard nav voice. */
function ProjectTabs({
  groups,
  active,
  onSelect,
}: {
  groups: ProjectGroup[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Graph benchmark projects"
      className="flex gap-1 overflow-x-auto rounded-lg border border-[#222834] bg-[#0c0e13] p-1"
    >
      {groups.map((group) => {
        const isActive = group.id === active;
        return (
          <button
            key={group.id}
            type="button"
            className={`shrink-0 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-[#1b212c] text-neutral-50 shadow-sm"
                : "text-neutral-400 hover:bg-[#13171f] hover:text-neutral-100"
            }`}
            onClick={() => onSelect(group.id)}
          >
            {repoLabel(group.repo)}
            <span className="ml-1 text-neutral-500">
              {promptFamilyLabel(group.promptFamily)}
            </span>
          </button>
        );
      })}
    </nav>
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

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

  // The landing summary shows only the hero project (vscode) without tabs,
  // matching the index prose; the full page tabs across every project.
  if (variant === "summary") {
    const hero =
      groups.find(
        (g) => g.repo === "vscode" && g.promptFamily === "dedicated",
      ) ??
      groups.find(
        (g) => g.repo === "vscode" && g.promptFamily === "project-specific",
      ) ??
      groups.find((g) => g.repo === "vscode") ??
      groups[0];
    return (
      <div className="not-prose my-6 space-y-5">
        {hero ? <ProjectPanel group={hero} /> : null}
      </div>
    );
  }

  // Default to the first project that carries a full comparison when one exists.
  const defaultGroup =
    groups.find((g) => g.models.some((m) => m.codegraph)) ??
    groups.find((g) => g.models.some((m) => m.ttsc)) ??
    groups[0];
  const active =
    activeGroupId && groups.some((g) => g.id === activeGroupId)
      ? activeGroupId
      : defaultGroup?.id;
  const activeGroup = groups.find((g) => g.id === active);

  return (
    <div className="not-prose my-6 space-y-5">
      {groups.length > 0 && active ? (
        <>
          <ProjectTabs
            groups={groups}
            active={active}
            onSelect={setActiveGroupId}
          />
          {activeGroup ? (
            <ProjectPanel
              group={activeGroup}
              aside={`${activeGroup.models.length} model${
                activeGroup.models.length !== 1 ? "s" : ""
              }`}
            />
          ) : null}
        </>
      ) : null}
      {report.structural ? (
        <StructuralSection data={report.structural} />
      ) : null}
    </div>
  );
}
