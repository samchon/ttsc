import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import pricing from "./TtscWebsiteBenchmarkGraphPricing.json";

type AgentCell = ITtscWebsiteBenchmarkGraph.AgentCell;
type AgentSample = ITtscWebsiteBenchmarkGraph.AgentSample;
type Metrics = ITtscWebsiteBenchmarkGraph.Metrics;
type ModelGroup = ITtscWebsiteBenchmarkGraph.ModelGroup;
type ProjectGroup = ITtscWebsiteBenchmarkGraph.ProjectGroup;
type PromptModeGroup = ITtscWebsiteBenchmarkGraph.PromptModeGroup;

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

function fmtCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
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
      return `Claude Code / Sonnet ${claudeVersionLabel(version, "4.6")}`;
    case "claude-code-opus":
      return `Claude Code / Opus ${claudeVersionLabel(version, "4.8")}`;
    case "claude-code-fable":
      return `Claude Code / Fable ${claudeVersionLabel(version, "5")}`;
    case "codex-gpt":
      return `Codex / ${gptVersionLabel(version) ?? "GPT-5.5"}`;
    case "codex-gpt-mini":
      return `Codex / ${gptVersionLabel(version) ?? "GPT-5.4 mini"}`;
    default:
      return `${cell.model} (${cell.harness})`;
  }
}

function claudeVersionLabel(
  version: string | undefined,
  fallback: string,
): string {
  if (!version) return fallback;
  const normalized = version.toLowerCase();
  if (
    normalized === "sonnet" ||
    normalized === "opus" ||
    normalized === "fable"
  )
    return fallback;
  const match = /^claude-(?:sonnet|opus|fable)-(.+)$/.exec(normalized);
  if (!match) return version;
  return match[1]!.replace(/-/g, ".");
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
const TOOL_SERENA = "serena";
const TOOL_BASELINE = "baseline";

function cellTool(cell: AgentCell): string {
  return cell.tool ?? TOOL_TTSC;
}

/**
 * Display order for model rows and tabs. Keep Codex GPT-5.4 mini first because
 * it is the primary benchmark lane, then larger Codex and Claude models.
 */
function modelOrder(model: string): number {
  const order = [
    "codex-gpt-mini",
    "codex-gpt",
    "claude-code-fable",
    "claude-code-opus",
    "claude-code-sonnet",
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

function makeKey(parts: (string | undefined)[]): string {
  return parts.map((part) => encodeURIComponent(part ?? "")).join("|");
}

function parseKey(key: string): string[] {
  return key.split("|").map((part) => decodeURIComponent(part));
}

/** API list price in USD per 1M tokens for one model. */
interface PriceRates {
  input: number;
  cachedInput: number;
  output: number;
}

/** The list-price table for cost estimation, keyed by `modelVersion`. */
function priceRates(modelVersion: string | undefined): PriceRates | undefined {
  if (!modelVersion) return undefined;
  const table: Record<string, PriceRates> = pricing.usdPerMillion;
  return table[modelVersion];
}

/**
 * Estimate one run's USD cost from its token counts and the model's list
 * prices, for harnesses that report usage but no cost (Codex). `tokens` is the
 * summed input+output; `cached` (a subset of the input) moves to the
 * cached-input rate and `reasoning` is billed as output. The non-reasoning
 * output slice inside `tokens` cannot be split out, so it is priced at the
 * input rate: a slight underestimate on agent runs, where input dominates.
 */
function estimateSampleCost(sample: AgentSample, rates: PriceRates): number {
  const cached = sample.cached ?? 0;
  const reasoning = sample.reasoning ?? 0;
  return (
    (Math.max(0, sample.tokens - cached) * rates.input +
      cached * rates.cachedInput +
      reasoning * rates.output) /
    1_000_000
  );
}

function medianMetricsFromValid(
  valid: AgentSample[],
  rates?: PriceRates,
): Metrics {
  const measured = valid
    .map((s) => s.cost)
    .filter((cost): cost is number => typeof cost === "number");
  const cost =
    measured.length > 0
      ? { cost: median(measured) }
      : rates && valid.length > 0
        ? {
            cost: median(valid.map((s) => estimateSampleCost(s, rates))),
            costEstimated: true,
          }
        : {};
  return {
    tokens: median(valid.map((s) => s.tokens)),
    tools: median(valid.map((s) => s.tools)),
    dur: median(valid.map((s) => s.durMs ?? 0)),
    ...cost,
  };
}

function medianMetrics(samples: AgentSample[], rates?: PriceRates): Metrics {
  return medianMetricsFromValid(metricSamples(samples), rates);
}

function metricSamples(samples: AgentSample[]): AgentSample[] {
  // Plot raw token cost. Only zero-token process failures are missing data.
  return samples.filter((sample) => sample.tokens > 0);
}

function cellEffort(cell: AgentCell): string | undefined {
  if (cell.effort) return cell.effort;
  if (cell.harness === "claude-code" || cell.model.startsWith("claude-code-"))
    return "high";
  return undefined;
}

function modelGroupKey(cell: AgentCell): string {
  return makeKey([
    cell.harness,
    cell.model,
    cell.modelVersion ?? "",
    cellEffort(cell) ?? "",
    cell.fixtureBranch ?? "",
    cell.daemon === true ? "daemon" : "default",
  ]);
}

function projectGroupKey(cell: AgentCell): string {
  return makeKey([
    cell.promptId ?? "",
    cell.promptFamily ?? "project-specific",
    cell.repo,
  ]);
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

function normalizeQuestion(question: string | undefined): string | undefined {
  const normalized = question?.replace(/\r\n/g, "\n").trim();
  return normalized ? normalized : undefined;
}

function primaryQuestion(
  questions: (string | undefined)[],
): string | undefined {
  const counts = new Map<string, { question: string; count: number }>();
  for (const raw of questions) {
    const question = normalizeQuestion(raw);
    if (!question) continue;
    const entry = counts.get(question);
    if (entry) entry.count += 1;
    else counts.set(question, { question, count: 1 });
  }
  let best: { question: string; count: number } | undefined;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.question;
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
      parseKey(key);
    const models = groupBy(repoCells, modelGroupKey)
      .map(({ key: modelKey, items: modelCells }): ModelGroup => {
        const ttscCell = modelCells.find((c) => cellTool(c) === TOOL_TTSC);
        const codegraphCell = modelCells.find(
          (c) => cellTool(c) === TOOL_CODEGRAPH,
        );
        const codebaseMemoryCell = modelCells.find(
          (c) => cellTool(c) === TOOL_CODEBASE_MEMORY,
        );
        const serenaCell = modelCells.find((c) => cellTool(c) === TOOL_SERENA);
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
        const rates = priceRates(head.modelVersion);
        const ttscValid = ttscCell ? metricSamples(ttscCell.samples.graph) : [];
        const codegraphValid = codegraphCell
          ? metricSamples(codegraphCell.samples.graph)
          : [];
        const codebaseMemoryValid = codebaseMemoryCell
          ? metricSamples(codebaseMemoryCell.samples.graph)
          : [];
        const serenaValid = serenaCell
          ? metricSamples(serenaCell.samples.graph)
          : [];
        const question = primaryQuestion([
          ...modelCells
            .filter((c) => cellTool(c) !== TOOL_BASELINE)
            .map((c) => c.question),
          ...modelCells
            .filter((c) => cellTool(c) === TOOL_BASELINE)
            .map((c) => c.question),
        ]);
        return {
          id: modelKey,
          model: head.model,
          label: modelLabel(head),
          harness: head.harness,
          effort: cellEffort(head),
          fixtureBranch: head.fixtureBranch,
          daemon: head.daemon === true,
          runs:
            ttscCell?.runs ??
            codegraphCell?.runs ??
            codebaseMemoryCell?.runs ??
            serenaCell?.runs ??
            baselineCell?.runs,
          question,
          codegraphSetupMs: codegraphCell?.toolSetupMs,
          codebaseMemorySetupMs: codebaseMemoryCell?.toolSetupMs,
          serenaSetupMs: serenaCell?.toolSetupMs,
          baseline: medianMetrics(baselineSamples, rates),
          ttsc:
            ttscValid.length > 0
              ? medianMetricsFromValid(ttscValid, rates)
              : undefined,
          codegraph:
            codegraphValid.length > 0
              ? medianMetricsFromValid(codegraphValid, rates)
              : undefined,
          codebaseMemory:
            codebaseMemoryValid.length > 0
              ? medianMetricsFromValid(codebaseMemoryValid, rates)
              : undefined,
          serena:
            serenaValid.length > 0
              ? medianMetricsFromValid(serenaValid, rates)
              : undefined,
        };
      })
      .sort(
        (a, b) =>
          modelOrder(a.model) - modelOrder(b.model) ||
          a.label.localeCompare(b.label) ||
          a.id.localeCompare(b.id),
      );
    const question = primaryQuestion(repoCells.map((c) => c.question));
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

function modelTabMeta(model: ModelGroup): string | undefined {
  const parts: string[] = [];
  if (model.effort) parts.push(model.effort);
  if (model.daemon) parts.push("daemon");
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

const TtscWebsiteBenchmarkGraphData = {
  buildProjectGroups,
  buildPromptModeGroups,
  cellTool,
  fmt,
  fmtCost,
  fmtSecs,
  groupBy,
  median,
  modelLabel,
  modelOrder,
  modelTabMeta,
  pctSaved,
  primaryQuestion,
  promptFamilyLabel,
  repoLabel,
};

export default TtscWebsiteBenchmarkGraphData;
