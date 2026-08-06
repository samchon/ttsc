import type { ITtscWebsiteBenchmarkEvidence } from "../../../structures/ITtscWebsiteBenchmarkEvidence";

type Arm = ITtscWebsiteBenchmarkEvidence.Arm;
type Cell = ITtscWebsiteBenchmarkEvidence.Cell;
type CoverageReport = ITtscWebsiteBenchmarkEvidence.CoverageReport;
type Report = ITtscWebsiteBenchmarkEvidence.Report;

/**
 * The five phases a cell's instruction sequence collapses into.
 *
 * A run records one stage per objective plus however many supplementation
 * reminders a failing review needed, and a chart with sixteen segments says
 * nothing. Grouping them keeps the reading a reader wants: how much of the
 * spend was building and how much was reviewing what was built.
 */
const PHASES = [
  {
    key: "backend-development",
    label: "Backend Dev",
    hint: "First implementation of the schema, the API and their tests",
  },
  {
    key: "backend-review",
    label: "Backend Review",
    hint: "Read the requirements and the backend in full, loop until dry",
  },
  {
    key: "frontend-development",
    label: "Frontend Dev",
    hint: "Hooks and screens built against the generated SDK",
  },
  {
    key: "frontend-review",
    label: "Frontend Review",
    hint: "The same loop over the frontend, gated on live reloads",
  },
  {
    key: "overall-review",
    label: "Overall Review",
    hint: "Both layers and the live journeys together, then the closing gates",
  },
] as const;

type PhaseKey = (typeof PHASES)[number]["key"];

/** Shades one arm's colour, palest for the first phase. */
const PHASE_OPACITY = [0.44, 0.58, 0.7, 0.84, 1] as const;

const ARM_COLOR: Record<Arm, string> = {
  plain: "#4c78a8",
  evidence: "#f58518",
};

/** Spend that belongs to no stage, drawn as its own segment. */
const INSPECTION_COLOR = "#94a3b8";

/**
 * Which phase a stage belongs to.
 *
 * A supplementation reminder belongs to the review it supplements, however many
 * of them a scope needed. An unknown name is attributed to nothing rather than
 * to a neighbouring phase, so a new stage shows up as a gap the remainder
 * segment absorbs instead of silently inflating a phase it never ran in.
 */
function stagePhase(stage: string): PhaseKey | null {
  const supplement =
    /^(backend|frontend|overall)-remind(?:-[1-9][0-9]*)?$/.exec(stage);
  if (supplement) return `${supplement[1] as "backend"}-review` as PhaseKey;
  switch (stage) {
    case "backend-start":
      return "backend-development";
    case "backend-review":
    case "backend-final":
      return "backend-review";
    case "frontend-start":
      return "frontend-development";
    case "frontend-review":
    case "frontend-final":
      return "frontend-review";
    case "overall-review":
    case "overall-final":
      return "overall-review";
    default:
      return null;
  }
}

/** One measurable axis of what an arm spent. */
export interface Axis {
  id: "tokens" | "time" | "cost";
  label: string;
  hint: string;
  value: (cell: Cell) => number;
  stage: (stage: ITtscWebsiteBenchmarkEvidence.Stage, cell: Cell) => number;
  format: (value: number) => string;
}

const AXES: readonly Axis[] = [
  {
    id: "tokens",
    label: "Tokens",
    hint: "Everything the session sent and received, cache included",
    value: (cell) => cell.tokens,
    stage: (stage) => stage.tokens,
    format: formatTokens,
  },
  {
    id: "time",
    label: "Work time",
    hint: "Model process time, with verified system suspensions excluded",
    value: (cell) => cell.workElapsedMs,
    stage: (stage) => stage.elapsedMs,
    format: formatDuration,
  },
  {
    id: "cost",
    label: "API cost",
    hint: "Reconciled per-request price, apportioned across phases by token share",
    value: (cell) => cell.apiCost?.amountUsd ?? 0,
    stage: (stage, cell) =>
      ((cell.apiCost?.amountUsd ?? 0) * stage.tokens) /
      Math.max(1, cell.tokens),
    format: (value) => `$${value.toFixed(2)}`,
  },
];

export interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
  opacity: number;
}

export interface Row {
  arm: Arm;
  cell: Cell;
  color: string;
  total: number;
  /** Percent against the Plain cell of the same subject, null on Plain itself. */
  delta: number | null;
  segments: Segment[];
}

export interface SubjectGroup {
  subject: string;
  label: string;
  models: string;
  rows: Row[];
}

/**
 * One group per subject, in the order the report lists them.
 *
 * That order is ascending subject size, which is the reading every view of this
 * benchmark supports, and taking it from the report rather than from a list
 * written here keeps the groups and the coverage block from disagreeing about
 * which subject comes first.
 */
function buildSubjects(report: Report | null, axis: Axis): SubjectGroup[] {
  if (!report) return [];
  const order: string[] = [];
  const bySubject = new Map<string, Cell[]>();
  for (const cell of report.cells) {
    if (!bySubject.has(cell.subject)) {
      bySubject.set(cell.subject, []);
      order.push(cell.subject);
    }
    bySubject.get(cell.subject)!.push(cell);
  }
  return order.map((subject) => {
    const cells = [...bySubject.get(subject)!].sort(
      (a, b) => armOrder(a.arm) - armOrder(b.arm),
    );
    const baseline = cells.find((cell) => cell.arm === "plain");
    return {
      subject,
      label: title(subject),
      models: [...new Set(cells.map((cell) => displayModel(cell.model)))].join(
        ", ",
      ),
      rows: cells.map((cell): Row => {
        const total = axis.value(cell);
        const base = baseline ? axis.value(baseline) : 0;
        const phases = new Map<PhaseKey, number>(
          PHASES.map((phase) => [phase.key, 0]),
        );
        for (const stage of cell.stages) {
          const key = stagePhase(stage.name);
          if (key === null) continue;
          phases.set(key, phases.get(key)! + axis.stage(stage, cell));
        }
        const segments = PHASES.map(
          (phase, index): Segment => ({
            key: phase.key,
            label: phase.label,
            value: phases.get(phase.key)!,
            color: ARM_COLOR[cell.arm],
            opacity: PHASE_OPACITY[index]!,
          }),
        ).filter((segment) => segment.value > 0);
        // Judging a Review is inside the cell's totals and inside no stage, so
        // without this the segments would sum to less than the number printed
        // beside them and the widest bar would stop short of its own scale.
        const remainder =
          total - segments.reduce((sum, segment) => sum + segment.value, 0);
        if (remainder > 0)
          segments.push({
            key: "review-inspection",
            label: "Review inspection",
            value: remainder,
            color: INSPECTION_COLOR,
            opacity: 1,
          });
        return {
          arm: cell.arm,
          cell,
          color: ARM_COLOR[cell.arm],
          total,
          delta:
            baseline === undefined || cell.arm === "plain" || base <= 0
              ? null
              : Math.round((total / base - 1) * 100),
          segments,
        };
      }),
    };
  });
}

export interface CoverageRow {
  label: string;
  percent: number;
  color: string;
}

/**
 * The coverage rows, or none at all.
 *
 * An arm that is complete by construction has nothing to say per subject, so
 * its identical rows collapse into one. Absence of the whole report is an
 * ordinary state rather than an error: the figure is counted by hand from a
 * finished workspace, so a cohort can be published before anyone has read one.
 */
function buildCoverage(
  report: Report | null,
  coverage: CoverageReport | null,
): CoverageRow[] {
  if (!report || !coverage) return [];
  const charted = new Set(
    report.cells.map((cell) => `${cell.model}/${cell.subject}`),
  );
  const relevant = coverage.cells.filter(
    (cell) =>
      charted.has(`${cell.model}/${cell.subject}`) &&
      typeof cell.coverage.score === "number",
  );
  const measured = relevant.filter((cell) => cell.coverage.measured);
  const asserted = relevant.filter((cell) => !cell.coverage.measured);
  const row = (label: string, arm: Arm, score: number | null): CoverageRow => ({
    label,
    percent: (score ?? 0) * 100,
    color: ARM_COLOR[arm],
  });
  const collapsed =
    asserted.length > 1 &&
    new Set(asserted.map((cell) => `${cell.arm}/${cell.coverage.score}`))
      .size === 1;
  return [
    ...measured.map((cell) =>
      row(
        `${title(cell.subject)} ${title(cell.arm)}`,
        cell.arm,
        cell.coverage.score,
      ),
    ),
    ...(collapsed
      ? [
          row(
            `${title(asserted[0]!.arm)} (every)`,
            asserted[0]!.arm,
            asserted[0]!.coverage.score,
          ),
        ]
      : asserted.map((cell) =>
          row(
            `${title(cell.subject)} ${title(cell.arm)}`,
            cell.arm,
            cell.coverage.score,
          ),
        )),
  ];
}

function armOrder(arm: Arm): number {
  return arm === "plain" ? 0 : 1;
}

function title(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * Names the model as the engine that ran it names it.
 *
 * A reader reproducing a figure needs the string the runner, the session, and
 * the price list all accept, and the engine is part of it. Title-casing it
 * produces something none of them take.
 */
function displayModel(model: string): string {
  return `codex ${model}`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return `${Math.round(tokens)}`;
  if (tokens < 1_000_000)
    return `${stripZero((tokens / 1_000).toFixed(1))}k tokens`;
  return `${stripZero((tokens / 1_000_000).toFixed(1))}M tokens`;
}

function formatDuration(elapsedMs: number): string {
  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatCost(cell: Cell): string {
  return cell.apiCost === null
    ? "unavailable"
    : `$${cell.apiCost.amountUsd.toFixed(2)}`;
}

function stripZero(value: string): string {
  return value.replace(/\.0$/, "");
}

const TtscWebsiteBenchmarkEvidenceData = {
  ARM_COLOR,
  AXES,
  INSPECTION_COLOR,
  PHASES,
  PHASE_OPACITY,
  buildCoverage,
  buildSubjects,
  displayModel,
  formatCost,
  formatDuration,
  formatInteger,
  formatTokens,
  title,
};

export default TtscWebsiteBenchmarkEvidenceData;
