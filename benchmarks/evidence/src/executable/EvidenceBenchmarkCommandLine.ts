import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import typia from "typia";

import { EvidenceBenchmarkCheckpoint } from "../EvidenceBenchmarkCheckpoint";
import { EvidenceBenchmarkInstruction } from "../EvidenceBenchmarkInstruction";
import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";
import { EvidenceBenchmarkRunner } from "../EvidenceBenchmarkRunner";
import { EvidenceBenchmarkRuntime } from "../EvidenceBenchmarkRuntime";
import { EvidenceBenchmarkStageLog } from "../EvidenceBenchmarkStageLog";
import { EvidenceBenchmarkToolchain } from "../EvidenceBenchmarkToolchain";
import { EvidenceBenchmarkWorkspace } from "../EvidenceBenchmarkWorkspace";
import { sanitizeBenchmarkEnvironment } from "../sanitizeBenchmarkEnvironment";
import type { ITtscEvidenceBenchmarkCheckpoint } from "../structures/ITtscEvidenceBenchmarkCheckpoint";
import type { ITtscEvidenceBenchmarkInputIdentity } from "../structures/ITtscEvidenceBenchmarkInputIdentity";
import type { ITtscEvidenceBenchmarkOutput } from "../structures/ITtscEvidenceBenchmarkOutput";
import type { ITtscEvidenceBenchmarkRunState } from "../structures/ITtscEvidenceBenchmarkRunState";
import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "../structures/ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { ITtscEvidenceBenchmarkWorkspaceResult } from "../structures/ITtscEvidenceBenchmarkWorkspaceResult";
import type { EvidenceBenchmarkArm } from "../typings/EvidenceBenchmarkArm";
import type { EvidenceBenchmarkEffort } from "../typings/EvidenceBenchmarkEffort";

type EvidenceBenchmarkEngine = "codex";
type EvidenceBenchmarkState = ITtscEvidenceBenchmarkRunState;

interface ITtscEvidenceBenchmarkArguments {
  engine: EvidenceBenchmarkEngine;
  subject: string;
  arm: EvidenceBenchmarkArm;
  model: string;
  effort: EvidenceBenchmarkEffort;
  runId?: string;
  checkpointRunId?: string;
  stopAfter?: "backend-start";
  reviewLedger?: "backend";
}

interface ITtscEvidenceBenchmarkCell {
  engine: EvidenceBenchmarkEngine;
  subject: string;
  arm: EvidenceBenchmarkArm;
  runId: string;
  benchmarkRevision: string;
  evidenceArtifactSha256?: string;
  toolchainArtifacts?: ITtscEvidenceBenchmarkToolchainArtifact[];
  model: string;
  effort: EvidenceBenchmarkEffort;
  runtime?: EvidenceBenchmarkRuntime.IAssignment;
  launchedAt?: string;
  inputIdentity?: ITtscEvidenceBenchmarkInputIdentity;
  instructionExtension?: {
    fromInstructionIndex: number;
    inputIdentity: ITtscEvidenceBenchmarkInputIdentity;
    runnerRevision: string;
  };
  checkpointSource?: {
    runId: string;
    name: "backend-start";
    inheritedWallElapsedMs: number;
    instructionSurfaceSha256?: string;
  };
  stopAfter?: "backend-start";
  reviewLedger?: "backend";
}

/**
 * One locally packed workspace package a cell measured, as retained.
 *
 * A launch packs this repository's own toolchain instead of letting the
 * measured workspace install a published release, so the run record has to say
 * which packages that covered and which bytes each one was. Without it a report
 * can only claim the workspace used the tree under test.
 */
interface ITtscEvidenceBenchmarkToolchainArtifact {
  /** Package name the prepared workspace resolves to the archive. */
  name: string;

  /** Archive location inside the workspace, POSIX-relative to its root. */
  dependency: string;

  /** Lowercase hexadecimal SHA-256 of the archive as it was installed. */
  sha256: string;
}

interface ITtscEvidenceBenchmarkRecordPaths {
  root: string;
  workspace: string;
  state: string;
  events: string;
}

interface ITtscEvidenceBenchmarkStateFile {
  cell: ITtscEvidenceBenchmarkCell;
  records: ITtscEvidenceBenchmarkRecordPaths;
  state: EvidenceBenchmarkState;
}

const EVIDENCE_BENCHMARK_PACKAGE_NAME = "@ttsc/evidence";

const main = async (): Promise<void> => {
  const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
  const options: ITtscEvidenceBenchmarkArguments =
    parseEvidenceBenchmarkArguments(process.argv.slice(2));
  const runnerRevision: string = readEvidenceBenchmarkRevision(repository);
  const inputIdentity: ITtscEvidenceBenchmarkInputIdentity =
    EvidenceBenchmarkCheckpoint.identifyInputs({
      repository,
      subject: options.subject,
      arm: options.arm,
    });
  const requestedCell: ITtscEvidenceBenchmarkCell = {
    engine: options.engine,
    subject: options.subject,
    arm: options.arm,
    runId: options.runId ?? crypto.randomUUID(),
    benchmarkRevision: runnerRevision,
    model: options.model,
    effort: options.effort,
    runtime: EvidenceBenchmarkRuntime.assign(options.subject, options.arm),
    inputIdentity,
    stopAfter: options.stopAfter,
    reviewLedger: options.reviewLedger,
  };
  const output: string = path.join(
    EvidenceBenchmarkLayout.assetsRoot(repository),
    "output",
    requestedCell.subject,
    requestedCell.engine,
    requestedCell.arm,
    "runs",
    requestedCell.runId,
  );
  const retainedState: string = path.join(output, "state.json");
  const stateExists: boolean = fs.existsSync(retainedState);
  const retained: ITtscEvidenceBenchmarkStateFile | undefined =
    shouldResumeEvidenceBenchmark({
      runId: options.runId,
      stopAfter: options.stopAfter,
      stateExists,
    })
      ? typia.assert<ITtscEvidenceBenchmarkStateFile>(
          JSON.parse(fs.readFileSync(retainedState, "utf8")),
        )
      : undefined;
  const checkpointSource: ITtscEvidenceBenchmarkStateFile | undefined =
    options.checkpointRunId === undefined
      ? undefined
      : readStateFile(
          evidenceBenchmarkOutputPath(
            repository,
            options.subject,
            options.engine,
            options.arm,
            options.checkpointRunId,
          ),
        );
  const records: ITtscEvidenceBenchmarkRecordPaths =
    evidenceBenchmarkRecordPaths(output);
  if (
    retained !== undefined &&
    !sameEvidenceBenchmarkRecordPaths(retained.records, records)
  )
    throw new Error("Retained benchmark record paths do not match the run.");
  const cell: ITtscEvidenceBenchmarkCell = retained?.cell ?? requestedCell;
  if (
    cell.engine !== requestedCell.engine ||
    cell.subject !== requestedCell.subject ||
    cell.arm !== requestedCell.arm ||
    cell.model !== requestedCell.model ||
    cell.effort !== requestedCell.effort ||
    cell.runId !== requestedCell.runId ||
    cell.stopAfter !== requestedCell.stopAfter ||
    cell.reviewLedger !== requestedCell.reviewLedger ||
    (cell.runtime !== undefined &&
      !EvidenceBenchmarkRuntime.equals(cell.runtime, requestedCell.runtime))
  )
    throw new Error("Retained benchmark cell does not match the invocation.");
  if (retained !== undefined)
    assertEvidenceBenchmarkRecoveryRevision(
      repository,
      cell.benchmarkRevision,
      runnerRevision,
    );
  if (
    retained !== undefined &&
    !sameInputIdentity(
      cell.instructionExtension?.inputIdentity ?? retained.cell.inputIdentity,
      inputIdentity,
    )
  ) {
    // Repository inputs drift whenever the operator commits a correction the
    // benchmark skill tells them to commit while a cohort runs. A cohort needs
    // more than one such correction, so a second drift records over the first
    // rather than locking the cell out of its own continuation. The retained
    // revision and digests stay in `state.json`, which is what the report
    // reads, and `fromInstructionIndex` keeps pointing at the first extended
    // instruction.
    cell.instructionExtension = {
      fromInstructionIndex:
        cell.instructionExtension?.fromInstructionIndex ??
        retained.state.nextInstructionIndex,
      inputIdentity,
      runnerRevision,
    };
  }
  if (
    retained !== undefined &&
    ((cell.arm === "evidence" &&
      !/^[0-9a-f]{64}$/i.test(cell.evidenceArtifactSha256 ?? "")) ||
      (cell.arm === "plain" && cell.evidenceArtifactSha256 !== undefined))
  )
    throw new Error(
      "Retained benchmark cell has an invalid artifact identity.",
    );

  if (retained !== undefined) {
    if (retained.state.status === "checkpointed")
      throw new Error(
        "Checkpoint-only runs cannot resume; derive a run from backend-start.",
      );
    // A run retained under the earlier behaviour, where a scope that exhausted
    // its supplementations ended the cell. Its boundary is already decided and
    // its plan already points at that scope's Final, so it resumes there and
    // finishes the remaining scopes. The verdicts keep saying the review was
    // never proven; the downstream work stops being absent.
    if (
      cell.checkpointSource !== undefined &&
      retained.state.nativeThreadStartInstructionIndex === undefined
    ) {
      retained.state.nativeThreadStartInstructionIndex = 1;
      const review = retained.state.goals.find((goal) => goal.index === 1);
      const timeUsedSeconds: unknown = review?.goal?.timeUsedSeconds;
      if (
        review?.goal?.status === "complete" &&
        typeof timeUsedSeconds === "number" &&
        Number.isFinite(timeUsedSeconds) &&
        timeUsedSeconds >= 0
      )
        review.elapsedMs = timeUsedSeconds * 1_000;
    }
    assertRegularFile(records.state);
    if (cell.runtime !== undefined)
      await EvidenceBenchmarkRuntime.assertAvailable([cell.runtime]);
    await runBenchmark(cell, records, retained.state, runnerRevision);
    return;
  }

  if (checkpointSource !== undefined) {
    await runFromBackendStartCheckpoint({
      repository,
      runnerRevision,
      requestedCell,
      source: checkpointSource,
      records,
    });
    return;
  }

  // Both arms pack the toolchain, so the staging directory is unconditional
  // where it used to exist for the Evidence archive alone.
  const temporary: string = fs.mkdtempSync(
    path.join(os.tmpdir(), "evidence-benchmark-"),
  );
  const archive: string | undefined =
    cell.arm === "evidence" ? path.join(temporary, "evidence.tgz") : undefined;
  let prepared: ITtscEvidenceBenchmarkWorkspaceResult;
  try {
    await EvidenceBenchmarkRuntime.assertAvailable([cell.runtime!]);
    const toolchain: ITtscEvidenceBenchmarkWorkspaceArtifact[] =
      await EvidenceBenchmarkToolchain.pack(repository, temporary);
    cell.toolchainArtifacts = toolchain.map((artifact) => ({
      name: artifact.name,
      dependency: `.benchmark-deps/${path.basename(artifact.archive)}`,
      sha256: sha256(artifact.archive),
    }));
    if (archive !== undefined) {
      const retainedArchive: string | undefined =
        process.env.EVIDENCE_BENCHMARK_ARCHIVE;
      if (retainedArchive === undefined)
        await EvidenceBenchmarkToolchain.packPackage(
          repository,
          "packages/evidence",
          archive,
        );
      else {
        const source: string = path.resolve(retainedArchive);
        if (!fs.statSync(source).isFile())
          throw new Error(
            "EVIDENCE_BENCHMARK_ARCHIVE must name a regular file.",
          );
        fs.copyFileSync(source, archive);
      }
      cell.evidenceArtifactSha256 = sha256(archive);
    }
    prepared = await EvidenceBenchmarkWorkspace.prepareWorkspace({
      repository,
      output,
      project: cell.subject,
      arm: cell.arm,
      variables: {
        name: `benchmark-${cell.subject}`,
        apiPackageName: `@benchmark/${cell.subject}-api`,
        backendPackageName: `@benchmark/${cell.subject}-backend`,
        frontendPackageName: `@benchmark/${cell.subject}-frontend`,
      },
      artifact:
        archive === undefined
          ? undefined
          : {
              name: EVIDENCE_BENCHMARK_PACKAGE_NAME,
              archive,
            },
      toolchain,
    });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  if (
    !sameEvidenceBenchmarkRecordPaths(
      records,
      evidenceBenchmarkRecordPaths(prepared.root),
    )
  )
    throw new Error("Prepared benchmark workspace has an invalid path.");
  initializeAppendOnly(records.events);
  await runBenchmark(
    cell,
    records,
    EvidenceBenchmarkRunner.create(cell.arm),
    runnerRevision,
  );
};

const runFromBackendStartCheckpoint = async (props: {
  repository: string;
  runnerRevision: string;
  requestedCell: ITtscEvidenceBenchmarkCell;
  source: ITtscEvidenceBenchmarkStateFile;
  records: ITtscEvidenceBenchmarkRecordPaths;
}): Promise<void> => {
  const sourceCell: ITtscEvidenceBenchmarkCell = props.source.cell;
  const requested: ITtscEvidenceBenchmarkCell = props.requestedCell;
  if (
    sourceCell.engine !== requested.engine ||
    sourceCell.subject !== requested.subject ||
    sourceCell.arm !== requested.arm ||
    sourceCell.model !== requested.model ||
    sourceCell.effort !== requested.effort
  )
    throw new Error("Checkpoint source cell does not match the invocation.");
  const sourceRoot: string = evidenceBenchmarkOutputPath(
    props.repository,
    sourceCell.subject,
    sourceCell.engine,
    sourceCell.arm,
    sourceCell.runId,
  );
  if (
    !sameEvidenceBenchmarkRecordPaths(
      props.source.records,
      evidenceBenchmarkRecordPaths(sourceRoot),
    )
  )
    throw new Error("Checkpoint source record paths do not match the run.");
  if (
    (sourceCell.arm === "evidence" &&
      !/^[0-9a-f]{64}$/i.test(sourceCell.evidenceArtifactSha256 ?? "")) ||
    (sourceCell.arm === "plain" &&
      sourceCell.evidenceArtifactSha256 !== undefined)
  )
    throw new Error("Checkpoint source has an invalid artifact identity.");

  const checkpoint: ITtscEvidenceBenchmarkCheckpoint | undefined =
    props.source.state.checkpoints?.find(
      (candidate) => candidate.name === "backend-start",
    );
  const start = props.source.state.goals.find((goal) => goal.index === 0);
  if (
    checkpoint === undefined ||
    start === undefined ||
    start.name !== "backend-start" ||
    start.goal?.status !== "complete" ||
    start.goal.threadId !== checkpoint.sourceSessionId ||
    start.terminalTurnId !== checkpoint.terminalTurnId ||
    !start.terminalTurnCompleted ||
    !start.threadIdle ||
    start.tokenUsageTurnId !== start.terminalTurnId ||
    start.tokenUsageEnd === null ||
    props.source.state.sessionId !== checkpoint.sourceSessionId ||
    checkpoint.cliVersion !== props.source.state.cliVersion
  )
    throw new Error("Checkpoint source lacks an exact backend-start boundary.");
  requested.benchmarkRevision = sourceCell.benchmarkRevision;
  requested.evidenceArtifactSha256 = sourceCell.evidenceArtifactSha256;
  // The derived run restores the source workspace rather than preparing one, so
  // it measures the archives that workspace already carries.
  requested.toolchainArtifacts = sourceCell.toolchainArtifacts;
  requested.runtime = sourceCell.runtime;
  if (requested.runtime !== undefined)
    await EvidenceBenchmarkRuntime.assertAvailable([requested.runtime]);
  let workspace: string;
  let restored = false;
  try {
    workspace = EvidenceBenchmarkCheckpoint.restoreWorkspaceSnapshot({
      sourceRunRoot: sourceRoot,
      workspaceRelativePath: checkpoint.workspaceRelativePath,
      workspaceSha256: checkpoint.workspaceSha256,
      destinationRunRoot: props.records.root,
    });
    restored = true;
    await EvidenceBenchmarkWorkspace.installDependencies(workspace);
    EvidenceBenchmarkCheckpoint.assertRestoredWorkspace({
      workspace,
      materialSha256: checkpoint.workspaceMaterialSha256,
      gitHead: checkpoint.workspaceGitHead,
      gitStatus: checkpoint.workspaceGitStatus,
    });
    const instructionSurface: string =
      EvidenceBenchmarkWorkspace.prepareInstructionSurface({
        repository: props.repository,
        arm: requested.arm,
        variables: {
          name: `benchmark-${requested.subject}`,
          apiPackageName: `@benchmark/${requested.subject}-api`,
          backendPackageName: `@benchmark/${requested.subject}-backend`,
          frontendPackageName: `@benchmark/${requested.subject}-frontend`,
        },
      });
    const instructionSurfaceSha256: string = (() => {
      try {
        return EvidenceBenchmarkCheckpoint.applyInstructionSurface({
          workspace,
          source: instructionSurface,
        });
      } finally {
        fs.rmSync(instructionSurface, { recursive: true, force: true });
      }
    })();
    requested.checkpointSource = {
      runId: sourceCell.runId,
      name: "backend-start",
      inheritedWallElapsedMs: checkpoint.inheritedWallElapsedMs,
      instructionSurfaceSha256,
    };
    initializeAppendOnly(props.records.events);
  } catch (error) {
    if (restored)
      fs.rmSync(props.records.root, { recursive: true, force: true });
    throw error;
  }
  const initialState: EvidenceBenchmarkState = {
    arm: requested.arm,
    cliVersion: checkpoint.cliVersion,
    nextInstructionIndex: 1,
    status: "ready",
    instructionPlan: EvidenceBenchmarkInstruction.plan(requested.arm),
    threadTokenUsage:
      requested.reviewLedger === "backend"
        ? emptyTokenUsage()
        : structuredClone(start.tokenUsageEnd),
    nativeThreadStartInstructionIndex: 1,
    goals: [structuredClone(start)],
    checkpoints: [structuredClone(checkpoint)],
    inheritedProcessElapsedMs: checkpoint.inheritedProcessElapsedMs,
    processes: [],
  };
  await runBenchmark(
    requested,
    props.records,
    initialState,
    props.runnerRevision,
    requested.reviewLedger === "backend"
      ? undefined
      : {
          sourceSessionId: checkpoint.sourceSessionId,
          terminalTurnId: checkpoint.terminalTurnId,
        },
  );
};

const runBenchmark = async (
  cell: ITtscEvidenceBenchmarkCell,
  records: ITtscEvidenceBenchmarkRecordPaths,
  initialState: EvidenceBenchmarkState,
  runnerRevision: string,
  fork?: {
    sourceSessionId: string;
    terminalTurnId: string;
  },
): Promise<void> => {
  cell.launchedAt ??= new Date().toISOString();
  if (initialState.arm !== cell.arm)
    throw new Error("Retained benchmark state uses a different arm.");
  assertDirectory(records.root);
  assertDirectory(records.workspace);
  assertRegularFile(records.events);
  if (cell.arm === "evidence") {
    const archive: string = path.join(
      records.workspace,
      ".benchmark-deps",
      "evidence.tgz",
    );
    assertRegularFile(archive);
    if (sha256(archive) !== cell.evidenceArtifactSha256)
      throw new Error("Evidence benchmark artifact no longer matches its SHA.");
  }
  // The toolchain archives decide which compiler every measured command runs,
  // so a resumed or derived run proves they are still the bytes the cell pinned
  // for the same reason the Evidence archive does.
  for (const artifact of cell.toolchainArtifacts ?? []) {
    const archive: string = path.join(
      records.workspace,
      ...artifact.dependency.split("/"),
    );
    assertRegularFile(archive);
    if (sha256(archive) !== artifact.sha256)
      throw new Error(
        `Benchmark toolchain artifact ${artifact.name} no longer matches its SHA.`,
      );
  }
  const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
  const environment: NodeJS.ProcessEnv = sanitizeBenchmarkEnvironment(
    process.env,
  );
  if (cell.runtime !== undefined)
    EvidenceBenchmarkRuntime.apply(environment, cell.runtime);
  const eventDescriptor: number = fs.openSync(records.events, "a");
  // One append-only log per stage, opened when that stage first speaks. A
  // resumed run reopens the file it was interrupted inside and appends, so the
  // bytes already retained are neither lost nor written twice.
  const stageDescriptors: Map<string, number> = new Map();
  const stageDescriptor = (stage: string): number => {
    const retained: number | undefined = stageDescriptors.get(stage);
    if (retained !== undefined) return retained;
    const file: string = EvidenceBenchmarkStageLog.resolve(records.root, stage);
    if (fs.existsSync(file)) assertRegularFile(file);
    const descriptor: number = fs.openSync(file, "a");
    stageDescriptors.set(stage, descriptor);
    return descriptor;
  };
  try {
    const onOutput = (
      processIndex: number,
      output: ITtscEvidenceBenchmarkOutput,
    ): void => {
      fs.writeFileSync(
        eventDescriptor,
        `${JSON.stringify({
          recordedAt: new Date().toISOString(),
          processIndex,
          ...output,
        })}\n`,
        "utf8",
      );
      fs.writeFileSync(stageDescriptor(output.stage), output.text, "utf8");
    };
    const onState = (state: EvidenceBenchmarkState): void => {
      fs.fsyncSync(eventDescriptor);
      for (const descriptor of stageDescriptors.values())
        fs.fsyncSync(descriptor);
      replaceDurably(
        records.state,
        `${JSON.stringify({ cell, records, state }, null, 2)}\n`,
      );
    };
    onState(initialState);
    let state: EvidenceBenchmarkState = initialState;
    for (;;) {
      const result = await EvidenceBenchmarkRunner.run({
        state,
        cwd: records.workspace,
        runRoot: records.root,
        instructionsRoot: path.join(
          EvidenceBenchmarkLayout.assetsRoot(repository),
          "instructions",
        ),
        model: cell.model,
        effort: cell.effort,
        runnerRevision,
        fork,
        stopAfterGoal: cell.stopAfter,
        reviewLedger: cell.reviewLedger,
        environment,
        onOutput,
        onState,
        onCheckpoint: () =>
          EvidenceBenchmarkCheckpoint.createWorkspaceSnapshot({
            runRoot: records.root,
            workspace: records.workspace,
            inheritedWallElapsedMs: Math.max(
              0,
              Date.now() -
                Date.parse(cell.launchedAt ?? new Date().toISOString()),
            ),
          }),
      });
      // The runner decides its own Review boundaries now, so a decided pause is
      // a continuation rather than a stop. Each pass consumes exactly one
      // decision — the next `run` stamps `resumedAt` on it — so the loop
      // advances the cursor every time and cannot spin.
      if (decidedReviewPause(result)) {
        state = result;
        fork = undefined;
        continue;
      }
      if (
        result.status !== "completed" &&
        !(
          result.status === "checkpointed" && cell.stopAfter === "backend-start"
        ) &&
        result.status !== "awaiting-review-verdict" &&
        result.status !== "quality-failed"
      )
        throw new Error(
          "Benchmark run was interrupted; resume the retained run.",
        );
      return;
    }
  } finally {
    fs.fsyncSync(eventDescriptor);
    fs.closeSync(eventDescriptor);
    for (const descriptor of stageDescriptors.values()) {
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor);
    }
  }
};

/** Reports whether a run stopped on a Review boundary it already decided. */
const decidedReviewPause = (state: EvidenceBenchmarkState): boolean => {
  const pause = state.supervisionPauses?.at(-1);
  return (
    state.status === "awaiting-review-verdict" &&
    pause?.verdict !== undefined &&
    pause.resumedAt === undefined
  );
};

const evidenceBenchmarkOutputPath = (
  repository: string,
  subject: string,
  engine: EvidenceBenchmarkEngine,
  arm: EvidenceBenchmarkArm,
  runId: string,
): string =>
  path.join(
    EvidenceBenchmarkLayout.assetsRoot(repository),
    "output",
    subject,
    engine,
    arm,
    "runs",
    runId,
  );

const readStateFile = (root: string): ITtscEvidenceBenchmarkStateFile =>
  typia.assert<ITtscEvidenceBenchmarkStateFile>(
    JSON.parse(fs.readFileSync(path.join(root, "state.json"), "utf8")),
  );

const sameInputIdentity = (
  retained: ITtscEvidenceBenchmarkInputIdentity | undefined,
  current: ITtscEvidenceBenchmarkInputIdentity,
): boolean =>
  retained !== undefined &&
  retained.templateSha256 === current.templateSha256 &&
  retained.requirementsSha256 === current.requirementsSha256 &&
  retained.instructionsSha256 === current.instructionsSha256;

/** Allows a completed retained session to receive only newly appended Goals. */
export const assertAppendOnlyInstructionExtension = (
  arm: EvidenceBenchmarkArm,
  state: ITtscEvidenceBenchmarkRunState,
): void => {
  const currentBase = EvidenceBenchmarkInstruction.plan(arm);
  const retainedPlan =
    state.instructionPlan ?? currentBase.slice(0, state.goals.length);
  const retainedBase = retainedPlan.filter((entry) => entry.kind === "base");
  if (
    state.status !== "completed" ||
    state.nextInstructionIndex !== state.goals.length ||
    state.nextInstructionIndex !== retainedPlan.length ||
    currentBase.length <= retainedBase.length ||
    retainedBase.some(
      (entry, index) =>
        entry.name !== currentBase[index]?.name ||
        entry.relativePath !== currentBase[index]?.relativePath,
    )
  )
    throw new Error(
      "Changed inputs are not an append-only extension of a completed benchmark.",
    );
  for (let index = 0; index < state.nextInstructionIndex; ++index) {
    const entry = retainedPlan[index];
    const goal = state.goals[index];
    if (
      entry === undefined ||
      goal === undefined ||
      goal.index !== index ||
      goal.name !== entry.name ||
      goal.relativePath !== entry.relativePath ||
      goal.goal?.status !== "complete" ||
      goal.terminalTurnId === null ||
      !goal.terminalTurnCompleted ||
      !goal.threadIdle
    )
      throw new Error(
        "Changed inputs do not preserve every completed Goal boundary.",
      );
  }
  state.instructionPlan = [
    ...retainedPlan,
    ...currentBase.slice(retainedBase.length),
  ];
};

export const parseEvidenceBenchmarkArguments = (
  input: readonly string[],
): ITtscEvidenceBenchmarkArguments => {
  if (input.length < 5 || input.length > 8)
    throw new Error(
      "Usage: pnpm start codex <subject> <evidence|plain> <model> <effort> [run-id] [--stop-after-backend-start | --from-backend-start source-run-id] [--review-ledger]",
    );
  const engine: string = input[0]!;
  if (engine !== "codex")
    throw new Error(`Invalid benchmark engine: ${engine}.`);
  const subject: string = input[1]!;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subject))
    throw new Error(`Invalid benchmark subject: ${subject}.`);
  const arm: string = input[2]!;
  if (arm !== "evidence" && arm !== "plain")
    throw new Error(`Invalid benchmark arm: ${arm}.`);
  const model: string = input[3]!;
  if (model.length === 0) throw new Error("Benchmark model cannot be empty.");
  const effort: string = input[4]!;
  if (
    effort !== "low" &&
    effort !== "medium" &&
    effort !== "high" &&
    effort !== "xhigh" &&
    effort !== "max" &&
    effort !== "ultra"
  )
    throw new Error(`Invalid benchmark effort: ${effort}.`);
  const optional: readonly string[] = input.slice(5);
  let runId: string | undefined;
  let checkpointRunId: string | undefined;
  let stopAfter: "backend-start" | undefined;
  let reviewLedger: "backend" | undefined;
  for (let i = 0; i < optional.length; ++i) {
    const argument: string = optional[i]!;
    if (argument === "--from-backend-start") {
      if (checkpointRunId !== undefined || optional[i + 1] === undefined)
        throw new Error("Invalid backend-start checkpoint invocation.");
      checkpointRunId = optional[++i];
    } else if (argument === "--stop-after-backend-start") {
      if (stopAfter !== undefined)
        throw new Error("Duplicate backend-start stop option.");
      stopAfter = "backend-start";
    } else if (argument === "--review-ledger") {
      if (reviewLedger !== undefined)
        throw new Error("Duplicate backend review ledger option.");
      reviewLedger = "backend";
    } else if (runId === undefined) runId = argument;
    else throw new Error(`Unexpected benchmark argument: ${argument}.`);
  }
  if (
    (checkpointRunId !== undefined && stopAfter !== undefined) ||
    (checkpointRunId !== undefined && runId !== undefined) ||
    (reviewLedger !== undefined &&
      (arm !== "plain" ||
        (checkpointRunId === undefined && runId === undefined)))
  )
    throw new Error("Invalid benchmark checkpoint or review-ledger options.");
  if (
    runId !== undefined &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      runId,
    )
  )
    throw new Error(`Invalid benchmark run ID: ${runId}.`);
  if (
    checkpointRunId !== undefined &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      checkpointRunId,
    )
  )
    throw new Error(`Invalid checkpoint source run ID: ${checkpointRunId}.`);
  return {
    engine,
    subject,
    arm,
    model,
    effort,
    runId,
    checkpointRunId,
    stopAfter,
    reviewLedger,
  };
};

const emptyTokenUsage =
  (): ITtscEvidenceBenchmarkRunState["threadTokenUsage"] => ({
    totalTokens: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  });

/** Distinguishes an explicit checkpoint-source launch ID from a retained run. */
export const shouldResumeEvidenceBenchmark = (props: {
  runId?: string;
  stopAfter?: "backend-start";
  stateExists: boolean;
}): boolean => {
  if (props.runId === undefined) return false;
  if (props.stateExists) return true;
  if (props.stopAfter === "backend-start") return false;
  throw new Error("Explicit run ID does not name a retained benchmark.");
};

export const readEvidenceBenchmarkRevision = (repository: string): string => {
  const status = spawnSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    {
      cwd: repository,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (status.status !== 0)
    throw new Error("Unable to inspect the benchmark repository state.");
  if ((status.stdout ?? "").trim().length !== 0)
    throw new Error("Benchmark launch requires a clean repository.");
  const revision = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  const value: string = (revision.stdout ?? "").trim();
  if (revision.status !== 0 || !/^[0-9a-f]{40}$/i.test(value))
    throw new Error("Unable to identify the benchmark repository revision.");
  return value;
};

export const assertEvidenceBenchmarkRecoveryRevision = (
  repository: string,
  benchmarkRevision: string,
  runnerRevision: string,
): void => {
  if (benchmarkRevision === runnerRevision) return;
  const ancestry = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", benchmarkRevision, runnerRevision],
    {
      cwd: repository,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (ancestry.status !== 0)
    throw new Error(
      "Recovery runner revision must descend from the frozen benchmark revision.",
    );
};

const sha256 = (file: string): string =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const initializeAppendOnly = (file: string): void => {
  const descriptor: number = fs.openSync(file, "wx");
  fs.closeSync(descriptor);
};

export const evidenceBenchmarkRecordPaths = (
  root: string,
): ITtscEvidenceBenchmarkRecordPaths => ({
  root: path.resolve(root),
  workspace: path.join(path.resolve(root), "workspace"),
  state: path.join(path.resolve(root), "state.json"),
  events: path.join(path.resolve(root), "events.jsonl"),
});

export const sameEvidenceBenchmarkRecordPaths = (
  left: ITtscEvidenceBenchmarkRecordPaths,
  right: ITtscEvidenceBenchmarkRecordPaths,
): boolean => {
  const normalize = (value: string): string => {
    const resolved: string = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return (
    normalize(left.root) === normalize(right.root) &&
    normalize(left.workspace) === normalize(right.workspace) &&
    normalize(left.state) === normalize(right.state) &&
    normalize(left.events) === normalize(right.events)
  );
};

const assertDirectory = (location: string): void => {
  if (!fs.lstatSync(location).isDirectory())
    throw new Error(`Benchmark path is not a directory: ${location}.`);
};

const assertRegularFile = (location: string): void => {
  if (!fs.lstatSync(location).isFile())
    throw new Error(`Benchmark path is not a regular file: ${location}.`);
};

const replaceDurably = (file: string, content: string): void => {
  const temporary: string = `${file}.${process.pid}.tmp`;
  const descriptor: number = fs.openSync(temporary, "w");
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  fs.renameSync(temporary, file);
};

// Compared against `process.argv[1]` rather than `require.main`, which under
// `ttsx` is the launcher that registers the runtime hooks and never this file,
// so a `require.main === module` guard would refuse to run the command line.
if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === __filename
)
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
