import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import typia from "typia";

import { collectEvidenceBenchmarkApiCost } from "./EvidenceBenchmarkApiCost";
import { EvidenceBenchmarkLayout } from "./EvidenceBenchmarkLayout";
import { EvidenceBenchmarkStageElapsed } from "./EvidenceBenchmarkStageElapsed";
import { EvidenceBenchmarkStageLog } from "./EvidenceBenchmarkStageLog";
import type { ITtscEvidenceBenchmarkApiCost } from "./structures/ITtscEvidenceBenchmarkApiCost";
import type {
  ITtscEvidenceBenchmarkReport,
  ITtscEvidenceBenchmarkReportCell,
  ITtscEvidenceBenchmarkReportInspection,
  ITtscEvidenceBenchmarkReportReviewVerdict,
  ITtscEvidenceBenchmarkReportStage,
  ITtscEvidenceBenchmarkReportSuspension,
  ITtscEvidenceBenchmarkReportWorktree,
} from "./structures/ITtscEvidenceBenchmarkReport";
import type {
  ITtscEvidenceBenchmarkSuspension,
  ITtscEvidenceBenchmarkSuspensionLog,
} from "./structures/ITtscEvidenceBenchmarkSuspension";
import type { ITtscEvidenceBenchmarkTokenUsage } from "./structures/ITtscEvidenceBenchmarkTokenUsage";
import type { EvidenceBenchmarkEffort } from "./typings/EvidenceBenchmarkEffort";

interface IDashboardCell {
  engine: "codex";
  subject: string;
  arm: "plain" | "evidence";
  runId: string;
  benchmarkRevision: string;
  model: string;
  effort: EvidenceBenchmarkEffort;
  checkpointSource?: {
    runId: string;
    inheritedWallElapsedMs: number;
    instructionSurfaceSha256?: string;
  };
  reviewLedger?: "backend";
}

interface IDashboardProcess {
  elapsedMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

interface IDashboardInstruction {
  elapsedMs: number;
  goal?: {
    timeUsedSeconds?: number;
  } | null;
  index: number;
  name: string;
  tokenUsage: {
    totalTokens: number;
    inputTokens?: number;
    cachedInputTokens?: number;
    cacheWriteInputTokens?: number;
    outputTokens?: number;
    reasoningOutputTokens?: number;
  };
  tokenUsageEnd?: ITtscEvidenceBenchmarkTokenUsage | null;
}

interface IDashboardState {
  status:
    | "ready"
    | "running"
    | "checkpointed"
    | "awaiting-review-verdict"
    | "quality-failed"
    | "awaiting-supervision"
    | "rejected"
    | "interrupted"
    | "completed";
  nextInstructionIndex: number;
  threadTokenUsage: ITtscEvidenceBenchmarkTokenUsage;
  nativeThreadStartInstructionIndex?: number;
  goals: IDashboardInstruction[];
  processes: IDashboardProcess[];
  supervisionPauses?: {
    scope?: "backend" | "frontend" | "overall";
    attempt?: number;
    goalIndex?: number;
    inspections?: {
      elapsedMs: number;
      tokenUsage: ITtscEvidenceBenchmarkTokenUsage;
      failure?: string;
    }[];
    verdict?: unknown;
    pausedAt: string;
    resumedAt?: string;
  }[];
  inheritedProcessElapsedMs?: number;
}

interface IDashboardStateFile {
  cell: IDashboardCell;
  records: {
    root: string;
    workspace: string;
    events: string;
  };
  state: IDashboardState;
}

interface IDashboardRun {
  file: IDashboardStateFile;
  launchedAt: number;
  suspensions: ITtscEvidenceBenchmarkReportSuspension[];
}

interface IOutputEvent {
  processIndex: number;
  elapsedMs: number;
}

export const renderEvidenceBenchmarkDashboard = (
  repository: string,
): string => {
  const report: ITtscEvidenceBenchmarkReport =
    collectEvidenceBenchmarkReport(repository);
  const models: Map<string, ITtscEvidenceBenchmarkReportCell[]> = Map.groupBy(
    report.cells,
    (cell) => cell.model,
  );
  return `${[...models]
    .map(([model, group]) => renderModel(model, group))
    .join("\n\n")}\n`;
};

/** Collects the publishable latest-run aggregate used by every report view. */
export const collectEvidenceBenchmarkReport = (
  repository: string,
  generatedAt: Date = new Date(),
  runIds?: readonly string[],
  includeApiCost: boolean = false,
): ITtscEvidenceBenchmarkReport => {
  const scanned: IDashboardRun[] = scanRuns(
    path.join(EvidenceBenchmarkLayout.assetsRoot(repository), "output"),
  );
  const latest: IDashboardRun[] =
    runIds === undefined
      ? selectLatestRuns(scanned)
      : selectRuns(scanned, runIds);
  const models: Map<string, IDashboardRun[]> = Map.groupBy(
    latest,
    (run) => run.file.cell.model,
  );
  const ordered: [string, IDashboardRun[]][] = [...models].sort(
    ([leftModel, leftRuns], [rightModel, rightRuns]) =>
      Math.min(...leftRuns.map((run) => run.launchedAt)) -
        Math.min(...rightRuns.map((run) => run.launchedAt)) ||
      leftModel.localeCompare(rightModel),
  );
  const byRunId: ReadonlyMap<string, IDashboardRun> = new Map(
    scanned.map((run) => [run.file.cell.runId, run]),
  );
  const origin: string | undefined = readRepositoryOrigin(repository);
  return {
    generatedAt: generatedAt.toISOString(),
    ...(origin === undefined ? {} : { origin }),
    cells: ordered.flatMap(([, runs]) =>
      runs
        .sort(compareRuns)
        .map((run) => summarizeRun(run, includeApiCost, byRunId)),
    ),
  };
};

/**
 * Names the repository whose run records this collection just read.
 *
 * Every cell already carries the revision its launcher read from `HEAD`, and a
 * bare SHA resolves nowhere on its own. Recording where it resolves is what
 * separates a cohort this repository measured from one vendored in, which is
 * the distinction the published figures otherwise lose.
 *
 * The manifest is the source rather than a Git remote: `report` runs from a
 * checkout whose remote an operator may have renamed or removed, while the
 * manifest is the tracked declaration of what the repository is.
 *
 * The value is normalized to `owner/name` because the aggregate already states
 * an origin that way. `coverage.json` carries `source.origin` as
 * `samchon/lint-plugin-evidence`, written by hand when a cohort was vendored
 * in, and two artifacts in one directory answering the same question in two
 * vocabularies is how a comparison between them comes to be skipped.
 */
const readRepositoryOrigin = (repository: string): string | undefined => {
  const manifest: string = path.join(path.resolve(repository), "package.json");
  if (!fs.existsSync(manifest)) return undefined;
  const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const declared: unknown = (
    parsed as { repository?: { url?: unknown } | string } | null
  )?.repository;
  const url: unknown =
    typeof declared === "string"
      ? declared
      : (declared as { url?: unknown } | undefined)?.url;
  return typeof url === "string"
    ? normalizeEvidenceBenchmarkOrigin(url)
    : undefined;
};

/**
 * Reduces a declared repository URL to the `owner/name` the aggregate uses.
 *
 * A value that does not reduce to that shape yields nothing rather than being
 * recorded as it stands. The whole point of the field is that a reader can
 * resolve it, and writing an unresolvable string into a generated artifact is
 * the failure it exists to prevent, so an unrecorded origin is the honest
 * outcome for a manifest that does not declare one usefully.
 */
export const normalizeEvidenceBenchmarkOrigin = (
  url: string,
): string | undefined => {
  // The host is dropped rather than counted as an owner. A profile URL is the
  // likeliest malformed value a manifest carries, and taking its last two
  // segments would record `github.com/samchon`, which names no repository and
  // is exactly the unresolvable string this returns nothing for.
  const trimmed: string = url
    .trim()
    .replace(/\.git$/u, "")
    .replace(/\/$/u, "");
  const path: string = trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\//iu, "")
    .replace(/^[^/]*@/u, "")
    .replace(/^[^/:]+[:/]/u, (host) => (/^[^/:]*[.:]/u.test(host) ? "" : host));
  const segments: string[] = path.split("/").filter(Boolean);
  if (segments.length !== 2) return undefined;
  const origin = segments.join("/");
  return /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/u.test(origin)
    ? origin
    : undefined;
};

const selectRuns = (
  runs: readonly IDashboardRun[],
  runIds: readonly string[],
): IDashboardRun[] => {
  const requested: Set<string> = new Set(runIds);
  if (requested.size !== runIds.length)
    throw new Error("Benchmark report run IDs must be unique.");
  const selected: IDashboardRun[] = runs.filter((run) =>
    requested.has(run.file.cell.runId),
  );
  const found: Set<string> = new Set(
    selected.map((run) => run.file.cell.runId),
  );
  const missing: string[] = runIds.filter((runId) => !found.has(runId));
  if (missing.length !== 0)
    throw new Error(`Unknown benchmark report run IDs: ${missing.join(", ")}.`);
  return selected;
};

const scanRuns = (result: string): IDashboardRun[] => {
  if (!fs.existsSync(result)) return [];
  const runs: IDashboardRun[] = [];
  for (const subject of directories(result))
    for (const engine of directories(path.join(result, subject)))
      for (const arm of directories(path.join(result, subject, engine))) {
        const root: string = path.join(result, subject, engine, arm, "runs");
        if (!fs.existsSync(root)) continue;
        for (const runId of directories(root)) {
          const statePath: string = path.join(root, runId, "state.json");
          if (!fs.existsSync(statePath)) continue;
          const file: IDashboardStateFile = typia.assert<IDashboardStateFile>(
            JSON.parse(fs.readFileSync(statePath, "utf8")),
          );
          const launchedAt: number = readLaunchTime(
            file.records.events,
            statePath,
          );
          runs.push({
            file,
            launchedAt,
            suspensions: readSuspensions(
              path.join(root, runId, "suspensions.json"),
              file.state,
              launchedAt,
              readLastRecordedTime(file.records.events),
            ),
          });
        }
      }
  return runs;
};

const readSuspensions = (
  file: string,
  state: IDashboardState,
  launchedAt: number,
  lastRecordedAt: number | undefined,
): ITtscEvidenceBenchmarkReportSuspension[] => {
  if (!fs.existsSync(file)) return [];
  const log: ITtscEvidenceBenchmarkSuspensionLog =
    typia.assert<ITtscEvidenceBenchmarkSuspensionLog>(
      JSON.parse(fs.readFileSync(file, "utf8")),
    );
  const ordered: ITtscEvidenceBenchmarkReportSuspension[] = log.suspensions
    .map((suspension) => validateSuspension(suspension, state))
    .sort(
      (left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt),
    );
  for (let index: number = 0; index < ordered.length; ++index) {
    const suspension: ITtscEvidenceBenchmarkReportSuspension = ordered[index]!;
    const startedAt: number = Date.parse(suspension.startedAt);
    const endedAt: number = Date.parse(suspension.endedAt);
    if (
      startedAt < launchedAt ||
      (lastRecordedAt !== undefined && endedAt > lastRecordedAt)
    )
      throw new Error(`Benchmark suspension lies outside its run: ${file}.`);
    const previous: ITtscEvidenceBenchmarkReportSuspension | undefined =
      ordered[index - 1];
    if (previous !== undefined && Date.parse(previous.endedAt) > startedAt)
      throw new Error(`Benchmark suspensions overlap: ${file}.`);
  }
  return ordered;
};

const validateSuspension = (
  suspension: ITtscEvidenceBenchmarkSuspension,
  state: IDashboardState,
): ITtscEvidenceBenchmarkReportSuspension => {
  if (
    !Number.isSafeInteger(suspension.processIndex) ||
    suspension.processIndex < 0 ||
    suspension.processIndex >= state.processes.length
  )
    throw new Error(
      `Benchmark suspension has an invalid process index: ${suspension.processIndex}.`,
    );
  if (
    suspension.instructionIndex !== null &&
    (!Number.isSafeInteger(suspension.instructionIndex) ||
      !state.goals.some((goal) => goal.index === suspension.instructionIndex))
  )
    throw new Error(
      `Benchmark suspension has an invalid instruction index: ${suspension.instructionIndex}.`,
    );
  const startedAt: number = Date.parse(suspension.startedAt);
  const endedAt: number = Date.parse(suspension.endedAt);
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  )
    throw new Error("Benchmark suspension has an invalid time interval.");
  return {
    ...suspension,
    elapsedMs: endedAt - startedAt,
  };
};

const directories = (root: string): string[] =>
  fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const readLaunchTime = (events: string, state: string): number => {
  const first: unknown = readFirstJson(events);
  if (isRecord(first) && typeof first.recordedAt === "string") {
    const parsed: number = Date.parse(first.recordedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fs.statSync(state).birthtimeMs;
};

const readFirstJson = (file: string): unknown => {
  if (!fs.existsSync(file)) return undefined;
  const descriptor: number = fs.openSync(file, "r");
  try {
    const buffer: Buffer = Buffer.alloc(64 * 1024);
    const length: number = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
    const line: string = buffer
      .subarray(0, length)
      .toString("utf8")
      .split("\n")[0]!;
    return line.length === 0 ? undefined : JSON.parse(line);
  } finally {
    fs.closeSync(descriptor);
  }
};

const selectLatestRuns = (runs: IDashboardRun[]): IDashboardRun[] => {
  const latest: Map<string, IDashboardRun> = new Map();
  for (const run of runs) {
    const cell: IDashboardCell = run.file.cell;
    const key: string = [cell.model, cell.engine, cell.subject, cell.arm].join(
      "\u0000",
    );
    const previous: IDashboardRun | undefined = latest.get(key);
    if (previous === undefined || previous.launchedAt < run.launchedAt)
      latest.set(key, run);
  }
  return [...latest.values()];
};

const renderModel = (
  model: string,
  runs: ITtscEvidenceBenchmarkReportCell[],
): string => {
  const cells: IRenderedRun[] = runs.map(renderRun);
  return [
    `## ${displayModel(model)}`,
    "",
    "| Cell | Stage | Progress | Cost | Work time |",
    "| --- | --- | --- | ---: | ---: |",
    ...cells.map((cell) => cell.summary),
    "",
    ...cells.flatMap((cell) => cell.details),
  ].join("\n");
};

const compareRuns = (left: IDashboardRun, right: IDashboardRun): number => {
  const subjects: readonly string[] = ["todo", "reddit", "shopping", "erp"];
  const leftSubject: number = subjects.indexOf(left.file.cell.subject);
  const rightSubject: number = subjects.indexOf(right.file.cell.subject);
  return (
    (leftSubject === -1 ? Number.MAX_SAFE_INTEGER : leftSubject) -
      (rightSubject === -1 ? Number.MAX_SAFE_INTEGER : rightSubject) ||
    left.file.cell.subject.localeCompare(right.file.cell.subject) ||
    Number(left.file.cell.arm === "evidence") -
      Number(right.file.cell.arm === "evidence")
  );
};

interface IRenderedRun {
  summary: string;
  details: string[];
}

const renderRun = (run: ITtscEvidenceBenchmarkReportCell): IRenderedRun => {
  const cell: string = `${title(run.subject)} ${title(run.arm)}`;
  return {
    summary: `| ${cell} | ${formatStage(run)} | ${formatDelta(run.worktree)} | ${formatCost(run.tokens)} | ${formatTime(run.workElapsedMs)} |`,
    details: [
      `- **${cell} stages**`,
      ...run.stages.map(
        (measurement) =>
          `  - \`${measurement.name}\`: ${formatCost(measurement.tokens)} · ${formatTime(measurement.elapsedMs)} · ${measurement.tokenPercent}% tokens · ${measurement.timePercent}% time`,
      ),
    ],
  };
};

const summarizeRun = (
  run: IDashboardRun,
  includeApiCost: boolean,
  byRunId: ReadonlyMap<string, IDashboardRun>,
): ITtscEvidenceBenchmarkReportCell => {
  const file: IDashboardStateFile = run.file;
  const rawWorkElapsedMs: number = elapsed(file);
  const suspendedMs: number = run.suspensions.reduce(
    (sum, suspension) => sum + suspension.elapsedMs,
    0,
  );
  if (suspendedMs > rawWorkElapsedMs)
    throw new Error(
      `Benchmark suspension exceeds retained work time: ${file.cell.runId}.`,
    );
  const threadElapsedMs: number = rawWorkElapsedMs - suspendedMs;
  const detached: boolean = file.cell.reviewLedger === "backend";
  // Judging a Review is part of what an arm costs, so the inspecting thread's
  // tokens and time join the cell's totals. They arrive from their own retained
  // record rather than from `threadTokenUsage`, so what the measured agent spent
  // and what judging it spent stay separable in the same report.
  const inspection: ITtscEvidenceBenchmarkReportInspection = inspectionCost(
    file.state,
  );
  const workElapsedMs: number = threadElapsedMs + inspection.elapsedMs;
  const totalUsage: ITtscEvidenceBenchmarkTokenUsage = addTokenUsage(
    totalTokenUsage(file.state, detached),
    inspection.tokenUsage,
  );
  const totalTokens: number = totalUsage.totalTokens;
  const stages: ITtscEvidenceBenchmarkReportStage[] = stageMeasurements(
    file.state,
    threadElapsedMs,
    detached,
    run.suspensions,
    EvidenceBenchmarkStageElapsed.read(
      file.records.events,
      new Map(
        file.state.processes.map((process, index) => [
          index,
          process.elapsedMs,
        ]),
      ),
      run.suspensions,
    ),
  ).map((measurement) => ({
    ...measurement,
    tokenPercent: percent(measurement.tokens, totalTokens),
    timePercent: percent(measurement.elapsedMs, workElapsedMs),
  }));
  return {
    engine: file.cell.engine,
    subject: file.cell.subject,
    arm: file.cell.arm,
    runId: file.cell.runId,
    benchmarkRevision: file.cell.benchmarkRevision,
    model: file.cell.model,
    effort: file.cell.effort,
    ...(file.cell.reviewLedger === undefined
      ? {}
      : { reviewLedger: file.cell.reviewLedger }),
    status: file.state.status,
    stage: stageName(file.state),
    launchedAt: new Date(run.launchedAt).toISOString(),
    tokens: totalTokens,
    tokenUsage: totalUsage,
    inspection,
    apiCost: includeApiCost ? collectRunApiCost(run, byRunId) : null,
    suspendedMs,
    suspensions: run.suspensions,
    workElapsedMs,
    worktree: inspectWorktree(file.records.workspace),
    reviewVerdicts: collectReviewVerdicts(file.state),
    stages,
  };
};

/**
 * Reads the retained review decisions of one run.
 *
 * Validation here is structural rather than bounded. The supplementation limit
 * governs which attempt the runner may issue next, and it can be lowered
 * between cohorts; a run recorded while it was higher is a faithful record of
 * what the rules then permitted, not a corrupt one. Reporting is the wrong
 * place to relitigate that, and reading history through the current bound
 * refuses whole cohorts for having obeyed the old one.
 *
 * What the record must still prove about itself: attempts within a scope are
 * numbered from zero without a gap, and `quality-failed` closes that scope, so
 * it can only sit on its last retained attempt.
 */
const collectReviewVerdicts = (
  state: IDashboardState,
): ITtscEvidenceBenchmarkReportReviewVerdict[] => {
  const pauses = state.supervisionPauses ?? [];
  const scopeOrdinals = new Map<unknown, number>();
  const ordinals: number[] = pauses.map((pause) => {
    const seen: number = scopeOrdinals.get(pause.scope) ?? 0;
    scopeOrdinals.set(pause.scope, seen + 1);
    return seen;
  });
  const lastOfScope: boolean[] = pauses.map(
    (pause, index) =>
      !pauses.some(
        (candidate, other) => other > index && candidate.scope === pause.scope,
      ),
  );
  return pauses.flatMap((pause, index) => {
    if (
      pause.scope === undefined ||
      pause.attempt === undefined ||
      !isRecord(pause.verdict)
    )
      return [];
    const verdict = pause.verdict;
    const workspace = verdict.workspace;
    // A failing verdict carries no feedback. Every failed scope receives the
    // same prescribed reminder, so nothing cell-specific exists to carry, and
    // the decision itself refuses text bound for the cell.
    // Final is reached by passing, or by failing the last permitted
    // supplementation — a scope that exhausts its attempts now continues into
    // its Final rather than ending the cell. `quality-failed` stays valid so a
    // run retained under the earlier behaviour still renders.
    const validTransition: boolean =
      verdict.feedback === undefined &&
      ((verdict.decision === "pass" && verdict.action === "final") ||
        (verdict.decision === "fail" &&
          (verdict.action === "retry" ||
            ((verdict.action === "quality-failed" ||
              verdict.action === "final") &&
              lastOfScope[index] === true))));
    if (
      (verdict.decision !== "pass" && verdict.decision !== "fail") ||
      verdict.scope !== pause.scope ||
      verdict.attempt !== pause.attempt ||
      !Number.isSafeInteger(pause.attempt) ||
      pause.attempt < 0 ||
      pause.attempt !== ordinals[index] ||
      (verdict.action !== "final" &&
        verdict.action !== "retry" &&
        verdict.action !== "quality-failed") ||
      !validTransition ||
      typeof verdict.decidedAt !== "string" ||
      !Number.isFinite(Date.parse(verdict.decidedAt)) ||
      !Number.isFinite(Date.parse(pause.pausedAt)) ||
      typeof verdict.goalIndex !== "number" ||
      verdict.goalIndex !== pause.goalIndex ||
      !Number.isSafeInteger(verdict.goalIndex) ||
      typeof verdict.terminalTurnId !== "string" ||
      verdict.terminalTurnId.length === 0 ||
      typeof verdict.rationale !== "string" ||
      verdict.rationale.trim().length === 0 ||
      (verdict.feedback !== undefined &&
        typeof verdict.feedback !== "string") ||
      typeof verdict.verdictRelativePath !== "string" ||
      !new RegExp(
        `^supervision/[0-9]{2}-${pause.scope}-${pause.attempt}-verdict\\.json$`,
        "u",
      ).test(verdict.verdictRelativePath) ||
      typeof verdict.verdictSha256 !== "string" ||
      !/^[0-9a-f]{64}$/iu.test(verdict.verdictSha256) ||
      !isRecord(workspace) ||
      typeof workspace.materialSha256 !== "string" ||
      !/^[0-9a-f]{64}$/iu.test(workspace.materialSha256) ||
      (pause.resumedAt !== undefined &&
        !Number.isFinite(Date.parse(pause.resumedAt)))
    )
      throw new Error("Retained Plain review verdict is invalid.");
    return [
      {
        scope: pause.scope,
        attempt: pause.attempt,
        decision: verdict.decision,
        action: verdict.action,
        goalIndex: verdict.goalIndex,
        terminalTurnId: verdict.terminalTurnId,
        rationale: verdict.rationale,
        ...(verdict.feedback === undefined
          ? {}
          : { feedback: verdict.feedback }),
        pausedAt: pause.pausedAt,
        decidedAt: verdict.decidedAt,
        ...(pause.resumedAt === undefined
          ? {}
          : { resumedAt: pause.resumedAt }),
        verdictRelativePath: verdict.verdictRelativePath,
        verdictSha256: verdict.verdictSha256,
        workspaceMaterialSha256: workspace.materialSha256,
      },
    ];
  });
};

const collectRunApiCost = (
  run: IDashboardRun,
  byRunId: ReadonlyMap<string, IDashboardRun>,
): ITtscEvidenceBenchmarkApiCost | null => {
  const file: IDashboardStateFile = run.file;
  const strict: boolean =
    file.state.status === "completed" ||
    file.state.status === "checkpointed" ||
    file.state.status === "awaiting-review-verdict" ||
    file.state.status === "quality-failed" ||
    file.state.status === "awaiting-supervision" ||
    file.state.status === "rejected";
  if (file.cell.checkpointSource === undefined)
    return collectEvidenceBenchmarkApiCost({
      stageLogs: runStageLogs(file),
      model: file.cell.model,
      expected: file.state.threadTokenUsage,
      strict,
    });
  const initial: ITtscEvidenceBenchmarkTokenUsage | null | undefined =
    file.state.goals[0]?.tokenUsageEnd;
  if (initial === undefined || initial === null) {
    if (strict)
      throw new Error(
        "Cannot calculate exact API cost: checkpoint-derived run has no inherited token boundary.",
      );
    return null;
  }
  const source: IDashboardRun | undefined = findCheckpointOrigin(run, byRunId);
  if (source === undefined) {
    if (strict)
      throw new Error(
        `Cannot calculate exact API cost: checkpoint source ${file.cell.checkpointSource.runId} is missing.`,
      );
    return null;
  }
  if (
    source.file.cell.engine !== file.cell.engine ||
    source.file.cell.subject !== file.cell.subject ||
    source.file.cell.arm !== file.cell.arm ||
    source.file.cell.model !== file.cell.model ||
    source.file.cell.effort !== file.cell.effort ||
    source.file.cell.benchmarkRevision !== file.cell.benchmarkRevision
  ) {
    if (strict)
      throw new Error(
        "Cannot calculate exact API cost: checkpoint source identity does not match the derived run.",
      );
    return null;
  }
  const inherited: ITtscEvidenceBenchmarkApiCost | null =
    collectEvidenceBenchmarkApiCost({
      stageLogs: runStageLogs(source.file),
      model: file.cell.model,
      expected: initial,
      strict,
    });
  const continuation: ITtscEvidenceBenchmarkApiCost | null =
    collectEvidenceBenchmarkApiCost({
      stageLogs: runStageLogs(file),
      model: file.cell.model,
      initial:
        file.cell.reviewLedger === "backend" ? emptyTokenUsage() : initial,
      expected: file.state.threadTokenUsage,
      strict,
    });
  if (inherited === null || continuation === null) return null;
  return {
    ...continuation,
    amountUsd:
      Math.round((inherited.amountUsd + continuation.amountUsd) * 100_000_000) /
      100_000_000,
    requests: inherited.requests + continuation.requests,
    shortContextRequests:
      inherited.shortContextRequests + continuation.shortContextRequests,
    longContextRequests:
      inherited.longContextRequests + continuation.longContextRequests,
  };
};

/** Lists one run's retained stage logs in the order the runner wrote them. */
/**
 * Names every native stream one run produced, for pricing.
 *
 * A Review inspection is a model run on the cell's own model and effort, so its
 * requests cost what the cell's cost. Its tokens and time already join the
 * cell's totals; leaving its stream out of this list priced everything the cell
 * spent except what judging it spent, which understated exactly the arm that
 * pays for a judge.
 */
const runStageLogs = (file: IDashboardStateFile): string[] => [
  ...EvidenceBenchmarkStageLog.order(file.records.root, file.state.goals),
  ...inspectionStreams(file.records.root),
];

/** Retained inspection event streams, in attempt order. */
const inspectionStreams = (root: string): string[] => {
  const directory: string = path.join(root, "inspection");
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".jsonl"))
    .sort()
    .map((entry) => path.join(directory, entry));
};

const findCheckpointOrigin = (
  run: IDashboardRun,
  byRunId: ReadonlyMap<string, IDashboardRun>,
): IDashboardRun | undefined => {
  const visited: Set<string> = new Set([run.file.cell.runId]);
  let current: IDashboardRun = run;
  while (current.file.cell.checkpointSource !== undefined) {
    const sourceId: string = current.file.cell.checkpointSource.runId;
    if (visited.has(sourceId)) return undefined;
    visited.add(sourceId);
    const source: IDashboardRun | undefined = byRunId.get(sourceId);
    if (source === undefined) return undefined;
    current = source;
  }
  return current;
};

const readLastRecordedTime = (file: string): number | undefined => {
  if (!fs.existsSync(file)) return undefined;
  const descriptor: number = fs.openSync(file, "r");
  try {
    const size: number = fs.fstatSync(descriptor).size;
    let position: number = size;
    let suffix: string = "";
    while (position > 0) {
      const length: number = Math.min(64 * 1024, position);
      position -= length;
      const buffer: Buffer = Buffer.alloc(length);
      fs.readSync(descriptor, buffer, 0, length, position);
      const lines: string[] = `${buffer.toString("utf8")}${suffix}`.split("\n");
      const firstComplete: number = position === 0 ? 0 : 1;
      for (let i: number = lines.length - 1; i >= firstComplete; --i) {
        const candidate: string = lines[i]!.trim();
        if (candidate.length === 0) continue;
        try {
          const value: unknown = JSON.parse(candidate);
          if (isRecord(value) && typeof value.recordedAt === "string") {
            const parsed: number = Date.parse(value.recordedAt);
            if (Number.isFinite(parsed)) return parsed;
          }
        } catch {
          // The writer may have an incomplete final line; use the last complete event.
        }
      }
      suffix = lines[0]!;
    }
    return undefined;
  } finally {
    fs.closeSync(descriptor);
  }
};

interface IStageMeasurement {
  name: string;
  tokens: number;
  elapsedMs: number;
}

const totalTokenUsage = (
  state: IDashboardState,
  detached: boolean,
): ITtscEvidenceBenchmarkTokenUsage => {
  if (!detached) return structuredClone(state.threadTokenUsage);
  const nativeStart: number = state.nativeThreadStartInstructionIndex ?? 0;
  return state.goals
    .filter((goal) => goal.index < nativeStart)
    .reduce(
      (total, goal) => addTokenUsage(total, completeGoalUsage(goal)),
      structuredClone(state.threadTokenUsage),
    );
};

const completeGoalUsage = (
  goal: IDashboardInstruction,
): ITtscEvidenceBenchmarkTokenUsage => {
  const usage = goal.tokenUsage;
  if (
    typeof usage.inputTokens !== "number" ||
    typeof usage.cachedInputTokens !== "number" ||
    typeof usage.cacheWriteInputTokens !== "number" ||
    typeof usage.outputTokens !== "number" ||
    typeof usage.reasoningOutputTokens !== "number"
  )
    throw new Error(
      "Detached checkpoint stage lacks complete inherited token usage.",
    );
  return {
    totalTokens: usage.totalTokens,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cacheWriteInputTokens: usage.cacheWriteInputTokens,
    outputTokens: usage.outputTokens,
    reasoningOutputTokens: usage.reasoningOutputTokens,
  };
};

const addTokenUsage = (
  left: ITtscEvidenceBenchmarkTokenUsage,
  right: ITtscEvidenceBenchmarkTokenUsage,
): ITtscEvidenceBenchmarkTokenUsage => ({
  totalTokens: left.totalTokens + right.totalTokens,
  inputTokens: left.inputTokens + right.inputTokens,
  cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
  cacheWriteInputTokens:
    left.cacheWriteInputTokens + right.cacheWriteInputTokens,
  outputTokens: left.outputTokens + right.outputTokens,
  reasoningOutputTokens:
    left.reasoningOutputTokens + right.reasoningOutputTokens,
});

const emptyTokenUsage = (): ITtscEvidenceBenchmarkTokenUsage => ({
  totalTokens: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteInputTokens: 0,
  outputTokens: 0,
  reasoningOutputTokens: 0,
});

const stageMeasurements = (
  state: IDashboardState,
  totalElapsed: number,
  detached: boolean,
  suspensions: readonly ITtscEvidenceBenchmarkReportSuspension[],
  observedElapsed: ReadonlyMap<string, number>,
): IStageMeasurement[] => {
  const current: IDashboardInstruction | undefined =
    state.goals.find(
      (instruction) => instruction.index === state.nextInstructionIndex,
    ) ??
    (state.status === "completed" ||
    state.status === "checkpointed" ||
    state.status === "awaiting-review-verdict" ||
    state.status === "quality-failed" ||
    state.status === "awaiting-supervision" ||
    state.status === "rejected"
      ? undefined
      : state.goals.at(-1));
  const retainedTokens: number = state.goals.reduce(
    (sum, instruction) =>
      sum +
      (!detached ||
      instruction.index >= (state.nativeThreadStartInstructionIndex ?? 0)
        ? instruction.tokenUsage.totalTokens
        : 0),
    0,
  );
  const retainedElapsed: number = state.goals.reduce(
    (sum, instruction) =>
      sum + correctedInstructionElapsed(state, instruction, suspensions),
    0,
  );
  const activeTokens: number = Math.max(
    0,
    state.threadTokenUsage.totalTokens - retainedTokens,
  );
  // Where the stream says how long each objective held the thread, that is the
  // measurement. `activeElapsed` is the fallback for a run whose stream cannot
  // be read, and it hands every unattributed millisecond to the current stage —
  // which reports a stage as having run longer than it existed as soon as an
  // earlier turn is killed, because a killed turn contributes nothing to its
  // own Goal's `elapsedMs`.
  const observedTotal: number = [...observedElapsed.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const observed: boolean = state.goals.every((instruction) =>
    observedElapsed.has(instruction.name),
  );
  const activeElapsed: number = Math.max(0, totalElapsed - retainedElapsed);
  const unobserved: number = Math.max(0, totalElapsed - observedTotal);
  const inspections: Map<number, IStageMeasurement> = inspectionByGoal(state);
  return state.goals.map((instruction) => {
    const inspected: IStageMeasurement | undefined = inspections.get(
      instruction.index,
    );
    return {
      name: instruction.name,
      tokens:
        instruction.tokenUsage.totalTokens +
        (instruction === current ? activeTokens : 0) +
        (inspected?.tokens ?? 0),
      elapsedMs: observed
        ? (observedElapsed.get(instruction.name) ?? 0) +
          (instruction === current ? unobserved : 0) +
          (inspected?.elapsedMs ?? 0)
        : correctedInstructionElapsed(state, instruction, suspensions) +
          (instruction === current ? activeElapsed : 0) +
          (inspected?.elapsedMs ?? 0),
    };
  });
};

/**
 * Attributes each inspection to the Goal it judged.
 *
 * An inspection exists because one Review attempt completed, so its cost
 * belongs to that attempt's stage. Anything else would leave the stage shares
 * summing to less than the cell total they are shares of.
 */
const inspectionByGoal = (
  state: IDashboardState,
): Map<number, IStageMeasurement> => {
  const found: Map<number, IStageMeasurement> = new Map();
  for (const pause of state.supervisionPauses ?? []) {
    if (
      pause.goalIndex === undefined ||
      !state.goals.some((goal) => goal.index === pause.goalIndex)
    )
      continue;
    for (const inspection of pause.inspections ?? []) {
      const retained: IStageMeasurement = found.get(pause.goalIndex) ?? {
        name: "",
        tokens: 0,
        elapsedMs: 0,
      };
      found.set(pause.goalIndex, {
        name: "",
        tokens: retained.tokens + inspection.tokenUsage.totalTokens,
        elapsedMs: retained.elapsedMs + inspection.elapsedMs,
      });
    }
  }
  return found;
};

/** Totals what judging this cell's Reviews cost, separately from the cell. */
const inspectionCost = (
  state: IDashboardState,
): ITtscEvidenceBenchmarkReportInspection =>
  (state.supervisionPauses ?? [])
    .flatMap((pause) =>
      pause.goalIndex === undefined ||
      !state.goals.some((goal) => goal.index === pause.goalIndex)
        ? []
        : (pause.inspections ?? []),
    )
    .reduce<ITtscEvidenceBenchmarkReportInspection>(
      (total, inspection) => ({
        attempts: total.attempts + 1,
        failures: total.failures + (inspection.failure === undefined ? 0 : 1),
        tokenUsage: addTokenUsage(total.tokenUsage, inspection.tokenUsage),
        elapsedMs: total.elapsedMs + inspection.elapsedMs,
      }),
      { attempts: 0, failures: 0, tokenUsage: emptyTokenUsage(), elapsedMs: 0 },
    );

const correctedInstructionElapsed = (
  state: IDashboardState,
  instruction: IDashboardInstruction,
  suspensions: readonly ITtscEvidenceBenchmarkReportSuspension[],
): number => {
  const suspendedMs: number = suspensions.reduce(
    (sum, suspension) =>
      sum +
      (suspension.instructionIndex === instruction.index
        ? suspension.elapsedMs
        : 0),
    0,
  );
  const retainedMs: number = retainedInstructionElapsed(state, instruction);
  if (suspendedMs > retainedMs)
    throw new Error(
      `Benchmark suspension exceeds retained instruction time: ${instruction.name}.`,
    );
  return retainedMs - suspendedMs;
};

const retainedInstructionElapsed = (
  state: IDashboardState,
  instruction: IDashboardInstruction,
): number => {
  if (instruction.index >= state.nextInstructionIndex)
    return instruction.elapsedMs;
  const cumulative: number | undefined = instruction.goal?.timeUsedSeconds;
  const previous: IDashboardInstruction | undefined = state.goals.find(
    (candidate) => candidate.index === instruction.index - 1,
  );
  const baseline: number | undefined =
    instruction.index === 0 ||
    instruction.index === state.nativeThreadStartInstructionIndex
      ? 0
      : previous?.goal?.timeUsedSeconds;
  return cumulative !== undefined &&
    baseline !== undefined &&
    Number.isFinite(cumulative) &&
    Number.isFinite(baseline) &&
    cumulative >= baseline
    ? (cumulative - baseline) * 1_000
    : instruction.elapsedMs;
};

const stageName = (state: IDashboardState): string | null => {
  const records: IDashboardInstruction[] = state.goals;
  const instruction: IDashboardInstruction | undefined =
    records.find((record) => record.index === state.nextInstructionIndex) ??
    records.at(-1);
  return instruction?.name ?? null;
};

const formatStage = (cell: ITtscEvidenceBenchmarkReportCell): string =>
  cell.stage === null ? cell.status : `\`${cell.stage}\` · ${cell.status}`;

const inspectWorktree = (
  workspace: string,
): ITtscEvidenceBenchmarkReportWorktree => {
  const baseline: string = git(workspace, [
    "rev-list",
    "--max-parents=0",
    "HEAD",
  ]).trim();
  if (baseline.length === 0)
    throw new Error(`Benchmark workspace has no baseline commit: ${workspace}`);
  const gitDirectory: string = path.resolve(
    workspace,
    git(workspace, ["rev-parse", "--git-dir"]).trim(),
  );
  const temporary: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "evidence-dashboard-"),
  );
  const index: string = path.join(temporary, "index");
  try {
    fs.copyFileSync(path.join(gitDirectory, "index"), index);
    const environment: NodeJS.ProcessEnv = { GIT_INDEX_FILE: index };
    git(workspace, ["add", "--intent-to-add", "--", "."], environment);
    const numstat: string = git(
      workspace,
      ["diff", "--numstat", baseline, "--"],
      environment,
    );
    let files: number = 0;
    let additions: number = 0;
    let deletions: number = 0;
    for (const line of numstat.split(/\r?\n/u)) {
      if (line.length === 0) continue;
      const [added, deleted] = line.split("\t", 3);
      if (added === undefined || deleted === undefined)
        throw new Error(`Invalid git numstat line: ${line}`);
      ++files;
      if (added !== "-") {
        additions += Number(added);
        deletions += Number(deleted);
      }
    }
    return { files, additions, deletions };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
};

/**
 * Whether a git failure is the workspace changing underneath the query.
 *
 * The dashboard reads a workspace while its cell is still building in it, so a
 * file git enumerated can be gone by the time git stats it. A NestJS or Nestia
 * runtime scratch file lives for milliseconds and is named with the writing
 * process's own pid, which is exactly the shape that loses this race.
 *
 * It is a property of reading a live tree, not of the tree being wrong, so the
 * query is retried rather than reported. Retrying is safe because the query
 * only reads.
 */
const isTransientWorktreeRace = (stderr: string): boolean =>
  /fatal: stat '[^']*': No such file or directory/.test(stderr) ||
  /fatal: Unable to create '[^']*index\.lock'/.test(stderr);

const git = (
  workspace: string,
  args: string[],
  environment: NodeJS.ProcessEnv = {},
  attempt: number = 0,
): string => {
  const result = spawnSync(
    "git",
    [
      "-c",
      "core.quotepath=false",
      "--no-optional-locks",
      "-C",
      workspace,
      ...args,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", ...environment },
      windowsHide: true,
      // A workspace that accumulates an untracked dependency tree produces a
      // diff far past Node's default pipe buffer, and the overflow arrives as
      // a spawn error with a null status rather than a failed exit. Without
      // room and an explicit check, the dashboard either dies or reports the
      // truncated half it managed to read.
      maxBuffer: 512 * 1024 * 1024,
    },
  );
  if (result.error !== undefined)
    throw new Error(
      `Git dashboard query could not run (${args.join(" ")}): ${result.error.message}`,
    );
  if (result.status !== 0) {
    if (attempt < 2 && isTransientWorktreeRace(result.stderr))
      return git(workspace, args, environment, attempt + 1);
    throw new Error(
      `Git dashboard query failed (${args.join(" ")}): ${result.stderr}`,
    );
  }
  return result.stdout;
};

const formatDelta = (delta: ITtscEvidenceBenchmarkReportWorktree): string =>
  `${delta.files} files · +${compact(delta.additions)}/−${compact(delta.deletions)} LOC`;

const formatCost = (tokens: number): string =>
  `${Math.round(tokens / 1_000_000)}M`;

const percent = (part: number, total: number): number =>
  total === 0 ? 0 : Math.round((part / total) * 100);

const elapsed = (file: IDashboardStateFile): number => {
  const unresolved: Set<number> = new Set(
    file.state.processes.flatMap((process, index) =>
      process.exitCode === null && process.signal === null ? [index] : [],
    ),
  );
  const observed: Map<number, IOutputEvent> = readLastOutputEvents(
    file.records.events,
    unresolved,
  );
  return (
    (file.state.inheritedProcessElapsedMs ?? 0) +
    file.state.processes.reduce(
      (sum, process, index) =>
        sum +
        (process.exitCode !== null || process.signal !== null
          ? process.elapsedMs
          : Math.max(process.elapsedMs, observed.get(index)?.elapsedMs ?? 0)),
      0,
    )
  );
};

const readLastOutputEvents = (
  file: string,
  targets: ReadonlySet<number>,
): Map<number, IOutputEvent> => {
  const found: Map<number, IOutputEvent> = new Map();
  if (!fs.existsSync(file) || targets.size === 0) return found;
  const descriptor: number = fs.openSync(file, "r");
  try {
    const size: number = fs.fstatSync(descriptor).size;
    let position: number = size;
    let suffix: string = "";
    while (position > 0) {
      const length: number = Math.min(64 * 1024, position);
      position -= length;
      const buffer: Buffer = Buffer.alloc(length);
      fs.readSync(descriptor, buffer, 0, length, position);
      const lines: string[] = `${buffer.toString("utf8")}${suffix}`.split("\n");
      const firstComplete: number = position === 0 ? 0 : 1;
      for (let i: number = lines.length - 1; i >= firstComplete; --i) {
        const candidate: string = lines[i]!.trim();
        if (candidate.length === 0) continue;
        try {
          const value: unknown = JSON.parse(candidate);
          if (
            isOutputEvent(value) &&
            targets.has(value.processIndex) &&
            !found.has(value.processIndex)
          )
            found.set(value.processIndex, value);
          if (found.size === targets.size) return found;
        } catch {
          // The writer may have an incomplete final line; use the last complete event.
        }
      }
      suffix = lines[0]!;
    }
    return found;
  } finally {
    fs.closeSync(descriptor);
  }
};

const isOutputEvent = (value: unknown): value is IOutputEvent =>
  isRecord(value) &&
  typeof value.processIndex === "number" &&
  typeof value.elapsedMs === "number";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const formatTime = (elapsedMs: number): string => {
  const minutes: number = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
};

const compact = (value: number): string => {
  if (value < 1_000) return String(value);
  if (value < 1_000_000)
    return `${stripTrailingZero((value / 1_000).toFixed(1))}k`;
  return `${stripTrailingZero((value / 1_000_000).toFixed(1))}M`;
};

const stripTrailingZero = (value: string): string => value.replace(/\.0$/u, "");

const title = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const displayModel = (model: string): string =>
  model
    .replace(/^gpt-/iu, "GPT-")
    .replace(/-([^-]+)$/u, (_, family: string) => `-${title(family)}`);
