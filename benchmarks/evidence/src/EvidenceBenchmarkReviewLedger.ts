import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { EvidenceBenchmarkToolchain } from "./EvidenceBenchmarkToolchain";
import type { ITtscEvidenceBenchmarkGoalRecord } from "./structures/ITtscEvidenceBenchmarkGoalRecord";
import type {
  ITtscEvidenceBenchmarkReviewCalibration,
  ITtscEvidenceBenchmarkReviewCommand,
  ITtscEvidenceBenchmarkReviewEdit,
  ITtscEvidenceBenchmarkReviewLedger,
  ITtscEvidenceBenchmarkReviewManifestEntry,
  ITtscEvidenceBenchmarkReviewRound,
} from "./structures/ITtscEvidenceBenchmarkReviewLedger";
import type { ITtscEvidenceBenchmarkRunState } from "./structures/ITtscEvidenceBenchmarkRunState";

interface IToolCall {
  tool: string;
  arguments: unknown;
  callId: string;
  turnId: string;
}

interface IToolResult {
  contentItems: { type: "inputText"; text: string }[];
  success: boolean;
}

type ReviewCommand = ITtscEvidenceBenchmarkReviewCommand["command"];
type ReviewCommandPhase = ITtscEvidenceBenchmarkReviewCommand["phase"];
type ReviewEditPhase = ITtscEvidenceBenchmarkReviewEdit["phase"];

interface IReviewReplacement {
  oldText: string;
  newText: string;
}

interface ICommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
  timedOut: boolean;
  outputLimited: boolean;
  cleanupForced: boolean;
  watchClean: boolean;
  watchErrors: boolean;
}

const CONFIGURATION_PATHS = [
  ".node-version",
  "config/lint.config.ts",
  "config/package.json",
  "config/tsconfig.json",
  "package.json",
  "packages/api/lint.config.ts",
  "packages/api/package.json",
  "packages/api/tsconfig.json",
  "packages/backend/.env.example",
  "packages/backend/lint.config.ts",
  "packages/backend/nestia.config.ts",
  "packages/backend/package.json",
  "packages/backend/prisma.config.ts",
  "packages/backend/tsconfig.json",
  "pnpm-workspace.yaml",
] as const;

/** Owns backend review reads, edits, processes, and proof outside self-report. */
export namespace EvidenceBenchmarkReviewLedger {
  export const tools = (): Record<string, unknown>[] => [
    {
      type: "function",
      name: "review_start_round",
      description:
        "Start the mandatory runner-owned backend review round. It creates the fresh canonical manifest. Shell inventories and self-authored manifests receive no review credit.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      type: "function",
      name: "review_read_file",
      description:
        "Read exactly the next file in the active runner-owned review manifest. This is the only file-read mechanism that receives review credit.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { path: { type: "string" } },
        required: ["path"],
      },
    },
    {
      type: "function",
      name: "review_finish_round",
      description:
        "Finish the active runner-owned round after every manifest file was returned and the workspace stayed unchanged. Report findings, a pre-calibration clean candidate, or dry.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          result: {
            type: "string",
            enum: ["findings", "clean", "dry"],
          },
          findings: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["result", "findings"],
      },
    },
    {
      type: "function",
      name: "review_start_calibration",
      description:
        "Seal the exact reviewed workspace before the mandatory fail-restore-pass calibration. Break one material behavior only after this call.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    },
    {
      type: "function",
      name: "review_edit_file",
      description:
        "Apply one runner-validated direct backend source edit. This is the only direct edit mechanism during backend review; it is blocked until a full round is sealed with findings or calibration authorizes it.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          operation: {
            type: "string",
            enum: ["replace", "create", "delete"],
          },
          phase: {
            type: "string",
            enum: ["correction", "calibration-break", "calibration-restore"],
          },
          path: { type: "string" },
          expectedSha256: { type: "string" },
          replacements: {
            type: "array",
            minItems: 1,
            maxItems: 32,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                oldText: { type: "string" },
                newText: { type: "string" },
              },
              required: ["oldText", "newText"],
            },
          },
          content: { type: "string" },
        },
        required: ["operation", "phase", "path"],
      },
    },
    {
      type: "function",
      name: "review_run_backend_command",
      description:
        "Run one bounded backend generator or gate under runner-owned process-tree serialization. An undetected calibration break is invalidated and automatically rolled back to sealed bytes. Native shell execution receives no gate credit.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: {
            type: "string",
            enum: [
              "build-prisma",
              "build-main",
              "schema",
              "build-sdk",
              "build-test",
              "check-watch",
              "lint",
              "format",
              "test",
            ],
          },
          phase: {
            type: "string",
            enum: [
              "correction",
              "calibration-fail",
              "calibration-pass",
              "final",
            ],
          },
        },
        required: ["command", "phase"],
      },
    },
  ];

  export async function handle(props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
    onChange?: () => Promise<void>;
    signal?: AbortSignal;
  }): Promise<IToolResult> {
    if (
      props.goal.name !== "backend-review" &&
      props.goal.name !== "backend-final"
    )
      return failure(
        "The backend review ledger is available only during backend-review and backend-final.",
      );
    if (props.call.tool === "review_start_round") return startRound(props);
    if (props.call.tool === "review_read_file") return readFile(props);
    if (props.call.tool === "review_finish_round") return finishRound(props);
    if (props.call.tool === "review_start_calibration")
      return startCalibration(props);
    if (props.call.tool === "review_edit_file") return editFile(props);
    if (props.call.tool === "review_run_backend_command")
      return runBackendCommand(props);
    return failure(`Unknown review ledger tool: ${props.call.tool}`);
  }

  /** Rejects native shell concurrency and lifecycle commands during review. */
  export function observeNativeCommand(props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    method: "item/started" | "item/completed";
    item: Record<string, unknown>;
    active: Set<string>;
  }): void {
    if (
      props.goal.name !== "backend-review" &&
      props.goal.name !== "backend-final"
    )
      return;
    if (props.item.type !== "commandExecution") return;
    const id: unknown = props.item.id;
    if (typeof id !== "string")
      throw new Error("Codex emitted a command without a stable item ID.");
    if (props.method === "item/completed") {
      props.active.delete(id);
      return;
    }
    const runnerCommand: ITtscEvidenceBenchmarkReviewCommand | undefined =
      props.state.reviewLedgers
        ?.find((ledger) => ledger.goalIndex === props.goal.index)
        ?.commands?.findLast((entry) => entry.status === "running");
    if (runnerCommand !== undefined)
      throw new Error(
        `Codex started native command ${id} while runner-owned backend command ${runnerCommand.index} remained active.`,
      );
    if (props.active.size !== 0)
      throw new Error(
        `Codex started command ${id} while ${[...props.active].join(", ")} remained active.`,
      );
    const command: unknown = props.item.command;
    if (typeof command !== "string")
      throw new Error("Codex emitted a command without exact command text.");
    if (isBackendLifecycleCommand(command))
      throw new Error(
        "Backend generators and gates must run through review_run_backend_command, not the native shell.",
      );
    if (isBackendResidentCommand(command)) {
      if (props.goal.name !== "backend-final")
        throw new Error(
          "The resident backend dev server is allowed only after Backend Final proof.",
        );
      assertDry({ cwd: props.cwd, state: props.state, goal: props.goal });
      return;
    }
    props.active.add(id);
  }

  export function assertDry(props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
  }): void {
    if (
      props.goal.name !== "backend-review" &&
      props.goal.name !== "backend-final"
    )
      return;
    const ledger: ITtscEvidenceBenchmarkReviewLedger | undefined =
      props.state.reviewLedgers?.find(
        (candidate) => candidate.goalIndex === props.goal.index,
      );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger?.rounds.at(-1);
    if (round === undefined || round.status !== "dry")
      throw new Error(
        `${props.goal.name} completed without a runner-owned dry review round.`,
      );
    const current = manifest(props.cwd);
    if (current.sha256 !== round.manifestSha256)
      throw new Error(
        `${props.goal.name} changed after its runner-owned dry review round.`,
      );
    const ledgerCommands: ITtscEvidenceBenchmarkReviewCommand[] =
      ledger?.commands ?? [];
    const finalCommands: ITtscEvidenceBenchmarkReviewCommand[] =
      ledgerCommands.filter(
        (command) =>
          command.phase === "final" &&
          command.startedAt >= (round.finishedAt ?? "") &&
          command.manifestSha256 === round.manifestSha256,
      );
    const watcher: ITtscEvidenceBenchmarkReviewCommand | undefined =
      finalCommands.at(-2);
    const test: ITtscEvidenceBenchmarkReviewCommand | undefined =
      finalCommands.at(-1);
    if (
      watcher?.command !== "check-watch" ||
      watcher.status !== "succeeded" ||
      test?.command !== "test" ||
      test.status !== "succeeded"
    )
      throw new Error(
        `${props.goal.name} completed without runner-owned unchanged check-watch and test gates after its dry round.`,
      );
  }

  const startRound = (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
  }): IToolResult => {
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const previous: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    const current = manifest(props.cwd);
    if (previous?.status === "reading") {
      if (previous.manifestSha256 === current.sha256)
        return failure(
          `Round ${previous.index} is still active at ${previous.reads.length}/${previous.manifest.length} reads. Finish it before starting another round.`,
        );
      fatalRound(
        previous,
        "The scoped workspace changed before the active round finished.",
      );
    } else if (previous?.status === "dry") {
      if (previous.manifestSha256 === current.sha256)
        return failure(
          `Round ${previous.index} is already dry. Run unchanged final gates and complete the Goal.`,
        );
      fatalRound(
        previous,
        "The scoped workspace changed after the round was declared dry.",
      );
    } else if (previous?.status === "clean") {
      const calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined =
        ledger.calibrations?.at(-1);
      if (
        previous.manifestSha256 === current.sha256 &&
        (calibration?.status !== "passed" ||
          calibration.baselineManifestSha256 !== current.sha256 ||
          calibration.startedAt < (previous.finishedAt ?? ""))
      )
        return failure(
          `Round ${previous.index} is a clean candidate. Complete fail-restore-pass calibration before starting the qualifying round.`,
        );
      if (previous.manifestSha256 !== current.sha256)
        fatalRound(
          previous,
          "The scoped workspace changed after the round was declared clean.",
        );
    }
    const round: ITtscEvidenceBenchmarkReviewRound = {
      index: (previous?.index ?? 0) + 1,
      startedAt: new Date().toISOString(),
      manifestSha256: current.sha256,
      manifest: current.entries,
      reads: [],
      status: "reading",
    };
    ledger.rounds.push(round);
    return success(
      [
        `RUNNER REVIEW ROUND ${round.index}`,
        `manifest-sha256: ${round.manifestSha256}`,
        `files: ${round.manifest.length}`,
        "Read only through review_read_file, exactly in this order:",
        ...round.manifest.map((entry) => entry.path),
      ].join("\n"),
    );
  };

  const readFile = (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
  }): IToolResult => {
    const values: Record<string, unknown> | undefined = record(
      props.call.arguments,
    );
    if (typeof values?.path !== "string")
      return failure("review_read_file requires one string path.");
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    if (round === undefined || round.status !== "reading")
      return failure("No runner-owned review round is active.");
    const current = manifest(props.cwd);
    if (current.sha256 !== round.manifestSha256) {
      fatalRound(
        round,
        "The scoped workspace changed during the reading phase.",
      );
    }
    const expected = round.manifest[round.reads.length];
    if (expected === undefined)
      return failure(
        "Every manifest file is already read. Call review_finish_round.",
      );
    if (values.path !== expected.path)
      return failure(
        `Out-of-order review read. Expected exactly ${expected.path}.`,
      );
    const absolute: string = resolveManifestPath(props.cwd, expected.path);
    const bytes: Buffer = fs.readFileSync(absolute);
    const digest: string = sha256(bytes);
    if (bytes.length !== expected.bytes || digest !== expected.sha256) {
      fatalRound(round, `Manifest file changed before read: ${expected.path}`);
    }
    round.reads.push({
      path: expected.path,
      bytes: bytes.length,
      sha256: digest,
      callId: props.call.callId,
      turnId: props.call.turnId,
      readAt: new Date().toISOString(),
    });
    return {
      success: true,
      contentItems: [
        {
          type: "inputText",
          text: `RUNNER REVIEW FILE ${round.reads.length}/${round.manifest.length}\npath: ${expected.path}\nbytes: ${bytes.length}\nsha256: ${digest}`,
        },
        { type: "inputText", text: bytes.toString("utf8") },
      ],
    };
  };

  const finishRound = (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
  }): IToolResult => {
    const values: Record<string, unknown> | undefined = record(
      props.call.arguments,
    );
    const result: unknown = values?.result;
    const findings: unknown = values?.findings;
    if (
      (result !== "findings" && result !== "clean" && result !== "dry") ||
      !Array.isArray(findings) ||
      findings.some(
        (finding) => typeof finding !== "string" || finding.trim().length === 0,
      )
    )
      return failure(
        "review_finish_round requires result=findings|clean|dry and string findings.",
      );
    const normalized: string[] = findings.map((finding) =>
      (finding as string).trim(),
    );
    if (
      ((result === "clean" || result === "dry") && normalized.length !== 0) ||
      (result === "findings" && normalized.length === 0)
    )
      return failure(
        "A clean or dry round must have zero findings; a findings round must report at least one.",
      );
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    if (round === undefined || round.status !== "reading")
      return failure("No runner-owned review round is active.");
    if (round.reads.length !== round.manifest.length)
      return failure(
        `The active round has only ${round.reads.length}/${round.manifest.length} credited reads.`,
      );
    const current = manifest(props.cwd);
    if (current.sha256 !== round.manifestSha256) {
      fatalRound(
        round,
        "The scoped workspace changed before the round finished.",
      );
    }
    if (result === "dry") {
      const calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined =
        ledger.calibrations?.at(-1);
      if (
        calibration?.status !== "passed" ||
        calibration.baselineManifestSha256 !== round.manifestSha256 ||
        calibration.passCommandIndex === undefined ||
        calibration.startedAt >= round.startedAt
      )
        return failure(
          "A dry round requires a runner-proven fail-restore-pass calibration against the same scope before this round started.",
        );
    }
    round.status = result;
    round.findings = normalized;
    round.finishedAt = new Date().toISOString();
    return success(
      result === "dry"
        ? `Round ${round.index} is externally sealed dry at ${round.manifestSha256}. Keep the scoped workspace unchanged through final gates and Goal completion.`
        : result === "clean"
          ? `Round ${round.index} is a pre-calibration clean candidate at ${round.manifestSha256}. Calibrate, then perform a fresh full round that may be sealed dry.`
          : `Round ${round.index} is sealed with ${normalized.length} finding(s). Fix every authored consequence only through review_edit_file, run affected generators and gates separately, then calibrate and start a new full round.`,
    );
  };

  const startCalibration = (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
  }): IToolResult => {
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    if (round === undefined)
      return failure(
        "Complete and finish one full review round before calibration.",
      );
    if (round?.status === "reading")
      return failure(
        "Finish the active runner-owned reading round before calibration.",
      );
    if (round?.status === "dry")
      return failure(
        "Calibration must precede the qualifying dry round, not follow it.",
      );
    if (round.status === "invalid")
      return failure(
        "Complete a fresh full review round before calibration; the latest round is invalid.",
      );
    let current = manifest(props.cwd);
    if (round.status === "clean" && round.manifestSha256 !== current.sha256) {
      fatalRound(
        round,
        "The scoped workspace changed after the round was declared clean.",
      );
    }
    const previous: ITtscEvidenceBenchmarkReviewCalibration | undefined =
      ledger.calibrations?.at(-1);
    if (previous !== undefined && previous.status !== "passed") {
      if (
        previous.status === "invalid" &&
        previous.restoredManifestSha256 !== previous.baselineManifestSha256
      )
        return failure(
          "The previous invalid calibration lacks a runner-proven exact rollback; this workspace cannot start another calibration.",
        );
      if (previous.status !== "invalid") {
        try {
          restoreCalibration(props.cwd, previous, "runner");
        } catch (error) {
          invalidateCalibration(
            previous,
            `A new calibration could not roll back the unfinished calibration: ${errorMessage(error)}`,
          );
          throw new Error(
            `Fatal backend review calibration rollback failure: ${errorMessage(error)}`,
          );
        }
        invalidateCalibration(
          previous,
          "A new calibration replaced the unfinished calibration after exact runner rollback.",
        );
      }
    }
    current = manifest(props.cwd);
    const calibration: ITtscEvidenceBenchmarkReviewCalibration = {
      index: (previous?.index ?? 0) + 1,
      startedAt: new Date().toISOString(),
      baselineManifestSha256: current.sha256,
      status: "sealed",
    };
    ledger.calibrations!.push(calibration);
    return success(
      [
        `RUNNER CALIBRATION ${calibration.index}`,
        `baseline-manifest-sha256: ${calibration.baselineManifestSha256}`,
        "Use exactly one review_edit_file call with phase=calibration-break to break one material reviewed behavior, then call review_run_backend_command with command=test and phase=calibration-fail.",
        "Use review_edit_file with phase=calibration-restore to restore the exact baseline manifest, then call the command tool with command=test and phase=calibration-pass before starting a fresh full round.",
      ].join("\n"),
    );
  };

  const editFile = async (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
    onChange?: () => Promise<void>;
  }): Promise<IToolResult> => {
    const values: Record<string, unknown> | undefined = record(
      props.call.arguments,
    );
    const operation: unknown = values?.operation;
    const phase: unknown = values?.phase;
    const relative: unknown = values?.path;
    if (
      !isReviewEditOperation(operation) ||
      !isReviewEditPhase(phase) ||
      typeof relative !== "string"
    )
      return failure(
        "review_edit_file requires one allowed operation, phase, and path.",
      );
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    const calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined =
      ledger.calibrations?.at(-1);
    const currentManifestSha256: string = manifest(props.cwd).sha256;
    if (
      round?.status === "reading" &&
      round.manifestSha256 !== currentManifestSha256
    )
      fatalRound(
        round,
        "The scoped workspace changed before a forbidden reading-phase edit request.",
      );
    const phaseFailure: string | undefined = validateEditPhase({
      phase,
      round,
      calibration,
      edits: ledger.edits!,
      currentManifestSha256,
      path: relative,
    });
    if (phaseFailure !== undefined) return failure(phaseFailure);
    let absolute: string;
    try {
      absolute = resolveEditablePath(props.cwd, relative);
    } catch (error) {
      return failure(errorMessage(error));
    }
    const before: Buffer | undefined = fs.existsSync(absolute)
      ? fs.readFileSync(absolute)
      : undefined;
    const beforeMode: number | undefined =
      before === undefined ? undefined : fs.statSync(absolute).mode;
    const expectedSha256: unknown = values?.expectedSha256;
    const replacements: IReviewReplacement[] | undefined = reviewReplacements(
      values?.replacements,
    );
    const content: unknown = values?.content;
    const argumentFailure: string | undefined = validateEditArguments({
      operation,
      before,
      expectedSha256,
      replacements,
      content,
    });
    if (argumentFailure !== undefined) return failure(argumentFailure);
    let after: Buffer | undefined;
    if (operation === "replace") {
      let output: string = before!.toString("utf8");
      if (!Buffer.from(output, "utf8").equals(before!))
        return failure("review_edit_file replace requires a UTF-8 text file.");
      for (const replacement of replacements!) {
        const occurrences: number = countOccurrences(
          output,
          replacement.oldText,
        );
        if (occurrences !== 1)
          return failure(
            `Replacement oldText must occur exactly once; observed ${occurrences}.`,
          );
        output = output.replace(replacement.oldText, replacement.newText);
      }
      after = Buffer.from(output, "utf8");
    } else if (operation === "create")
      after = Buffer.from(content as string, "utf8");
    if ((after?.length ?? 0) > 4 * 1024 * 1024)
      return failure("review_edit_file output exceeds the 4 MiB limit.");
    if (phase === "calibration-break") {
      calibration!.breakSnapshot = {
        path: relative,
        existed: before !== undefined,
        ...(before === undefined
          ? {}
          : { contentBase64: before.toString("base64"), mode: beforeMode }),
      };
      await props.onChange?.();
    }
    try {
      writeEdit(absolute, after);
      const current = manifest(props.cwd);
      if (
        phase === "calibration-restore" &&
        current.sha256 !== calibration!.baselineManifestSha256
      )
        throw new Error(
          "Calibration restore did not reproduce the exact sealed manifest.",
        );
    } catch (error) {
      writeEdit(absolute, before);
      if (phase === "calibration-break") {
        delete calibration!.breakSnapshot;
        await props.onChange?.();
      }
      return failure(errorMessage(error));
    }
    if (phase === "calibration-restore")
      recordCalibrationRestore(
        calibration!,
        manifest(props.cwd).sha256,
        "agent",
      );
    const entry: ITtscEvidenceBenchmarkReviewEdit = {
      index: ledger.edits!.length + 1,
      operation,
      phase,
      path: relative,
      roundIndex: round!.index,
      ...(phase === "correction" || calibration === undefined
        ? {}
        : { calibrationIndex: calibration.index }),
      callId: props.call.callId,
      turnId: props.call.turnId,
      editedAt: new Date().toISOString(),
      ...(before === undefined
        ? {}
        : { beforeBytes: before.length, beforeSha256: sha256(before) }),
      ...(after === undefined
        ? {}
        : { afterBytes: after.length, afterSha256: sha256(after) }),
    };
    ledger.edits!.push(entry);
    await props.onChange?.();
    return success(
      [
        `RUNNER REVIEW EDIT ${entry.index}`,
        `operation: ${entry.operation}`,
        `phase: ${entry.phase}`,
        `path: ${entry.path}`,
        `before-sha256: ${entry.beforeSha256 ?? "absent"}`,
        `after-sha256: ${entry.afterSha256 ?? "absent"}`,
      ].join("\n"),
    );
  };

  const runBackendCommand = async (props: {
    cwd: string;
    state: ITtscEvidenceBenchmarkRunState;
    goal: ITtscEvidenceBenchmarkGoalRecord;
    call: IToolCall;
    onChange?: () => Promise<void>;
    signal?: AbortSignal;
  }): Promise<IToolResult> => {
    const values: Record<string, unknown> | undefined = record(
      props.call.arguments,
    );
    const command: unknown = values?.command;
    const phase: unknown = values?.phase;
    if (!isReviewCommand(command) || !isReviewCommandPhase(phase))
      return failure(
        "review_run_backend_command requires one allowed command and phase.",
      );
    const ledger: ITtscEvidenceBenchmarkReviewLedger = getLedger(
      props.state,
      props.goal,
    );
    const round: ITtscEvidenceBenchmarkReviewRound | undefined =
      ledger.rounds.at(-1);
    if (round?.status === "reading") {
      const current = manifest(props.cwd);
      if (current.sha256 !== round.manifestSha256)
        fatalRound(
          round,
          "The scoped workspace changed before a forbidden reading-phase backend command.",
        );
      return failure(
        "Runner-owned backend commands are forbidden during a reading phase.",
      );
    }
    const current = manifest(props.cwd);
    const calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined =
      ledger.calibrations?.at(-1);
    const validation: string | undefined = validateCommandPhase({
      command,
      phase,
      round,
      calibration,
      currentManifestSha256: current.sha256,
      commands: ledger.commands!,
    });
    if (validation !== undefined) return failure(validation);
    const entry: ITtscEvidenceBenchmarkReviewCommand = {
      index: ledger.commands!.length + 1,
      command,
      phase,
      callId: props.call.callId,
      turnId: props.call.turnId,
      startedAt: new Date().toISOString(),
      manifestSha256: current.sha256,
      status: "running",
    };
    ledger.commands!.push(entry);
    await props.onChange?.();
    const outcome: ICommandResult = await executeBackendCommand(
      props.cwd,
      command,
      (processId) => {
        entry.processId = processId;
        return props.onChange?.();
      },
      props.signal,
    );
    const combined: Buffer = Buffer.concat([
      Buffer.from("stdout\n", "utf8"),
      outcome.stdout,
      Buffer.from("\nstderr\n", "utf8"),
      outcome.stderr,
    ]);
    entry.finishedAt = new Date().toISOString();
    entry.exitCode = outcome.exitCode;
    entry.signal = outcome.signal;
    entry.outputBytes = combined.length;
    entry.outputSha256 = sha256(combined);
    entry.outputLimited = outcome.outputLimited;
    entry.cleanupForced = outcome.cleanupForced;
    const expectedFailure: boolean = phase === "calibration-fail";
    const actualSuccess: boolean =
      command === "check-watch"
        ? outcome.watchClean &&
          !outcome.watchErrors &&
          !outcome.timedOut &&
          !outcome.outputLimited
        : outcome.exitCode === 0 && !outcome.timedOut && !outcome.outputLimited;
    const normalExpectedFailure: boolean =
      !outcome.timedOut &&
      !outcome.outputLimited &&
      outcome.signal === null &&
      outcome.exitCode !== null &&
      outcome.exitCode !== 0;
    const accepted: boolean = expectedFailure
      ? normalExpectedFailure
      : actualSuccess;
    entry.status = outcome.timedOut
      ? "timed-out"
      : accepted
        ? expectedFailure
          ? "expected-failure"
          : "succeeded"
        : "failed";
    if (phase === "calibration-fail" && calibration !== undefined) {
      if (entry.status === "expected-failure") {
        calibration.status = "failure-proven";
        calibration.failureCommandIndex = entry.index;
      } else {
        const reason =
          "The deliberately broken behavior did not produce a bounded failing test.";
        try {
          restoreCalibration(props.cwd, calibration, "runner");
        } catch (error) {
          invalidateCalibration(
            calibration,
            `${reason} Automatic rollback failed: ${errorMessage(error)}`,
          );
          await props.onChange?.();
          throw new Error(
            `Fatal backend review calibration rollback failure: ${errorMessage(error)}`,
          );
        }
        invalidateCalibration(
          calibration,
          `${reason} The runner restored the exact sealed baseline; begin a new calibration.`,
        );
      }
    } else if (phase === "calibration-pass" && calibration !== undefined) {
      if (entry.status === "succeeded") {
        calibration.status = "passed";
        calibration.passCommandIndex = entry.index;
      } else
        invalidateCalibration(
          calibration,
          "The exact restored baseline did not pass its bounded test.",
        );
    } else if (phase === "final" && entry.status !== "succeeded") {
      if (round?.status === "dry")
        invalidate(round, `Runner-owned final gate failed: ${command}.`);
    }
    await props.onChange?.();
    const transcript: string = [
      `RUNNER BACKEND COMMAND ${entry.index}`,
      `command: ${command}`,
      `phase: ${phase}`,
      `status: ${entry.status}`,
      `exit-code: ${String(entry.exitCode)}`,
      `signal: ${String(entry.signal)}`,
      `output-limited: ${outcome.outputLimited}`,
      `output-bytes: ${entry.outputBytes}`,
      `output-sha256: ${entry.outputSha256}`,
      ...(phase === "calibration-fail" && calibration?.status === "invalid"
        ? [
            `calibration-restore-owner: ${calibration.restoreOwner ?? "failed"}`,
            `calibration-restored-manifest-sha256: ${calibration.restoredManifestSha256 ?? "failed"}`,
          ]
        : []),
      "stdout:",
      renderCommandOutput(outcome.stdout),
      "stderr:",
      renderCommandOutput(outcome.stderr),
    ].join("\n");
    return {
      success: accepted,
      contentItems: [{ type: "inputText", text: transcript }],
    };
  };

  const getLedger = (
    state: ITtscEvidenceBenchmarkRunState,
    goal: ITtscEvidenceBenchmarkGoalRecord,
  ): ITtscEvidenceBenchmarkReviewLedger => {
    state.reviewLedgers ??= [];
    let ledger: ITtscEvidenceBenchmarkReviewLedger | undefined =
      state.reviewLedgers.find(
        (candidate) => candidate.goalIndex === goal.index,
      );
    if (ledger === undefined) {
      ledger = {
        goalIndex: goal.index,
        goalName: goal.name as "backend-review" | "backend-final",
        rounds: [],
        edits: [],
        commands: [],
        calibrations: [],
      };
      state.reviewLedgers.push(ledger);
    }
    ledger.edits ??= [];
    ledger.commands ??= [];
    ledger.calibrations ??= [];
    return ledger;
  };

  const manifest = (
    cwd: string,
  ): {
    entries: ITtscEvidenceBenchmarkReviewManifestEntry[];
    sha256: string;
  } => {
    const groups: {
      section: ITtscEvidenceBenchmarkReviewManifestEntry["section"];
      paths: string[];
    }[] = [
      { section: "requirements", paths: listFiles(cwd, "docs/analysis") },
      {
        section: "schema",
        paths: listFiles(cwd, "packages/backend/prisma/schema"),
      },
      {
        section: "api",
        paths: listFiles(cwd, "packages/api/src/structures"),
      },
      {
        section: "backend",
        paths: listFiles(cwd, "packages/backend/src/controllers"),
      },
      { section: "tests", paths: listFiles(cwd, "packages/backend/test") },
      {
        section: "configuration",
        paths: CONFIGURATION_PATHS.map((file) => requiredFile(cwd, file)),
      },
    ];
    const seen: Set<string> = new Set();
    const entries: ITtscEvidenceBenchmarkReviewManifestEntry[] = [];
    for (const group of groups)
      for (const relative of group.paths.sort(comparePaths)) {
        if (seen.has(relative))
          throw new Error(
            `Backend review scope contains a duplicate: ${relative}`,
          );
        seen.add(relative);
        const absolute: string = resolveManifestPath(cwd, relative);
        const bytes: Buffer = fs.readFileSync(absolute);
        entries.push({
          section: group.section,
          path: relative,
          bytes: bytes.length,
          sha256: sha256(bytes),
        });
      }
    return {
      entries,
      sha256: sha256(Buffer.from(JSON.stringify(entries), "utf8")),
    };
  };

  const listFiles = (cwd: string, relative: string): string[] => {
    const root: string = resolveManifestPath(cwd, relative);
    if (!fs.statSync(root).isDirectory())
      throw new Error(`Backend review scope is not a directory: ${relative}`);
    const output: string[] = [];
    const visit = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute: string = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile())
          output.push(path.relative(cwd, absolute).split(path.sep).join("/"));
      }
    };
    visit(root);
    return output;
  };

  const requiredFile = (cwd: string, relative: string): string => {
    const absolute: string = resolveManifestPath(cwd, relative);
    if (!fs.statSync(absolute).isFile())
      throw new Error(`Backend review scope is not a file: ${relative}`);
    return relative;
  };

  const resolveManifestPath = (cwd: string, relative: string): string => {
    if (
      relative.length === 0 ||
      path.isAbsolute(relative) ||
      relative.includes("\\") ||
      relative.split("/").includes("..")
    )
      throw new Error(`Invalid backend review path: ${relative}`);
    const root: string = path.resolve(cwd);
    const absolute: string = path.resolve(root, ...relative.split("/"));
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))
      throw new Error(`Backend review path escapes the workspace: ${relative}`);
    return absolute;
  };

  const resolveEditablePath = (cwd: string, relative: string): string => {
    const allowed: boolean =
      relative.startsWith("packages/backend/prisma/schema/") ||
      relative.startsWith("packages/api/src/structures/") ||
      relative.startsWith("packages/api/src/typings/") ||
      (relative.startsWith("packages/backend/src/") &&
        !relative.startsWith("packages/backend/src/prisma/") &&
        !relative.includes("/prisma/generated/")) ||
      relative.startsWith("packages/backend/test/") ||
      (CONFIGURATION_PATHS as readonly string[]).includes(relative);
    if (!allowed)
      throw new Error(
        `review_edit_file path is outside the authored backend correction scope: ${relative}`,
      );
    const absolute: string = resolveManifestPath(cwd, relative);
    const root: string = path.resolve(cwd);
    const parent: string = path.dirname(absolute);
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory())
      throw new Error(
        `review_edit_file requires an existing parent directory: ${relative}`,
      );
    let cursor: string = root;
    for (const segment of path.relative(root, parent).split(path.sep)) {
      if (segment.length === 0) continue;
      cursor = path.join(cursor, segment);
      if (fs.lstatSync(cursor).isSymbolicLink())
        throw new Error(
          `review_edit_file rejects symbolic-link parents: ${relative}`,
        );
    }
    if (fs.existsSync(absolute)) {
      const stats: fs.Stats = fs.lstatSync(absolute);
      if (stats.isSymbolicLink() || !stats.isFile())
        throw new Error(
          `review_edit_file target must be a regular file: ${relative}`,
        );
    }
    return absolute;
  };

  const invalidate = (
    round: ITtscEvidenceBenchmarkReviewRound,
    reason: string,
  ): void => {
    round.status = "invalid";
    round.invalidatedAt = new Date().toISOString();
    round.invalidation = reason;
  };

  const fatalRound = (
    round: ITtscEvidenceBenchmarkReviewRound,
    reason: string,
  ): never => {
    invalidate(round, reason);
    throw new Error(`Fatal backend review protocol violation: ${reason}`);
  };

  const invalidateCalibration = (
    calibration: ITtscEvidenceBenchmarkReviewCalibration,
    reason: string,
  ): void => {
    calibration.status = "invalid";
    calibration.invalidatedAt = new Date().toISOString();
    calibration.invalidation = reason;
  };

  const recordCalibrationRestore = (
    calibration: ITtscEvidenceBenchmarkReviewCalibration,
    restoredManifestSha256: string,
    owner: "agent" | "runner",
  ): void => {
    calibration.restoredAt = new Date().toISOString();
    calibration.restoredManifestSha256 = restoredManifestSha256;
    calibration.restoreOwner = owner;
    delete calibration.breakSnapshot;
  };

  const restoreCalibration = (
    cwd: string,
    calibration: ITtscEvidenceBenchmarkReviewCalibration,
    owner: "agent" | "runner",
  ): void => {
    const current = manifest(cwd);
    if (current.sha256 === calibration.baselineManifestSha256) {
      recordCalibrationRestore(calibration, current.sha256, owner);
      return;
    }
    const snapshot = calibration.breakSnapshot;
    if (snapshot === undefined)
      throw new Error(
        "The calibration break has no durable rollback snapshot.",
      );
    if (snapshot.existed && snapshot.contentBase64 === undefined)
      throw new Error(
        "The calibration rollback snapshot omits the original file bytes.",
      );
    const absolute = resolveEditablePath(cwd, snapshot.path);
    writeEdit(
      absolute,
      snapshot.existed
        ? Buffer.from(snapshot.contentBase64 ?? "", "base64")
        : undefined,
      snapshot.mode,
    );
    const restored = manifest(cwd);
    if (restored.sha256 !== calibration.baselineManifestSha256)
      throw new Error(
        `Automatic rollback produced manifest ${restored.sha256}, expected ${calibration.baselineManifestSha256}.`,
      );
    recordCalibrationRestore(calibration, restored.sha256, owner);
  };

  const validateCommandPhase = (props: {
    command: ReviewCommand;
    phase: ReviewCommandPhase;
    round: ITtscEvidenceBenchmarkReviewRound | undefined;
    calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined;
    currentManifestSha256: string;
    commands: ITtscEvidenceBenchmarkReviewCommand[];
  }): string | undefined => {
    if (props.phase === "correction") {
      if (props.round?.status !== "findings")
        return "Correction commands require the latest completed round to contain findings.";
      return undefined;
    }
    if (props.phase === "calibration-fail") {
      if (props.command !== "test")
        return "Calibration failure proof must run command=test.";
      if (props.calibration?.status !== "sealed")
        return "Call review_start_calibration before the calibration failure test.";
      if (
        props.calibration.baselineManifestSha256 === props.currentManifestSha256
      )
        return "The calibration workspace still matches its baseline; break one material reviewed behavior first.";
      return undefined;
    }
    if (props.phase === "calibration-pass") {
      if (props.command !== "test")
        return "Calibration restore proof must run command=test.";
      if (props.calibration?.status !== "failure-proven")
        return "A runner-owned failing calibration test has not been proven.";
      if (
        props.calibration.baselineManifestSha256 !== props.currentManifestSha256
      )
        return "The calibration workspace does not match the exact sealed baseline.";
      return undefined;
    }
    if (props.round?.status !== "dry")
      return "Final gates require a current runner-owned dry round.";
    if (props.round.manifestSha256 !== props.currentManifestSha256)
      return "The workspace changed after the dry round.";
    const finalCommands: ITtscEvidenceBenchmarkReviewCommand[] =
      props.commands.filter(
        (entry) =>
          entry.phase === "final" &&
          entry.startedAt >= (props.round?.finishedAt ?? ""),
      );
    if (finalCommands.length === 0 && props.command !== "check-watch")
      return "The first final gate must be command=check-watch.";
    if (
      finalCommands.length === 1 &&
      (finalCommands[0]!.command !== "check-watch" ||
        finalCommands[0]!.status !== "succeeded" ||
        props.command !== "test")
    )
      return "A successful check-watch must be followed by command=test.";
    if (finalCommands.length >= 2)
      return "The unchanged final check-watch and test sequence is already recorded.";
    return undefined;
  };

  const validateEditPhase = (props: {
    phase: ReviewEditPhase;
    round: ITtscEvidenceBenchmarkReviewRound | undefined;
    calibration: ITtscEvidenceBenchmarkReviewCalibration | undefined;
    edits: ITtscEvidenceBenchmarkReviewEdit[];
    currentManifestSha256: string;
    path: string;
  }): string | undefined => {
    if (props.round === undefined)
      return "Complete and seal a full review round before editing.";
    if (props.round.status === "reading")
      return "File edits are forbidden during the runner-owned reading phase.";
    if (props.round.status === "invalid")
      return "The latest review round is invalid; this benchmark run cannot receive edit credit.";
    if (props.round.status === "dry")
      return "File edits are forbidden after a dry round.";
    const calibrationForRound: boolean =
      props.calibration !== undefined &&
      props.calibration.startedAt >= (props.round.finishedAt ?? "");
    if (props.phase === "correction") {
      if (props.round.status !== "findings")
        return "Correction edits require the latest completed round to contain findings.";
      if (calibrationForRound && props.calibration?.status !== "invalid")
        return "Correction edits are closed after calibration starts; begin the next full round.";
      return undefined;
    }
    if (!calibrationForRound || props.calibration === undefined)
      return "Call review_start_calibration after the latest completed round before calibration edits.";
    const calibrationEdits: ITtscEvidenceBenchmarkReviewEdit[] =
      props.edits.filter(
        (edit) => edit.calibrationIndex === props.calibration!.index,
      );
    const broken: ITtscEvidenceBenchmarkReviewEdit | undefined =
      calibrationEdits.find((edit) => edit.phase === "calibration-break");
    const restored: ITtscEvidenceBenchmarkReviewEdit | undefined =
      calibrationEdits.find((edit) => edit.phase === "calibration-restore");
    if (props.phase === "calibration-break") {
      if (props.calibration.status !== "sealed")
        return "Calibration break is allowed only immediately after the baseline is sealed.";
      if (broken !== undefined)
        return "Exactly one runner-owned calibration break edit is allowed.";
      if (
        props.currentManifestSha256 !== props.calibration.baselineManifestSha256
      )
        return "The workspace no longer matches the sealed calibration baseline.";
      return undefined;
    }
    if (props.calibration.status !== "failure-proven")
      return "Calibration restore requires a runner-proven failing test.";
    if (broken === undefined || restored !== undefined)
      return "Calibration restore requires exactly one unrestored runner-owned break edit.";
    if (broken.path !== props.path)
      return `Calibration restore must target the broken file: ${broken.path}`;
    return undefined;
  };

  const validateEditArguments = (props: {
    operation: ITtscEvidenceBenchmarkReviewEdit["operation"];
    before: Buffer | undefined;
    expectedSha256: unknown;
    replacements: IReviewReplacement[] | undefined;
    content: unknown;
  }): string | undefined => {
    if (props.operation === "create") {
      if (props.before !== undefined)
        return "review_edit_file create requires an absent target.";
      if (
        props.expectedSha256 !== undefined ||
        props.replacements !== undefined ||
        typeof props.content !== "string"
      )
        return "Create requires content and forbids expectedSha256 and replacements.";
      return undefined;
    }
    if (props.before === undefined)
      return `${props.operation} requires an existing regular file.`;
    if (
      typeof props.expectedSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(props.expectedSha256)
    )
      return `${props.operation} requires an exact lowercase SHA-256 precondition.`;
    if (sha256(props.before) !== props.expectedSha256)
      return "review_edit_file rejected a stale expectedSha256 precondition.";
    if (props.operation === "delete")
      return props.replacements === undefined && props.content === undefined
        ? undefined
        : "Delete forbids replacements and content.";
    if (props.replacements === undefined || props.content !== undefined)
      return "Replace requires 1-32 exact replacements and forbids content.";
    if (
      props.replacements.some(
        (replacement) =>
          replacement.oldText.length === 0 ||
          replacement.oldText === replacement.newText,
      )
    )
      return "Every replacement requires non-empty oldText different from newText.";
    const payloadBytes: number = props.replacements.reduce(
      (sum, replacement) =>
        sum +
        Buffer.byteLength(replacement.oldText, "utf8") +
        Buffer.byteLength(replacement.newText, "utf8"),
      0,
    );
    return payloadBytes <= 1024 * 1024
      ? undefined
      : "Replacement payload exceeds the 1 MiB limit.";
  };

  const executeBackendCommand = async (
    cwd: string,
    command: ReviewCommand,
    onStarted: (processId: number) => void | Promise<void>,
    signal?: AbortSignal,
  ): Promise<ICommandResult> => {
    const invocation = EvidenceBenchmarkToolchain.pnpmInvocation([
      "run",
      commandScript(command),
    ]);
    const backend: string = path.join(cwd, "packages", "backend");
    const timeoutMs: number =
      command === "build-sdk" ? 10 * 60_000 : 5 * 60_000;
    const outputLimit: number = 4 * 1024 * 1024;
    return new Promise<ICommandResult>((resolve, reject) => {
      const child = spawn(invocation.binary, invocation.args, {
        cwd: backend,
        env: process.env,
        detached: process.platform !== "win32",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      if (child.pid === undefined) {
        reject(new Error("Runner-owned backend command omitted its PID."));
        return;
      }
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputBytes = 0;
      let timedOut = false;
      let outputLimited = false;
      let cleanupForced = false;
      let watchClean = false;
      let watchErrors = false;
      let watchOutput = "";
      let cleanup: Promise<void> = Promise.resolve();
      let stopping = false;
      const stop = (): Promise<void> => {
        if (stopping) return cleanup;
        stopping = true;
        cleanupForced = true;
        cleanup = terminateProcessTree(child.pid!);
        return cleanup;
      };
      const abort = (): void => {
        void stop();
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted === true) abort();
      const append = (target: Buffer[], chunk: Buffer | string): void => {
        const value: Buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk, "utf8");
        target.push(value);
        outputBytes += value.length;
        if (command === "check-watch") {
          watchOutput = `${watchOutput}${value.toString("utf8")}`.slice(
            -65_536,
          );
          if (
            /(?:^|\r?\n)(?:\d{1,2}:\d{2}:\d{2}(?:\s+[AP]M)?\s+-\s+)?Found\s+0\s+errors?\.\s+Watching for file changes\.(?:\r?\n|$)/iu.test(
              watchOutput,
            )
          ) {
            watchClean = true;
            void stop();
          } else if (
            /(?:^|\r?\n)(?:\d{1,2}:\d{2}:\d{2}(?:\s+[AP]M)?\s+-\s+)?Found\s+[1-9][0-9]*\s+errors?\.\s+Watching for file changes\.(?:\r?\n|$)/iu.test(
              watchOutput,
            )
          ) {
            watchErrors = true;
            void stop();
          }
        }
        if (outputBytes > outputLimit) {
          outputLimited = true;
          void stop();
        }
      };
      child.stdout!.on("data", (chunk: Buffer) => append(stdout, chunk));
      child.stderr!.on("data", (chunk: Buffer) => append(stderr, chunk));
      child.once("error", reject);
      void Promise.resolve(onStarted(child.pid)).catch(
        async (error: unknown) => {
          await stop();
          reject(error);
        },
      );
      const timer: NodeJS.Timeout = setTimeout(() => {
        timedOut = true;
        void stop();
      }, timeoutMs);
      child.once("close", async (exitCode, exitSignal) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        await cleanup;
        resolve({
          exitCode,
          signal: exitSignal,
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr),
          timedOut,
          outputLimited,
          cleanupForced,
          watchClean,
          watchErrors,
        });
      });
    });
  };

  const terminateProcessTree = async (processId: number): Promise<void> => {
    if (process.platform !== "win32") {
      try {
        process.kill(-processId, "SIGKILL");
      } catch {
        try {
          process.kill(processId, "SIGKILL");
        } catch {
          // The bounded command exited between observation and cleanup.
        }
      }
      return;
    }
    await new Promise<void>((resolve) => {
      const cleanup = spawn(
        "taskkill.exe",
        ["/pid", String(processId), "/T", "/F"],
        {
          shell: false,
          stdio: "ignore",
          windowsHide: true,
        },
      );
      cleanup.once("error", () => resolve());
      cleanup.once("close", () => resolve());
    });
  };

  const commandScript = (command: ReviewCommand): string =>
    command === "build-prisma"
      ? "build:prisma"
      : command === "build-main"
        ? "build:main"
        : command === "build-sdk"
          ? "build:sdk"
          : command === "build-test"
            ? "build:test"
            : command === "check-watch"
              ? "check:watch"
              : command;

  const isReviewCommand = (value: unknown): value is ReviewCommand =>
    value === "build-prisma" ||
    value === "build-main" ||
    value === "schema" ||
    value === "build-sdk" ||
    value === "build-test" ||
    value === "check-watch" ||
    value === "lint" ||
    value === "format" ||
    value === "test";

  const isReviewEditOperation = (
    value: unknown,
  ): value is ITtscEvidenceBenchmarkReviewEdit["operation"] =>
    value === "replace" || value === "create" || value === "delete";

  const isReviewEditPhase = (value: unknown): value is ReviewEditPhase =>
    value === "correction" ||
    value === "calibration-break" ||
    value === "calibration-restore";

  const reviewReplacements = (
    value: unknown,
  ): IReviewReplacement[] | undefined => {
    if (!Array.isArray(value) || value.length === 0 || value.length > 32)
      return undefined;
    const output: IReviewReplacement[] = [];
    for (const candidate of value) {
      const entry: Record<string, unknown> | undefined = record(candidate);
      if (
        entry === undefined ||
        Object.keys(entry).some(
          (key) => key !== "oldText" && key !== "newText",
        ) ||
        typeof entry.oldText !== "string" ||
        typeof entry.newText !== "string"
      )
        return undefined;
      output.push({ oldText: entry.oldText, newText: entry.newText });
    }
    return output;
  };

  const countOccurrences = (text: string, needle: string): number => {
    let count = 0;
    let cursor = 0;
    while (cursor <= text.length - needle.length) {
      const found: number = text.indexOf(needle, cursor);
      if (found === -1) break;
      count++;
      cursor = found + needle.length;
    }
    return count;
  };

  const writeEdit = (
    absolute: string,
    bytes: Buffer | undefined,
    mode?: number,
  ): void => {
    if (bytes === undefined) {
      fs.rmSync(absolute);
      return;
    }
    if (!fs.existsSync(absolute)) {
      fs.writeFileSync(absolute, bytes, {
        flag: "wx",
        ...(mode === undefined ? {} : { mode }),
      });
      return;
    }
    const temporary: string = path.join(
      path.dirname(absolute),
      `.benchmark-edit-${crypto.randomUUID()}.tmp`,
    );
    try {
      fs.writeFileSync(temporary, bytes, {
        flag: "wx",
        mode: fs.statSync(absolute).mode,
      });
      fs.renameSync(temporary, absolute);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  };

  const isReviewCommandPhase = (value: unknown): value is ReviewCommandPhase =>
    value === "correction" ||
    value === "calibration-fail" ||
    value === "calibration-pass" ||
    value === "final";

  const isBackendLifecycleCommand = (command: string): boolean => {
    return shellSegments(command).some((segment) => {
      const tokens: string[] = shellTokens(segment);
      if (tokens.length === 0) return false;
      const executable: string = executableName(tokens[0]!);
      if (executable === "powershell" || executable === "pwsh") {
        const commandIndex: number = tokens.findIndex(
          (token, index) =>
            index > 0 && (token.toLowerCase() === "-command" || token === "-c"),
        );
        return (
          commandIndex !== -1 &&
          isBackendLifecycleCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (executable === "cmd") {
        const commandIndex: number = tokens.findIndex(
          (token, index) => index > 0 && token.toLowerCase() === "/c",
        );
        return (
          commandIndex !== -1 &&
          isBackendLifecycleCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (["bash", "sh", "zsh"].includes(executable)) {
        const commandIndex: number = tokens.findIndex(
          (token, index) => index > 0 && /^-[a-z]*c[a-z]*$/iu.test(token),
        );
        return (
          commandIndex !== -1 &&
          isBackendLifecycleCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (["pnpm", "npm", "yarn", "bun"].includes(executable)) {
        const actionIndex: number = skipCommandOptions(tokens, 1);
        const action: string | undefined = tokens[actionIndex]?.toLowerCase();
        if (action === undefined) return false;
        if (action === "run" || action === "run-script")
          return isBackendScript(tokens[actionIndex + 1]);
        if (isBackendScript(action)) return true;
        const toolIndex: number = ["exec", "dlx", "x"].includes(action)
          ? skipCommandOptions(tokens, actionIndex + 1)
          : actionIndex;
        return isBackendTool(tokens.slice(toolIndex));
      }
      if (executable === "npx")
        return isBackendTool(tokens.slice(skipCommandOptions(tokens, 1)));
      return isBackendTool(tokens);
    });
  };

  const isBackendResidentCommand = (command: string): boolean =>
    shellSegments(command).some((segment) => {
      const tokens: string[] = shellTokens(segment);
      if (tokens.length === 0) return false;
      const executable: string = executableName(tokens[0]!);
      if (executable === "powershell" || executable === "pwsh") {
        const commandIndex: number = tokens.findIndex(
          (token, index) =>
            index > 0 && (token.toLowerCase() === "-command" || token === "-c"),
        );
        return (
          commandIndex !== -1 &&
          isBackendResidentCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (executable === "cmd") {
        const commandIndex: number = tokens.findIndex(
          (token, index) => index > 0 && token.toLowerCase() === "/c",
        );
        return (
          commandIndex !== -1 &&
          isBackendResidentCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (["bash", "sh", "zsh"].includes(executable)) {
        const commandIndex: number = tokens.findIndex(
          (token, index) => index > 0 && /^-[a-z]*c[a-z]*$/iu.test(token),
        );
        return (
          commandIndex !== -1 &&
          isBackendResidentCommand(tokens.slice(commandIndex + 1).join(" "))
        );
      }
      if (!["pnpm", "npm", "yarn", "bun"].includes(executable)) return false;
      const actionIndex: number = skipCommandOptions(tokens, 1);
      const action: string | undefined = tokens[actionIndex]?.toLowerCase();
      return action === "dev"
        ? true
        : (action === "run" || action === "run-script") &&
            tokens[actionIndex + 1]?.toLowerCase() === "dev";
    });

  const isBackendScript = (value: string | undefined): boolean =>
    value !== undefined &&
    /^(?:build(?::(?:prisma|sdk|main|test))?|schema|check:watch|test|lint|format)$/u.test(
      value.toLowerCase(),
    );

  const isBackendTool = (tokens: string[]): boolean => {
    const executable: string | undefined = tokens[0];
    if (executable === undefined) return false;
    const name: string = executableName(executable);
    if (name === "prisma") return tokens[1]?.toLowerCase() === "generate";
    if (name === "nestia") return tokens[1]?.toLowerCase() === "all";
    if (name === "ttsc") return true;
    return (
      name === "ttsx" && tokens.slice(1).some((token) => /schema/iu.test(token))
    );
  };

  const skipCommandOptions = (tokens: string[], start: number): number => {
    const optionsWithValues: Set<string> = new Set([
      "--dir",
      "--filter",
      "--prefix",
      "--cwd",
      "-c",
      "-f",
    ]);
    let index: number = start;
    while (tokens[index]?.startsWith("-") === true) {
      const option: string = tokens[index]!.toLowerCase();
      index += 1;
      if (!option.includes("=") && optionsWithValues.has(option)) index += 1;
    }
    return index;
  };

  const executableName = (value: string): string =>
    value
      .split(/[\\/]/u)
      .at(-1)!
      .toLowerCase()
      .replace(/\.(?:cmd|exe)$/u, "");

  const shellSegments = (command: string): string[] => {
    const output: string[] = [];
    let current = "";
    let quote: "'" | '"' | undefined;
    for (let index = 0; index < command.length; index++) {
      const character: string = command[index]!;
      if (character === "`" && index + 1 < command.length) {
        current += `${character}${command[++index]!}`;
      } else if (quote !== undefined) {
        current += character;
        if (character === quote) quote = undefined;
      } else if (character === "'" || character === '"') {
        quote = character;
        current += character;
      } else if (character === ";" || character === "|" || character === "&") {
        if (current.trim().length !== 0) output.push(current);
        current = "";
      } else current += character;
    }
    if (current.trim().length !== 0) output.push(current);
    return output;
  };

  const shellTokens = (command: string): string[] => {
    const output: string[] = [];
    let current = "";
    let quote: "'" | '"' | undefined;
    const push = (): void => {
      if (current.length === 0) return;
      output.push(current);
      current = "";
    };
    for (let index = 0; index < command.length; index++) {
      const character: string = command[index]!;
      if (character === "`" && index + 1 < command.length)
        current += command[++index]!;
      else if (quote !== undefined) {
        if (character === quote) quote = undefined;
        else current += character;
      } else if (character === "'" || character === '"') quote = character;
      else if (/\s/u.test(character)) push();
      else current += character;
    }
    push();
    return output;
  };

  const success = (text: string): IToolResult => ({
    contentItems: [{ type: "inputText", text }],
    success: true,
  });

  const failure = (text: string): IToolResult => ({
    contentItems: [{ type: "inputText", text }],
    success: false,
  });

  const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : undefined;

  const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

  const comparePaths = (x: string, y: string): number =>
    x < y ? -1 : x > y ? 1 : 0;

  const sha256 = (value: Buffer): string =>
    crypto.createHash("sha256").update(value).digest("hex");

  const renderCommandOutput = (value: Buffer): string => {
    const limit: number = 64 * 1024;
    if (value.length <= limit) return value.toString("utf8");
    const head: Buffer = value.subarray(0, 16 * 1024);
    const tail: Buffer = value.subarray(value.length - 48 * 1024);
    return `${head.toString("utf8")}\n... runner omitted ${value.length - head.length - tail.length} output bytes ...\n${tail.toString("utf8")}`;
  };
}
