import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import typia from "typia";

import { EvidenceBenchmarkInspection } from "./EvidenceBenchmarkInspection";
import { EvidenceBenchmarkInstruction } from "./EvidenceBenchmarkInstruction";
import { EvidenceBenchmarkReviewLedger } from "./EvidenceBenchmarkReviewLedger";
import { EvidenceBenchmarkRuntime } from "./EvidenceBenchmarkRuntime";
import { EvidenceBenchmarkSupervision } from "./EvidenceBenchmarkSupervision";
import type { ITtscEvidenceBenchmarkCheckpointStorage } from "./structures/ITtscEvidenceBenchmarkCheckpointStorage";
import type { ITtscEvidenceBenchmarkExecutable } from "./structures/ITtscEvidenceBenchmarkExecutable";
import type { ITtscEvidenceBenchmarkGoalRecord } from "./structures/ITtscEvidenceBenchmarkGoalRecord";
import type { ITtscEvidenceBenchmarkInspection } from "./structures/ITtscEvidenceBenchmarkInspection";
import type { ITtscEvidenceBenchmarkInstructionPlanEntry } from "./structures/ITtscEvidenceBenchmarkInstructionPlanEntry";
import type { ITtscEvidenceBenchmarkInterruption } from "./structures/ITtscEvidenceBenchmarkInterruption";
import type { ITtscEvidenceBenchmarkOutput } from "./structures/ITtscEvidenceBenchmarkOutput";
import type { ITtscEvidenceBenchmarkProcessRecord } from "./structures/ITtscEvidenceBenchmarkProcessRecord";
import type { ITtscEvidenceBenchmarkRunProps } from "./structures/ITtscEvidenceBenchmarkRunProps";
import type { ITtscEvidenceBenchmarkRunState } from "./structures/ITtscEvidenceBenchmarkRunState";
import type { ITtscEvidenceBenchmarkTokenUsage } from "./structures/ITtscEvidenceBenchmarkTokenUsage";
import type { EvidenceBenchmarkArm } from "./typings/EvidenceBenchmarkArm";
import type { EvidenceBenchmarkReviewScope } from "./typings/EvidenceBenchmarkReviewScope";

/**
 * Executes the retained Codex Goal sequence for one benchmark cell.
 *
 * The runner sends the arm-owned frozen objectives through one app-server
 * thread, retaining native Goal, terminal-turn, idle, token, process, and
 * raw-stream boundaries without judging or editing the measured application.
 */
export namespace EvidenceBenchmarkRunner {
  const PROCESS_CLEANUP_ERROR =
    "Codex app-server survived forced process-tree cleanup.";

  /**
   * Creates an empty Codex state for the selected experiment arm.
   *
   * No native identity exists until the first app-server thread is created.
   */
  export function create(
    arm: EvidenceBenchmarkArm,
  ): ITtscEvidenceBenchmarkRunState {
    return {
      arm,
      nextInstructionIndex: 0,
      status: "ready",
      threadTokenUsage: zeroUsage(),
      goals: [],
      instructionPlan: EvidenceBenchmarkInstruction.plan(arm),
      checkpoints: [],
      processes: [],
    };
  }

  export async function run(
    props: ITtscEvidenceBenchmarkRunProps,
  ): Promise<ITtscEvidenceBenchmarkRunState> {
    const state: ITtscEvidenceBenchmarkRunState =
      typia.assert<ITtscEvidenceBenchmarkRunState>(
        structuredClone(props.state),
      );
    state.instructionPlan ??=
      state.arm === "plain"
        ? EvidenceBenchmarkInstruction.legacyPlan(state.arm)
        : EvidenceBenchmarkInstruction.plan(state.arm);
    const entries: ITtscEvidenceBenchmarkInstructionPlanEntry[] =
      state.instructionPlan;
    validateInstructionPlan(state, entries);
    const undecidedPause = state.supervisionPauses?.at(-1);
    if (
      state.arm === "plain" &&
      undecidedPause !== undefined &&
      undecidedPause.verdict === undefined &&
      state.status === "running" &&
      state.interruption === undefined
    ) {
      state.status = "awaiting-review-verdict";
      await props.onState?.(structuredClone(state));
      return state;
    }
    if (
      state.arm === "plain" &&
      state.supervisionPauses?.some((pause) => pause.verdict !== undefined)
    ) {
      if (props.runRoot === undefined)
        throw new Error("Plain review history lacks its retained root.");
      EvidenceBenchmarkSupervision.assertHistory(props.runRoot, state);
    }
    if (state.status === "quality-failed") {
      await props.onState?.(structuredClone(state));
      return state;
    }
    if (state.status === "awaiting-review-verdict") {
      if (props.runRoot === undefined)
        throw new Error("Plain review-verdict resume lacks its retained root.");
      // A resume retries an inspection that failed rather than waiting for a
      // hand-written verdict, because the common failures — a spawn that lost
      // a race, a timeout — are transient and an operator adds nothing to
      // them. The attempt bound is what keeps a permanently broken inspector
      // from spending the account one resume at a time; once it is reached,
      // only an operator can move the boundary, and `assertDecided` below says
      // so loudly rather than exiting as though the run had progressed.
      const undecided = state.supervisionPauses?.at(-1);
      if (
        undecided !== undefined &&
        undecided.verdict === undefined &&
        (undecided.inspections?.length ?? 0) <
          EvidenceBenchmarkInspection.ATTEMPT_LIMIT
      ) {
        await inspectReviewBoundary(props.runRoot);
        await props.onState?.(structuredClone(state));
        if (
          state.status !== "awaiting-review-verdict" ||
          state.supervisionPauses?.at(-1)?.verdict === undefined
        )
          return state;
      }
      EvidenceBenchmarkSupervision.assertDecided({
        runRoot: props.runRoot,
        workspace: props.cwd,
        state,
      });
      const pause = state.supervisionPauses?.at(-1);
      const previous = state.goals.find(
        (goal) => goal.index === state.nextInstructionIndex - 1,
      );
      if (
        pause === undefined ||
        pause.resumedAt !== undefined ||
        pause.verdict === undefined ||
        previous === undefined ||
        pause.afterGoal !== previous.name ||
        pause.goalIndex !== previous.index
      )
        throw new Error(
          "Plain review-verdict resume lacks its exact retained Goal boundary.",
        );
      pause.resumedAt = new Date().toISOString();
    }
    if (state.nextInstructionIndex >= entries.length) {
      const recoverableCleanup: boolean = isRecoverableCompletedCleanup(state);
      if (state.interruption !== undefined && !recoverableCleanup) {
        state.status = "interrupted";
        await props.onState?.(structuredClone(state));
        return state;
      }
      try {
        validateCompletedState(state, entries);
        if (recoverableCleanup) delete state.interruption;
        state.status = "completed";
      } catch (error) {
        state.status = "interrupted";
        state.interruption = normalizeInterruption(error);
      }
      await props.onState?.(structuredClone(state));
      return state;
    }
    const shutdownGraceMs: number = props.shutdownGraceMs ?? 5_000;
    if (!Number.isSafeInteger(shutdownGraceMs) || shutdownGraceMs <= 0)
      throw new Error("App-server shutdown grace must be a positive integer.");
    if (
      props.reviewLedger !== undefined &&
      state.nativeThreadStartInstructionIndex !== 1
    )
      throw new Error(
        "Runner-owned backend review tools require a detached backend-start checkpoint thread.",
      );
    if (props.reviewLedger !== undefined && props.fork !== undefined)
      throw new Error(
        "Runner-owned backend review tools require a fresh detached review thread, not a conversation fork.",
      );
    const current = (): ITtscEvidenceBenchmarkGoalRecord => {
      const record: ITtscEvidenceBenchmarkGoalRecord | undefined =
        state.goals.find(
          (candidate) => candidate.index === state.nextInstructionIndex,
        );
      if (record === undefined) throw new Error("Current Goal is missing.");
      return record;
    };
    const prepare = (): ITtscEvidenceBenchmarkGoalRecord => {
      const retained: ITtscEvidenceBenchmarkGoalRecord | undefined =
        state.goals.find(
          (record) => record.index === state.nextInstructionIndex,
        );
      if (retained !== undefined) return retained;
      const entry = entries[state.nextInstructionIndex];
      if (entry === undefined)
        throw new Error("Instruction cursor is invalid.");
      // An operator warning lives on the state rather than the plan, whose base
      // sequence must stay byte-identical to the frozen one. It reaches the
      // thread the only way anything does: as part of the objective composed
      // when this index has no retained Goal record.
      const warning = state.operatorWarnings?.find(
        (record) => record.instructionIndex === state.nextInstructionIndex,
      );
      const { prescribedText, continuationText, objectiveText } =
        EvidenceBenchmarkInstruction.objective({
          arm: state.arm,
          instructionsRoot: props.instructionsRoot,
          entry:
            warning === undefined
              ? entry
              : { ...entry, reviewFeedback: warning.feedback },
        });
      const record: ITtscEvidenceBenchmarkGoalRecord = {
        index: state.nextInstructionIndex,
        name: entry.name,
        relativePath: entry.relativePath,
        prescribedText,
        continuationText,
        objectiveText,
        goal: null,
        terminalTurnId: null,
        terminalTurnCompleted: false,
        threadIdle: false,
        tokenUsageTurnId: null,
        tokenUsageStart: structuredClone(state.threadTokenUsage),
        tokenUsageEnd: null,
        tokenUsage: zeroUsage(),
        elapsedMs: 0,
      };
      state.goals.push(record);
      return record;
    };

    prepare();
    const sandbox = (): "read-only" | "danger-full-access" =>
      props.reviewLedger === "backend" && current().name === "backend-review"
        ? "read-only"
        : "danger-full-access";
    if (props.fork !== undefined && state.sessionId !== undefined)
      throw new Error("Checkpoint fork state must not retain a session ID.");
    const forking: boolean = props.fork !== undefined;
    const fresh: boolean = state.sessionId === undefined && !forking;
    let forkGoalResetPending: boolean = forking;
    let resumeReconciled: boolean = fresh;
    let resumeSnapshotPending: boolean = !fresh;
    let resumeSnapshot: Record<string, unknown> | undefined;
    let resumeSnapshotRecordIndex: number | undefined;
    let resumeAdoptedUndispatchedGoal = false;
    let resumeNativeCompletedInterruptedGoal = false;
    /**
     * Objective the thread still holds when an operator warning supersedes it.
     *
     * `warn` drops the retained Goal record so this run recomposes the
     * objective with the warning, because `thread/goal/set` is the only channel
     * into the thread. The thread meanwhile still holds the Goal that record
     * described, and the dropped record took the turn ID and the counters that
     * named it, so the resume has nothing retained to reconcile against and
     * every replay reads as drift.
     *
     * The superseded objective is recoverable without it: the same instruction
     * bytes composed without the warning. So a warned resume proves its
     * boundary from the thread instead — counters identical to the last durable
     * write, and a held objective identical to this composition — and then
     * clears that Goal and issues the warned one.
     */
    const supersededObjectiveText: string | undefined = (() => {
      if (fresh || forking) return undefined;
      const record: ITtscEvidenceBenchmarkGoalRecord = current();
      if (record.goal !== null || record.tokenUsageTurnId !== null)
        return undefined;
      const warning = state.operatorWarnings?.find(
        (candidate) => candidate.instructionIndex === record.index,
      );
      const entry = entries[record.index];
      if (warning === undefined || entry === undefined) return undefined;
      return EvidenceBenchmarkInstruction.objective({
        arm: state.arm,
        instructionsRoot: props.instructionsRoot,
        entry,
      }).objectiveText;
    })();
    let supersededUsageTurnId: string | undefined;
    let resumeSupersededGoal = false;
    let resumeUsageReplay:
      | {
          turnId: string;
          usage: ITtscEvidenceBenchmarkTokenUsage;
        }
      | undefined;
    const resumeLifecycle: Record<string, unknown>[] = [];
    let resolveResumeSnapshot!: () => void;
    const resumeSnapshotPromise = new Promise<void>((resolve) => {
      resolveResumeSnapshot = resolve;
    });
    state.status = "running";
    delete state.interruption;

    const executable = resolveExecutable({
      name: "codex",
      environment: props.environment ?? process.env,
      command: props.command,
      commandPrefixArguments: props.commandPrefixArguments,
    });
    const command: string = executable.command;
    const arguments_: string[] = executable.composeArguments([
      "app-server",
      "--stdio",
      "--enable",
      "goals",
      "--config",
      `model_reasoning_effort="${props.effort}"`,
      ...EvidenceBenchmarkRuntime.browserServerArguments(),
    ]);
    const processIndex: number = state.processes.length;
    const processRecord: ITtscEvidenceBenchmarkProcessRecord = {
      runnerRevision: props.runnerRevision,
      command,
      arguments: arguments_,
      elapsedMs: 0,
      exitCode: null,
      signal: null,
    };
    state.processes.push(processRecord);

    type Outcome =
      | "completed"
      | "checkpointed"
      | "awaiting-review-verdict"
      | "interrupted";
    let reviewBoundary:
      | { scope: EvidenceBenchmarkReviewScope; attempt: number }
      | undefined;
    let outcome: Outcome | undefined;
    const reviewCommandAbort = new AbortController();
    let resolveOutcome!: (value: Outcome) => void;
    const outcomePromise = new Promise<Outcome>((resolve) => {
      resolveOutcome = resolve;
    });
    const finish = (value: Outcome, interruption?: unknown): void => {
      if (interruption !== undefined && state.interruption === undefined)
        state.interruption = normalizeInterruption(interruption);
      if (outcome !== undefined) return;
      outcome = value;
      reviewCommandAbort.abort();
      resolveOutcome(value);
    };

    let outputPublication: Promise<void> = Promise.resolve();
    let outputFailed = false;
    let publication: Promise<void> = Promise.resolve();
    let publicationFailed = false;
    const publish = (): void => {
      if (props.onState === undefined || publicationFailed) return;
      const snapshot: ITtscEvidenceBenchmarkRunState = structuredClone(state);
      const output: Promise<void> = outputPublication;
      publication = publication
        .then(() => output)
        .then(() => props.onState!(snapshot))
        .catch((error: unknown) => {
          publicationFailed = true;
          finish("interrupted", error);
        });
    };
    publish();

    const started: bigint = process.hrtime.bigint();
    const child = spawn(command, arguments_, {
      cwd: props.cwd,
      detached: process.platform !== "win32",
      env: props.environment ?? process.env,
      shell: false,
      windowsVerbatimArguments: executable.windowsVerbatimArguments,
      windowsHide: true,
      stdio: "pipe",
    });
    if (child.pid === undefined)
      throw new Error("Codex app-server omitted its process ID.");
    processRecord.processId = child.pid;
    monitorProcess(process.pid, child.pid, (error) =>
      finish("interrupted", error),
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let sequence = 0;
    /**
     * Names the stage that owns a stream chunk arriving right now.
     *
     * The cursor selects the Goal being executed. A chunk that arrives after
     * the last Goal of the run has finished — shutdown chatter, a final
     * protocol reply, an exit diagnostic — belongs to the stage that just ended
     * rather than to a file of its own, because the stage logs are read back as
     * one ordered stream and a chunk parked outside that order could split a
     * JSON line away from its other half. Before any Goal record exists the
     * plan's first entry names the stage the run is about to start.
     */
    const stage = (): string =>
      (
        state.goals.find(
          (candidate) => candidate.index === state.nextInstructionIndex,
        ) ??
        state.goals.reduce<ITtscEvidenceBenchmarkGoalRecord | undefined>(
          (latest, candidate) =>
            latest === undefined || candidate.index > latest.index
              ? candidate
              : latest,
          undefined,
        )
      )?.name ?? entries[0]!.name;
    const append = (
      stream: ITtscEvidenceBenchmarkOutput["stream"],
      text: string,
    ): void => {
      if (text.length === 0) return;
      const output: ITtscEvidenceBenchmarkOutput = {
        sequence: sequence++,
        elapsedMs: elapsed(started),
        stream,
        stage: stage(),
        text,
      };
      if (outputFailed) return;
      outputPublication = outputPublication
        .then(() =>
          outputFailed
            ? undefined
            : props.onOutput(processIndex, structuredClone(output)),
        )
        .catch((error: unknown) => {
          outputFailed = true;
          finish("interrupted", error);
          publish();
        });
    };
    child.stderr.on("data", (text: string) => append("stderr", text));
    child.stdin.on("error", (error) => finish("interrupted", error));

    let requestId = 0;
    const pending = new Map<
      number,
      {
        resolve: (value: unknown) => void;
        reject: (reason: unknown) => void;
      }
    >();
    const send = (message: Record<string, unknown>): void => {
      const text: string = `${JSON.stringify(message)}\n`;
      append("stdin", text);
      child.stdin.write(text, "utf8");
    };
    const request = (method: string, params: unknown): Promise<unknown> => {
      const id: number = ++requestId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ method, id, params });
      });
    };

    let advancing = false;
    const beginGoal = async (): Promise<void> => {
      const record: ITtscEvidenceBenchmarkGoalRecord = prepare();
      const threadId: string | undefined = state.sessionId;
      if (threadId === undefined)
        throw new Error("Codex app-server omitted the thread ID.");
      record.terminalTurnId = null;
      record.terminalTurnCompleted = false;
      record.threadIdle = false;
      record.tokenUsageTurnId = null;
      publish();
      await publication;
      if (outcome !== undefined) return;
      const response: unknown = await request("thread/goal/set", {
        threadId,
        objective: record.objectiveText,
        status: "active",
      });
      const value: Record<string, unknown> = object(response);
      const goal: Record<string, unknown> = object(value.goal);
      validateNativeGoal(record, goal, threadId);
      record.goal = goal;
      publish();
    };
    const advance = async (): Promise<void> => {
      if (outcome !== undefined) return;
      const record: ITtscEvidenceBenchmarkGoalRecord = current();
      if (
        !resumeReconciled ||
        resumeSnapshotPending ||
        advancing ||
        record.goal?.status !== "complete" ||
        record.terminalTurnId === null ||
        !record.terminalTurnCompleted ||
        !record.threadIdle
      )
        return;
      if (
        props.reviewLedger === "backend" &&
        record.name === "backend-review"
      ) {
        try {
          if (activeNativeCommands.size !== 0)
            throw new Error(
              `Codex completed ${record.name} while native commands ${[...activeNativeCommands].join(", ")} remained active.`,
            );
          EvidenceBenchmarkReviewLedger.assertDry({
            cwd: props.cwd,
            state,
            goal: record,
          });
        } catch (error) {
          finish("interrupted", error);
          return;
        }
      }
      if (!usageAdvanced(state.threadTokenUsage, record.tokenUsageStart)) {
        finish("interrupted", {
          name: "EvidenceBenchmarkTokenCheckpointError",
          message:
            "Codex Goal completed without an exact native token checkpoint.",
          instructionIndex: record.index,
        });
        return;
      }
      if (record.tokenUsageTurnId !== record.terminalTurnId) {
        finish("interrupted", {
          name: "EvidenceBenchmarkTokenCheckpointError",
          message:
            "Codex Goal completed without an exact terminal-turn token checkpoint.",
          instructionIndex: record.index,
          tokenUsageTurnId: record.tokenUsageTurnId,
          terminalTurnId: record.terminalTurnId,
        });
        return;
      }
      record.elapsedMs = nativeGoalElapsedMs(state, record);
      advancing = true;
      record.tokenUsageEnd = structuredClone(state.threadTokenUsage);
      record.tokenUsage = subtract(
        record.tokenUsageEnd,
        record.tokenUsageStart,
      );
      if (
        record.index === 0 &&
        record.name === "backend-start" &&
        !(state.checkpoints ?? []).some(
          (checkpoint) => checkpoint.name === "backend-start",
        ) &&
        props.onCheckpoint !== undefined
      ) {
        const storage: ITtscEvidenceBenchmarkCheckpointStorage =
          typia.assert<ITtscEvidenceBenchmarkCheckpointStorage>(
            structuredClone(
              await props.onCheckpoint({
                state: structuredClone(state),
                goal: structuredClone(record),
                processElapsedMs:
                  (state.inheritedProcessElapsedMs ?? 0) +
                  state.processes
                    .slice(0, -1)
                    .reduce((sum, process) => sum + process.elapsedMs, 0) +
                  elapsed(started),
              }),
            ),
          );
        if (
          state.sessionId === undefined ||
          state.cliVersion === undefined ||
          record.terminalTurnId === null
        )
          throw new Error("Backend-start checkpoint lacks a native boundary.");
        state.checkpoints ??= [];
        state.checkpoints.push({
          name: "backend-start",
          instructionIndex: 0,
          nextInstructionIndex: 1,
          sourceSessionId: state.sessionId,
          terminalTurnId: record.terminalTurnId,
          cliVersion: state.cliVersion,
          ...storage,
          inheritedProcessElapsedMs:
            (state.inheritedProcessElapsedMs ?? 0) +
            state.processes
              .slice(0, -1)
              .reduce((sum, process) => sum + process.elapsedMs, 0) +
            elapsed(started),
        });
        publish();
        await publication;
        if (outcome !== undefined) return;
      }
      reviewBoundary =
        state.arm === "plain"
          ? EvidenceBenchmarkInstruction.reviewBoundary(entries[record.index]!)
          : undefined;
      state.nextInstructionIndex++;
      if (reviewBoundary !== undefined) {
        state.supervisionPauses ??= [];
        state.supervisionPauses.push({
          ...reviewBoundary,
          afterGoal: record.name,
          goalIndex: record.index,
          pausedAt: new Date().toISOString(),
        });
      }
      publish();
      await publication;
      if (outcome !== undefined) return;
      if (props.stopAfterGoal === record.name) {
        if (
          record.name !== "backend-start" ||
          !(state.checkpoints ?? []).some(
            (checkpoint) => checkpoint.name === "backend-start",
          )
        )
          throw new Error(
            "Requested benchmark stop lacks its durable recovery checkpoint.",
          );
        finish("checkpointed");
      } else if (reviewBoundary !== undefined) {
        finish("awaiting-review-verdict");
      } else if (state.nextInstructionIndex === entries.length)
        finish("completed");
      else {
        await beginGoal();
        advancing = false;
      }
    };

    const activeNativeCommands: Set<string> = new Set();
    const notify = async (message: Record<string, unknown>): Promise<void> => {
      if (
        message.method !== "thread/tokenUsage/updated" &&
        message.method !== "turn/started" &&
        message.method !== "thread/goal/updated" &&
        message.method !== "turn/completed" &&
        message.method !== "thread/status/changed" &&
        message.method !== "item/started" &&
        message.method !== "item/completed"
      )
        return;
      const params: Record<string, unknown> = object(message.params);
      if (typeof params.threadId !== "string")
        throw new Error("Codex app-server notification omitted its thread ID.");
      if (state.sessionId === undefined)
        throw new Error("Codex app-server omitted the thread ID.");
      if (params.threadId !== state.sessionId) return;
      if (
        message.method === "item/started" ||
        message.method === "item/completed"
      ) {
        if (props.reviewLedger === "backend")
          EvidenceBenchmarkReviewLedger.observeNativeCommand({
            cwd: props.cwd,
            state,
            goal: current(),
            method: message.method,
            item: object(params.item),
            active: activeNativeCommands,
          });
        return;
      }
      if (forkGoalResetPending) {
        if (message.method === "thread/tokenUsage/updated") {
          const usage: ITtscEvidenceBenchmarkTokenUsage | undefined =
            tokenUsage(params);
          const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
            state.goals.find(
              (candidate) => candidate.index === state.nextInstructionIndex - 1,
            );
          if (
            usage !== undefined &&
            (!sameUsage(usage, state.threadTokenUsage) ||
              params.turnId !== previous?.tokenUsageTurnId)
          )
            throw new Error(
              "Checkpoint fork token replay does not match its retained boundary.",
            );
          return;
        }
        if (message.method === "thread/goal/updated" && params.turnId === null)
          return;
        if (message.method === "thread/status/changed") {
          const status: Record<string, unknown> = object(params.status);
          if (status.type === "idle") return;
        }
        throw new Error(
          "Checkpoint fork continued the source Goal before it was reset.",
        );
      }

      if (message.method === "thread/tokenUsage/updated") {
        const usage: ITtscEvidenceBenchmarkTokenUsage | undefined =
          tokenUsage(params);
        if (usage !== undefined) {
          if (typeof params.turnId !== "string") {
            finish("interrupted", message);
            return;
          }
          if (!resumeReconciled && resumeSnapshotPending) {
            const record: ITtscEvidenceBenchmarkGoalRecord = current();
            const currentHasCheckpoint: boolean =
              record.goal !== null && record.tokenUsageTurnId !== null;
            const currentCanAdoptReplay: boolean =
              record.goal !== null &&
              canOwnInterruptedUsageReplay(record.goal.status);
            const retained: ITtscEvidenceBenchmarkGoalRecord | undefined =
              currentHasCheckpoint
                ? record
                : state.goals.find(
                    (candidate) => candidate.index === record.index - 1,
                  );
            const exact: boolean =
              retained !== undefined &&
              sameUsage(usage, state.threadTokenUsage) &&
              retained.tokenUsageTurnId === params.turnId &&
              (currentHasCheckpoint ||
                (retained.goal?.status === "complete" &&
                  retained.terminalTurnId !== null &&
                  retained.terminalTurnCompleted &&
                  retained.threadIdle &&
                  retained.tokenUsageTurnId === retained.terminalTurnId &&
                  retained.tokenUsageEnd !== null &&
                  sameUsage(retained.tokenUsageEnd, state.threadTokenUsage)));
            if (exact) {
              publish();
              return;
            }
            // A superseded Goal replays the interrupted turn the dropped record
            // named. Equality with the last durable write is the whole proof
            // that nothing ran past it, and the Goal snapshot that follows
            // decides whether this is the warned boundary.
            if (
              supersededObjectiveText !== undefined &&
              record.goal === null &&
              record.tokenUsageTurnId === null &&
              sameUsage(usage, state.threadTokenUsage)
            ) {
              supersededUsageTurnId = params.turnId;
              publish();
              return;
            }
            if (
              currentCanAdoptReplay &&
              usageAdvanced(usage, state.threadTokenUsage)
            ) {
              if (
                resumeUsageReplay !== undefined &&
                (resumeUsageReplay.turnId !== params.turnId ||
                  !sameUsage(resumeUsageReplay.usage, usage))
              )
                throw new Error(
                  "Codex emitted conflicting interrupted-turn token replays.",
                );
              resumeUsageReplay = {
                turnId: params.turnId,
                usage: structuredClone(usage),
              };
              return;
            }
            if (
              retained === undefined ||
              !sameUsage(usage, state.threadTokenUsage) ||
              retained.tokenUsageTurnId !== params.turnId
            )
              throw new Error(
                "Codex resume token replay does not match the retained checkpoint.",
              );
            throw new Error(
              "Codex resume token replay lacks an exact retained boundary.",
            );
          }
          if (!resumeReconciled) {
            resumeLifecycle.push(structuredClone(message));
            return;
          }
          state.threadTokenUsage = usage;
          current().tokenUsageTurnId = params.turnId;
        }
        publish();
        await advance();
        return;
      }
      if (
        !resumeReconciled &&
        !(message.method === "thread/goal/updated" && params.turnId === null)
      ) {
        resumeLifecycle.push(structuredClone(message));
        return;
      }
      if (message.method === "turn/started") {
        current().threadIdle = false;
        publish();
        return;
      }
      if (message.method === "thread/goal/updated") {
        const record: ITtscEvidenceBenchmarkGoalRecord = current();
        const goal: Record<string, unknown> = object(params.goal);
        if (state.sessionId === undefined)
          throw new Error("Codex app-server omitted the thread ID.");
        if (!resumeReconciled && params.turnId === null) {
          if (!resumeSnapshotPending || resumeSnapshot !== undefined)
            throw new Error("Codex emitted duplicate resume Goal snapshots.");
          const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
            state.goals.find(
              (candidate) => candidate.index === record.index - 1,
            );
          const retained: ITtscEvidenceBenchmarkGoalRecord | undefined =
            record.goal !== null ? record : previous;
          // Decided before the undispatched boundary, because a warned Goal
          // that consumed nothing still leaves the thread holding the objective
          // this record no longer carries, and adopting it there would validate
          // the superseded text against the warned one.
          if (
            supersededObjectiveText !== undefined &&
            record.goal === null &&
            record.tokenUsageTurnId === null &&
            supersededUsageTurnId !== undefined &&
            isRetainedGoalStatus(goal.status) &&
            goal.threadId === state.sessionId &&
            sameNativeGoalObjective(goal.objective, supersededObjectiveText)
          ) {
            resumeSnapshot = structuredClone(goal);
            resumeSnapshotRecordIndex = record.index;
            resumeSupersededGoal = true;
            resumeSnapshotPending = false;
            resolveResumeSnapshot();
            publish();
            return;
          }
          const previousBoundaryComplete: boolean =
            record.index === 0
              ? previous === undefined
              : previous?.goal?.status === "complete" &&
                previous.terminalTurnId !== null &&
                previous.terminalTurnCompleted &&
                previous.threadIdle &&
                previous.tokenUsageTurnId === previous.terminalTurnId &&
                previous.tokenUsageEnd !== null &&
                usageAdvanced(
                  previous.tokenUsageEnd,
                  previous.tokenUsageStart,
                ) &&
                sameUsage(
                  previous.tokenUsage,
                  subtract(previous.tokenUsageEnd, previous.tokenUsageStart),
                ) &&
                sameUsage(previous.tokenUsageEnd, state.threadTokenUsage);
          const undispatched: boolean =
            record.goal === null &&
            previousBoundaryComplete &&
            record.terminalTurnId === null &&
            !record.terminalTurnCompleted &&
            record.tokenUsageTurnId === null &&
            record.tokenUsageEnd === null &&
            sameUsage(record.tokenUsageStart, state.threadTokenUsage) &&
            sameUsage(record.tokenUsage, zeroUsage()) &&
            goal.status === "active" &&
            goal.tokensUsed === 0 &&
            goal.timeUsedSeconds === 0;
          if (undispatched) {
            if (previous?.goal !== null && previous?.goal !== undefined)
              validateNativeGoal(previous, previous.goal, state.sessionId);
            validateNativeGoal(record, goal, state.sessionId);
            record.goal = structuredClone(goal);
            resumeSnapshot = structuredClone(goal);
            resumeSnapshotRecordIndex = record.index;
            resumeAdoptedUndispatchedGoal = true;
            resumeSnapshotPending = false;
            resolveResumeSnapshot();
            publish();
            return;
          }
          const retainedGoal: Record<string, unknown> | null = record.goal;
          const nativeCompletedInterruptedGoal: boolean =
            retained === record &&
            retainedGoal !== null &&
            retainedGoal.status === "active" &&
            goal.status === "complete" &&
            record.terminalTurnId === null &&
            !record.terminalTurnCompleted &&
            !record.threadIdle &&
            record.tokenUsageTurnId !== null &&
            record.tokenUsageEnd === null &&
            sameUsage(record.tokenUsage, zeroUsage()) &&
            usageAdvanced(state.threadTokenUsage, record.tokenUsageStart);
          if (nativeCompletedInterruptedGoal) {
            if (retainedGoal === null)
              throw new Error("Retained active Goal is missing.");
            validateNativeGoal(record, retainedGoal, state.sessionId);
            validateNativeGoal(record, goal, state.sessionId);
            resumeSnapshot = structuredClone(goal);
            resumeSnapshotRecordIndex = record.index;
            resumeNativeCompletedInterruptedGoal = true;
            resumeSnapshotPending = false;
            resolveResumeSnapshot();
            publish();
            return;
          }
          if (
            retained?.goal === null ||
            retained?.goal === undefined ||
            retained.goal.status !== goal.status
          )
            throw new Error(
              "Codex resume Goal snapshot does not match an exact retained boundary.",
            );
          validateNativeGoal(retained, retained.goal, state.sessionId);
          validateNativeGoal(retained, goal, state.sessionId);
          resumeSnapshot = structuredClone(goal);
          resumeSnapshotRecordIndex = retained.index;
          resumeSnapshotPending = false;
          resolveResumeSnapshot();
          publish();
          return;
        }
        validateNativeGoal(record, goal, state.sessionId);
        record.goal = goal;
        const status: unknown = record.goal.status;
        if (status === "complete") {
          if (typeof params.turnId !== "string") {
            finish("interrupted", message);
            return;
          }
          record.terminalTurnId = params.turnId;
          record.terminalTurnCompleted = false;
          record.threadIdle = false;
        }
        publish();
        if (
          status === "paused" ||
          status === "blocked" ||
          status === "usageLimited" ||
          status === "budgetLimited"
        )
          finish("interrupted", message);
        else await advance();
        return;
      }
      if (message.method === "turn/completed") {
        const turn: Record<string, unknown> = object(params.turn);
        const record: ITtscEvidenceBenchmarkGoalRecord = current();
        if (turn.id === record.terminalTurnId && turn.status === "completed")
          record.terminalTurnCompleted = true;
        if (typeof turn.durationMs === "number")
          record.elapsedMs += turn.durationMs;
        publish();
        if (turn.status === "failed" || turn.status === "interrupted")
          finish("interrupted", message);
        else await advance();
        return;
      }
      if (message.method === "thread/status/changed") {
        const status: Record<string, unknown> = object(params.status);
        const record: ITtscEvidenceBenchmarkGoalRecord = current();
        record.threadIdle = status.type === "idle";
        publish();
        if (status.type === "systemError" || status.type === "notLoaded")
          finish("interrupted", message);
        else await advance();
      }
    };
    const flushResumeLifecycle = async (): Promise<void> => {
      const buffered: Record<string, unknown>[] = resumeLifecycle.splice(0);
      for (const message of buffered) {
        if (outcome !== undefined) return;
        await notify(message);
      }
    };

    let notifications: Promise<void> = Promise.resolve();
    let toolRequests: Promise<void> = Promise.resolve();
    const receive = (value: unknown): void => {
      const message: Record<string, unknown> = object(value);
      if (typeof message.method === "string") {
        if ("id" in message) {
          if (
            message.method !== "item/tool/call" ||
            props.reviewLedger !== "backend" ||
            typeof message.id !== "number"
          ) {
            finish("interrupted", message);
            return;
          }
          toolRequests = toolRequests
            .then(async () => {
              const params: Record<string, unknown> = object(message.params);
              if (
                params.threadId !== state.sessionId ||
                typeof params.turnId !== "string" ||
                typeof params.callId !== "string" ||
                typeof params.tool !== "string"
              )
                throw new Error(
                  "Codex emitted an invalid runner-owned review tool request.",
                );
              if (
                (params.tool === "review_run_backend_command" ||
                  params.tool === "review_edit_file") &&
                activeNativeCommands.size !== 0
              )
                throw new Error(
                  `Codex requested a runner-owned backend command while native commands ${[...activeNativeCommands].join(", ")} remained active.`,
                );
              const result = await EvidenceBenchmarkReviewLedger.handle({
                cwd: props.cwd,
                state,
                goal: current(),
                call: {
                  tool: params.tool,
                  arguments: params.arguments,
                  callId: params.callId,
                  turnId: params.turnId,
                },
                onChange: async () => {
                  publish();
                  await publication;
                  if (outcome !== undefined)
                    throw new Error(
                      "The benchmark ended while a runner-owned backend command was active.",
                    );
                },
                signal: reviewCommandAbort.signal,
              });
              publish();
              await publication;
              if (outcome === undefined) send({ id: message.id, result });
            })
            .catch((error: unknown) => finish("interrupted", error));
        } else
          notifications = notifications
            .then(() => notify(message))
            .catch((error: unknown) => finish("interrupted", error));
        return;
      }
      if (typeof message.id !== "number") return;
      const waiter = pending.get(message.id);
      if (waiter === undefined) return;
      pending.delete(message.id);
      if ("error" in message) waiter.reject(message.error);
      else waiter.resolve(message.result);
    };

    let stdout = "";
    child.stdout.on("data", (text: string) => {
      append("stdout", text);
      stdout += text;
      for (;;) {
        const newline: number = stdout.indexOf("\n");
        if (newline === -1) return;
        const line: string = stdout.slice(0, newline).replace(/\r$/, "");
        stdout = stdout.slice(newline + 1);
        if (line.length === 0) continue;
        try {
          receive(typia.assert<Record<string, unknown>>(JSON.parse(line)));
        } catch {
          finish("interrupted", line);
        }
      }
    });

    let resolveExited!: () => void;
    const exited = new Promise<void>((resolve) => {
      resolveExited = resolve;
    });
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => {
      resolveClosed = resolve;
    });
    child.once("error", (error) => {
      finish("interrupted", error);
      resolveExited();
      resolveClosed();
    });
    child.once("exit", (exitCode, signal) => {
      processRecord.elapsedMs = elapsed(started);
      processRecord.exitCode = exitCode;
      processRecord.signal = signal;
      for (const waiter of pending.values())
        waiter.reject(new Error("Codex app-server exited."));
      pending.clear();
      if (
        outcome === "completed" &&
        (exitCode !== 0 || signal !== null) &&
        processRecord.shutdownForced !== true
      )
        finish("interrupted", { exitCode, signal });
      if (outcome === undefined) finish("interrupted", { exitCode, signal });
      publish();
      resolveExited();
    });
    child.once("close", () => {
      if (stdout.trim().length !== 0) {
        try {
          receive(typia.assert<Record<string, unknown>>(JSON.parse(stdout)));
        } catch {
          finish("interrupted", stdout);
        }
      }
      publish();
      resolveClosed();
    });

    try {
      await request("initialize", {
        clientInfo: {
          name: "@ttsc/benchmark-evidence",
          version: "0.4.4",
        },
        capabilities: {
          experimentalApi: true,
        },
      });
      send({ method: "initialized" });
      const retainedSessionId: string | undefined = state.sessionId;
      const response: Record<string, unknown> = object(
        fresh
          ? await request("thread/start", {
              model: props.model,
              cwd: props.cwd,
              approvalPolicy: "never",
              sandbox: sandbox(),
              ephemeral: false,
              ...(props.reviewLedger === "backend"
                ? { dynamicTools: EvidenceBenchmarkReviewLedger.tools() }
                : {}),
            })
          : forking
            ? await request("thread/fork", {
                threadId: props.fork!.sourceSessionId,
                lastTurnId: props.fork!.terminalTurnId,
                model: props.model,
                cwd: props.cwd,
                runtimeWorkspaceRoots: [props.cwd],
                approvalPolicy: "never",
                sandbox: sandbox(),
                deferGoalContinuation: true,
                ephemeral: false,
              })
            : await request("thread/resume", {
                threadId: state.sessionId,
                model: props.model,
                cwd: props.cwd,
                approvalPolicy: "never",
                sandbox: sandbox(),
              }),
      );
      const thread: Record<string, unknown> = object(response.thread);
      if (typeof thread.id !== "string")
        throw new Error("Codex app-server omitted the thread ID.");
      if (!fresh && !forking && thread.id !== retainedSessionId)
        throw new Error(
          "Codex app-server resumed a different retained thread.",
        );
      if (
        forking &&
        (thread.id === props.fork!.sourceSessionId ||
          (typeof thread.forkedFromId === "string" &&
            thread.forkedFromId !== props.fork!.sourceSessionId))
      )
        throw new Error(
          "Codex app-server returned an invalid checkpoint fork.",
        );
      if (typeof thread.cliVersion !== "string")
        throw new Error("Codex app-server omitted the CLI version.");
      if (
        state.cliVersion !== undefined &&
        state.cliVersion !== thread.cliVersion
      )
        throw new Error(
          "Retained benchmark cell uses a different CLI version.",
        );
      const sessionId: string = thread.id;
      if (forking)
        for (const record of state.goals)
          if (record.index < state.nextInstructionIndex && record.goal !== null)
            record.goal.threadId = sessionId;
      if (forking)
        for (const checkpoint of state.checkpoints ?? [])
          if (checkpoint.terminalTurnId === props.fork!.terminalTurnId)
            checkpoint.sourceSessionId = sessionId;
      state.sessionId = sessionId;
      state.cliVersion = thread.cliVersion;
      if (fresh)
        current().threadIdle = object(thread.status, false)?.type === "idle";
      publish();
      await publication;

      if (outcome === undefined && forking) {
        await request("thread/goal/clear", { threadId: sessionId });
        await notifications;
        forkGoalResetPending = false;
        resumeSnapshotPending = false;
        resumeReconciled = true;
        if (outcome === undefined) await beginGoal();
      } else if (outcome === undefined && fresh) await beginGoal();
      else if (outcome === undefined) {
        const goalResponse: Record<string, unknown> = object(
          await request("thread/goal/get", {
            threadId: sessionId,
          }),
        );
        const goal: Record<string, unknown> | null =
          goalResponse.goal === null ? null : object(goalResponse.goal);
        if (goal !== null && resumeSnapshot === undefined)
          await Promise.race([resumeSnapshotPromise, outcomePromise]);
        await notifications;
        if (outcome === undefined) {
          const record: ITtscEvidenceBenchmarkGoalRecord = current();
          if (goal === null) {
            resumeSnapshotPending = false;
            resumeReconciled = true;
            if (
              record.index !== 0 ||
              record.goal !== null ||
              resumeSnapshot !== undefined
            )
              finish("interrupted", {
                name: "EvidenceBenchmarkResumeInterruption",
                message: "Retained state has no exact empty Goal boundary.",
                instructionIndex: record.index,
                nativeGoal: goal,
              });
            else {
              await flushResumeLifecycle();
              if (outcome === undefined) await beginGoal();
            }
          } else if (
            resumeSnapshot === undefined ||
            resumeSnapshotRecordIndex === undefined
          )
            finish("interrupted", {
              name: "EvidenceBenchmarkResumeInterruption",
              message: "Codex omitted the retained Goal snapshot.",
              instructionIndex: record.index,
              nativeGoal: goal,
            });
          else if (resumeSupersededGoal) {
            if (
              supersededObjectiveText === undefined ||
              resumeSnapshotRecordIndex !== record.index ||
              record.goal !== null ||
              record.tokenUsageTurnId !== null ||
              goal.threadId !== sessionId ||
              !isRetainedGoalStatus(goal.status) ||
              !sameNativeGoalObjective(goal.objective, supersededObjectiveText)
            )
              finish("interrupted", {
                name: "EvidenceBenchmarkResumeInterruption",
                message:
                  "Retained state has no exact superseded Goal boundary.",
                instructionIndex: record.index,
                nativeGoal: goal,
                nativeGoalSnapshot: resumeSnapshot,
              });
            else {
              // Cleared before the warned objective is set, so the thread never
              // holds two Goals. The buffered lifecycle describes the turn the
              // superseded Goal owned, which the reissued boundary does not,
              // and replaying it would validate that Goal against this record's
              // recomposed objective.
              await request("thread/goal/clear", { threadId: sessionId });
              await notifications;
              resumeLifecycle.splice(0);
              resumeReconciled = true;
              if (outcome === undefined) await beginGoal();
            }
          } else if (record.goal === null) {
            const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
              state.goals.find(
                (candidate) => candidate.index === record.index - 1,
              );
            if (
              previous === undefined ||
              previous.goal === null ||
              previous.goal.status !== "complete" ||
              previous.terminalTurnId === null ||
              !previous.terminalTurnCompleted ||
              !previous.threadIdle ||
              previous.tokenUsageTurnId !== previous.terminalTurnId ||
              previous.tokenUsageEnd === null ||
              !usageAdvanced(
                previous.tokenUsageEnd,
                previous.tokenUsageStart,
              ) ||
              !sameUsage(previous.tokenUsageEnd, state.threadTokenUsage) ||
              resumeSnapshotRecordIndex !== previous.index ||
              resumeSnapshot.status !== "complete" ||
              goal.status !== "complete"
            )
              finish("interrupted", {
                name: "EvidenceBenchmarkResumeInterruption",
                message:
                  "Retained state has no exact undispatched Goal boundary.",
                instructionIndex: record.index,
                nativeGoal: goal,
                nativeGoalSnapshot: resumeSnapshot,
              });
            else {
              validateNativeGoal(previous, previous.goal, sessionId);
              validateNativeGoal(previous, resumeSnapshot, sessionId);
              validateNativeGoal(previous, goal, sessionId);
              resumeReconciled = true;
              await flushResumeLifecycle();
              if (outcome === undefined) await beginGoal();
            }
          } else {
            validateNativeGoal(record, record.goal, sessionId);
            validateNativeGoal(record, resumeSnapshot, sessionId);
            validateNativeGoal(record, goal, sessionId);
            if (
              resumeSnapshotRecordIndex !== record.index ||
              !isRetainedGoalStatus(goal.status) ||
              (resumeSnapshot.status === "complete" &&
                goal.status !== "complete") ||
              !isRetainedGoalStatus(record.goal.status)
            )
              finish("interrupted", {
                name: "EvidenceBenchmarkResumeInterruption",
                message:
                  "Codex resumed outside an exact retained Goal boundary.",
                instructionIndex: record.index,
                nativeGoal: goal,
                nativeGoalSnapshot: resumeSnapshot,
              });
            else if (
              resumeNativeCompletedInterruptedGoal &&
              resumeSnapshot.status === "complete" &&
              goal.status === "complete"
            ) {
              reconcileInterruptedUsageReplay(record, thread);
              proveNativeCompletedInterruptedGoal(record, thread);
              resumeReconciled = true;
              publish();
              await flushResumeLifecycle();
              if (outcome === undefined) await beginGoal();
            } else if (
              resumeSnapshot.status === "complete" &&
              (record.terminalTurnId === null ||
                !record.terminalTurnCompleted ||
                !record.threadIdle ||
                record.tokenUsageTurnId !== record.terminalTurnId)
            )
              finish("interrupted", {
                name: "EvidenceBenchmarkResumeInterruption",
                message:
                  "Completed Goal lacks exact terminal-turn, idle, and token checkpoints.",
                instructionIndex: record.index,
                goal,
                terminalTurnId: record.terminalTurnId,
                terminalTurnCompleted: record.terminalTurnCompleted,
                threadIdle: record.threadIdle,
                tokenUsageTurnId: record.tokenUsageTurnId,
              });
            else {
              reconcileInterruptedUsageReplay(record, thread);
              resumeReconciled = true;
              publish();
              await flushResumeLifecycle();
              if (outcome === undefined) {
                if (
                  resumeAdoptedUndispatchedGoal ||
                  isInterruptedGoalStatus(goal.status)
                )
                  await beginGoal();
                else await advance();
              }
            }
          }
        }
      }
    } catch (error) {
      finish("interrupted", error);
    }

    function reconcileInterruptedUsageReplay(
      record: ITtscEvidenceBenchmarkGoalRecord,
      thread: Record<string, unknown>,
    ): void {
      if (resumeUsageReplay === undefined) return;
      if (!canOwnInterruptedUsageReplay(record.goal?.status))
        throw new Error(
          "Codex advanced token replay does not belong to an interrupted Goal.",
        );
      const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
        record.index === 0
          ? undefined
          : state.goals.find(
              (candidate) => candidate.index === record.index - 1,
            );
      const previousOwnsCheckpoint: boolean =
        record.tokenUsageTurnId === null &&
        previous?.goal?.status === "complete" &&
        previous.terminalTurnId !== null &&
        previous.terminalTurnCompleted &&
        previous.threadIdle &&
        previous.tokenUsageTurnId === previous.terminalTurnId &&
        previous.tokenUsageEnd !== null &&
        sameUsage(previous.tokenUsageEnd, state.threadTokenUsage);
      const retainedTurnId: string | null =
        record.tokenUsageTurnId ??
        (previousOwnsCheckpoint ? (previous?.tokenUsageTurnId ?? null) : null);
      if (retainedTurnId === null)
        throw new Error(
          "Codex advanced token replay has no exact retained Goal checkpoint.",
        );
      const values: unknown = thread.turns;
      if (!Array.isArray(values))
        throw new Error(
          "Codex omitted turn history needed to prove interrupted token replay.",
        );
      const turns: Record<string, unknown>[] = values.map((value) =>
        object(value),
      );
      const retainedIndex: number = turns.findIndex(
        (turn) => turn.id === retainedTurnId,
      );
      const replayIndex: number = turns.findIndex(
        (turn) =>
          turn.id === resumeUsageReplay?.turnId &&
          turn.status === "interrupted",
      );
      const sameInterruptedTurn: boolean =
        resumeUsageReplay.turnId === record.tokenUsageTurnId &&
        replayIndex === retainedIndex;
      const nextInterruptedTurn: boolean = replayIndex === retainedIndex + 1;
      const trailingTurnsInterrupted: boolean = turns
        .slice(replayIndex)
        .every((turn) => turn.status === "interrupted");
      if (
        retainedIndex === -1 ||
        (!sameInterruptedTurn && !nextInterruptedTurn) ||
        !trailingTurnsInterrupted
      )
        throw new Error(
          `Codex interrupted token replay is not the exact retained or next turn followed only by interrupted turns: ${JSON.stringify(
            {
              retainedTurnId,
              replayTurnId: resumeUsageReplay.turnId,
              retainedIndex,
              replayIndex,
              turns: turns.map((turn) => ({
                id: turn.id,
                status: turn.status,
              })),
            },
          )}`,
        );
      state.threadTokenUsage = structuredClone(resumeUsageReplay.usage);
      record.tokenUsageTurnId = resumeUsageReplay.turnId;
      resumeUsageReplay = undefined;
    }

    function proveNativeCompletedInterruptedGoal(
      record: ITtscEvidenceBenchmarkGoalRecord,
      thread: Record<string, unknown>,
    ): void {
      if (
        !resumeNativeCompletedInterruptedGoal ||
        record.goal?.status !== "active" ||
        record.terminalTurnId !== null ||
        record.terminalTurnCompleted ||
        record.threadIdle ||
        record.tokenUsageTurnId === null ||
        record.tokenUsageEnd !== null ||
        !sameUsage(record.tokenUsage, zeroUsage()) ||
        !usageAdvanced(state.threadTokenUsage, record.tokenUsageStart) ||
        object(thread.status, false)?.type !== "idle"
      )
        throw new Error(
          "Native completed Goal lacks an exact interrupted retained boundary.",
        );
      const values: unknown = thread.turns;
      if (!Array.isArray(values))
        throw new Error(
          "Codex omitted turn history needed to prove the interrupted Goal.",
        );
      const turns: Record<string, unknown>[] = values.map((value) =>
        object(value),
      );
      const retainedIndex: number = turns.findIndex(
        (turn) =>
          turn.id === record.tokenUsageTurnId && turn.status === "interrupted",
      );
      const trailingTurnsInterrupted: boolean = turns
        .slice(retainedIndex)
        .every((turn) => turn.status === "interrupted");
      if (retainedIndex === -1 || !trailingTurnsInterrupted)
        throw new Error(
          `Native completed Goal is not proven by the retained interrupted turn followed only by interrupted turns: ${JSON.stringify(
            {
              retainedTurnId: record.tokenUsageTurnId,
              retainedIndex,
              turns: turns.map((turn) => ({
                id: turn.id,
                status: turn.status,
              })),
            },
          )}`,
        );
    }

    const result: Outcome = await outcomePromise;
    await toolRequests;
    await notifications;
    await publication;
    child.stdin.end();
    if (!(await waitFor(exited, shutdownGraceMs))) {
      processRecord.shutdownForced = true;
      await terminateProcessTree(child.pid);
      if (
        !(await waitFor(exited, shutdownGraceMs)) &&
        isProcessAlive(child.pid)
      ) {
        finish("interrupted", new Error(PROCESS_CLEANUP_ERROR));
      }
    }
    processRecord.elapsedMs = elapsed(started);
    if (!(await waitFor(closed, shutdownGraceMs))) {
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
    }
    await notifications;
    await outputPublication;
    await publication;
    const cleanExit: boolean =
      ((processRecord.exitCode === 0 && processRecord.signal === null) ||
        processRecord.shutdownForced === true) &&
      state.interruption === undefined &&
      !outputFailed &&
      !publicationFailed;
    state.status = cleanExit
      ? result === "checkpointed"
        ? "checkpointed"
        : result === "awaiting-review-verdict"
          ? "awaiting-review-verdict"
          : result === "completed"
            ? "completed"
            : "interrupted"
      : "interrupted";
    if (state.status === "awaiting-review-verdict") {
      if (reviewBoundary === undefined)
        throw new Error("Review-verdict pause omitted its completed Goal.");
      const goal: ITtscEvidenceBenchmarkGoalRecord | undefined =
        state.goals.find(
          (candidate) => candidate.index === state.nextInstructionIndex - 1,
        );
      const pause = state.supervisionPauses?.at(-1);
      if (
        goal === undefined ||
        pause === undefined ||
        pause.scope !== reviewBoundary.scope ||
        pause.attempt !== reviewBoundary.attempt ||
        pause.afterGoal !== goal.name ||
        pause.goalIndex !== goal.index ||
        pause.verdict !== undefined ||
        pause.resumedAt !== undefined
      )
        throw new Error("Review-verdict pause omitted its Goal record.");
    }
    // Inspection happens only after the measured app-server has exited. That
    // process record counts wall time from spawn to exit, so judging while it
    // was still alive would put the inspector's minutes inside the cell's
    // total once already, and adding them would count them twice.
    if (
      state.status === "awaiting-review-verdict" &&
      props.runRoot !== undefined
    )
      await inspectReviewBoundary(props.runRoot);
    publish();
    await publication;
    if (publicationFailed) state.status = "interrupted";

    /**
     * Judges the completed Review attempt in a thread the cell never sees.
     *
     * The measured agent must not learn that it is being judged or by what
     * criteria, so the inspection runs as its own Codex process, reads the
     * stage log outside the workspace and the workspace itself, and returns a
     * decision. A failure leaves the pause undecided, which is the same
     * boundary an operator has always been able to decide by hand.
     */
    async function inspectReviewBoundary(runRoot: string): Promise<void> {
      const pauses = state.supervisionPauses ?? [];
      const pause = pauses.at(-1);
      const goal: ITtscEvidenceBenchmarkGoalRecord | undefined =
        state.goals.find((candidate) => candidate.index === pause?.goalIndex);
      if (pause === undefined || goal === undefined) return;
      pause.inspections ??= [];
      const attempt: number = pause.inspections.length + 1;
      if (attempt > EvidenceBenchmarkInspection.ATTEMPT_LIMIT) return;
      const inspectionStarted: bigint = process.hrtime.bigint();
      // The record exists before the attempt so that a failure at any point
      // after this line is retained as a failed inspection rather than as an
      // exception thrown once the measured process is already gone.
      const record: ITtscEvidenceBenchmarkInspection = {
        attempt,
        model: props.model,
        effort: props.effort,
        startedAt: new Date().toISOString(),
        elapsedMs: 0,
        tokenUsage: zeroUsage(),
        logRelativePath: EvidenceBenchmarkInspection.DIRECTORY,
        stageLogRelativePath: "",
      };
      pause.inspections.push(record);
      try {
        const request: EvidenceBenchmarkInspection.IRequest =
          EvidenceBenchmarkInspection.prepare({
            runRoot,
            pauseIndex: pauses.length - 1,
            attempt,
            goal,
            model: props.model,
            effort: props.effort,
          });
        record.logRelativePath = `${EvidenceBenchmarkInspection.DIRECTORY}/${request.prefix}`;
        record.stageLogRelativePath = request.stageLogRelativePath;
        const executable: ITtscEvidenceBenchmarkExecutable = resolveExecutable({
          name: "codex",
          environment: props.environment ?? process.env,
          command: props.command,
          commandPrefixArguments: props.commandPrefixArguments,
        });
        const streams = await runInspection(executable, request);
        record.elapsedMs = elapsed(inspectionStarted);
        const result: EvidenceBenchmarkInspection.IResult =
          EvidenceBenchmarkInspection.complete({
            runRoot,
            request,
            ...streams,
          });
        record.tokenUsage = result.tokenUsage;
        if (result.threadId !== undefined) record.threadId = result.threadId;
        EvidenceBenchmarkSupervision.apply({
          runRoot,
          workspace: props.cwd,
          instructionsRoot: props.instructionsRoot,
          state,
          submitted: result.submitted,
        });
      } catch (error) {
        record.elapsedMs = elapsed(inspectionStarted);
        record.failure = normalizeInterruption(error).message;
      }
    }

    /** Drives one inspecting Codex process to completion under a hard bound. */
    async function runInspection(
      executable: ITtscEvidenceBenchmarkExecutable,
      request: EvidenceBenchmarkInspection.IRequest,
    ): Promise<{
      stdout: string;
      stderr: string;
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }> {
      const inspector = spawn(
        executable.command,
        executable.composeArguments(request.arguments),
        {
          cwd: request.cwd,
          detached: process.platform !== "win32",
          env: props.environment ?? process.env,
          shell: false,
          windowsVerbatimArguments: executable.windowsVerbatimArguments,
          windowsHide: true,
          stdio: "pipe",
        },
      );
      let stdout = "";
      let stderr = "";
      let exitCode: number | null = null;
      let signal: NodeJS.Signals | null = null;
      let failure: unknown;
      inspector.stdout.setEncoding("utf8");
      inspector.stderr.setEncoding("utf8");
      inspector.stdout.on("data", (text: string) => {
        stdout += text;
      });
      inspector.stderr.on("data", (text: string) => {
        stderr += text;
      });
      let resolveClosed!: () => void;
      const closed = new Promise<void>((resolve) => {
        resolveClosed = resolve;
      });
      inspector.once("error", (error) => {
        failure ??= error;
        resolveClosed();
      });
      inspector.once("close", (code, terminated) => {
        exitCode = code;
        signal = terminated;
        resolveClosed();
      });
      inspector.stdin.on("error", (error) => {
        failure ??= error;
      });
      // The objective travels on standard input rather than as an argument.
      // It quotes a full instruction, and a Windows command shim would have to
      // survive escaping every byte of it on the way through `cmd.exe`.
      inspector.stdin.end(request.prompt, "utf8");
      const timeoutMs: number = props.inspectionTimeoutMs ?? 3_600_000;
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
        throw new Error(
          "Review inspection timeout must be a positive integer.",
        );
      if (!(await waitFor(closed, timeoutMs))) {
        if (inspector.pid !== undefined)
          await terminateProcessTree(inspector.pid);
        await waitFor(closed, 5_000);
        throw new Error(`Review inspection exceeded ${timeoutMs} ms.`);
      }
      if (failure !== undefined) throw failure;
      return { stdout, stderr, exitCode, signal };
    }

    return state;
  }

  /**
   * Returns the frozen objective sequence for an experiment arm.
   *
   * Each arm owns every instruction byte. Paths and positions remain comparable
   * without either arm reading a shared runtime objective.
   */
  export function instructionEntries(
    arm: EvidenceBenchmarkArm,
  ): readonly (readonly [string, string])[] {
    return EvidenceBenchmarkInstruction.entries(arm);
  }

  /** Returns the arm-owned continuation appended to every objective. */
  export function instructionContinuationPath(
    arm: EvidenceBenchmarkArm,
  ): string {
    return EvidenceBenchmarkInstruction.continuationPath(arm);
  }

  /** Reads and validates the exact Goal objective sent to Codex app-server. */
  export function instructionObjective(props: {
    arm: EvidenceBenchmarkArm;
    instructionsRoot: string;
    relativePath: string;
  }): {
    prescribedText: string;
    continuationText: string;
    objectiveText: string;
  } {
    return EvidenceBenchmarkInstruction.objective({
      arm: props.arm,
      instructionsRoot: props.instructionsRoot,
      entry: {
        relativePath: props.relativePath,
      },
    });
  }

  function validateCompletedState(
    state: ITtscEvidenceBenchmarkRunState,
    entries: readonly ITtscEvidenceBenchmarkInstructionPlanEntry[],
  ): void {
    if (
      state.nextInstructionIndex !== entries.length ||
      state.goals.length !== entries.length
    )
      throw new Error("Codex retained an invalid completed cursor.");
    const nativeStart: number = state.nativeThreadStartInstructionIndex ?? 0;
    if (
      !Number.isSafeInteger(nativeStart) ||
      nativeStart < 0 ||
      nativeStart >= entries.length ||
      (nativeStart !== 0 &&
        (nativeStart !== 1 ||
          state.checkpoints?.some(
            (checkpoint) => checkpoint.name === "backend-start",
          ) !== true))
    )
      throw new Error("Codex retained an invalid native thread boundary.");
    entries.forEach((entry, index) => {
      const record: ITtscEvidenceBenchmarkGoalRecord | undefined =
        state.goals.find((candidate) => candidate.index === index);
      const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
        index === 0
          ? undefined
          : state.goals.find((candidate) => candidate.index === index - 1);
      if (
        record === undefined ||
        record.name !== entry.name ||
        record.relativePath !== entry.relativePath ||
        record.objectiveText !==
          `${record.prescribedText}\n\n${record.continuationText}` ||
        (index >= nativeStart
          ? record.goal?.threadId !== state.sessionId
          : typeof record.goal?.threadId !== "string") ||
        !sameNativeGoalObjective(
          record.goal?.objective,
          record.objectiveText,
        ) ||
        record.goal?.status !== "complete" ||
        record.terminalTurnId === null ||
        !record.terminalTurnCompleted ||
        !record.threadIdle ||
        record.tokenUsageTurnId !== record.terminalTurnId ||
        record.tokenUsageEnd === null ||
        !usageAdvanced(record.tokenUsageEnd, record.tokenUsageStart) ||
        !sameUsage(
          record.tokenUsage,
          subtract(record.tokenUsageEnd, record.tokenUsageStart),
        ) ||
        (index === 0 || index === nativeStart
          ? !sameUsage(record.tokenUsageStart, zeroUsage())
          : previous?.tokenUsageEnd === null ||
            previous?.tokenUsageEnd === undefined ||
            !sameUsage(record.tokenUsageStart, previous.tokenUsageEnd))
      )
        throw new Error("Codex retained an invalid completed Goal.");
    });
    const last: ITtscEvidenceBenchmarkGoalRecord | undefined = state.goals.find(
      (candidate) => candidate.index === entries.length - 1,
    );
    if (
      last?.tokenUsageEnd === null ||
      last?.tokenUsageEnd === undefined ||
      !sameUsage(state.threadTokenUsage, last.tokenUsageEnd)
    )
      throw new Error("Codex retained invalid total measurements.");
    const terminal: ITtscEvidenceBenchmarkProcessRecord | undefined =
      state.processes.at(-1);
    if (
      terminal === undefined ||
      ((terminal.exitCode !== 0 || terminal.signal !== null) &&
        terminal.shutdownForced !== true)
    )
      throw new Error("Codex retained an invalid terminal process.");
  }

  function validateInstructionPlan(
    state: ITtscEvidenceBenchmarkRunState,
    entries: readonly ITtscEvidenceBenchmarkInstructionPlanEntry[],
  ): void {
    const legacy: boolean = entries.some(
      (entry) => entry.kind === "legacy-base",
    );
    if (legacy) {
      const expected = EvidenceBenchmarkInstruction.legacyPlan(state.arm);
      if (
        entries.length !== expected.length ||
        entries.some(
          (entry, index) =>
            entry.kind !== "legacy-base" ||
            entry.name !== expected[index]?.name ||
            entry.relativePath !== expected[index]?.relativePath ||
            entry.reviewScope !== undefined ||
            entry.reviewAttempt !== undefined ||
            entry.reviewFeedback !== undefined,
        ) ||
        (state.supervisionPauses?.length ?? 0) !== 0
      )
        throw new Error("Retained legacy instruction plan changed.");
    } else {
      const base: ITtscEvidenceBenchmarkInstructionPlanEntry[] =
        EvidenceBenchmarkInstruction.plan(state.arm);
      const retainedBase = entries.filter((entry) => entry.kind === "base");
      if (
        retainedBase.length !== base.length ||
        retainedBase.some(
          (entry, index) =>
            entry.name !== base[index]?.name ||
            entry.relativePath !== base[index]?.relativePath ||
            entry.reviewScope !== undefined ||
            entry.reviewAttempt !== undefined ||
            entry.reviewFeedback !== undefined,
        )
      )
        throw new Error("Retained benchmark base instruction plan changed.");
      let supplementCount = 0;
      for (const scope of ["backend", "frontend", "overall"] as const) {
        const review: number = entries.findIndex(
          (entry) => entry.kind === "base" && entry.name === `${scope}-review`,
        );
        const final: number = entries.findIndex(
          (entry) => entry.kind === "base" && entry.name === `${scope}-final`,
        );
        const supplements = entries.slice(review + 1, final);
        supplementCount += supplements.length;
        if (
          review < 0 ||
          final <= review ||
          supplements.some(
            (entry, index) =>
              state.arm !== "plain" ||
              entry.kind !== "review-supplement" ||
              entry.name !== `${scope}-remind-${index + 1}` ||
              entry.relativePath !== `plain/${scope}/remind.md` ||
              entry.reviewScope !== scope ||
              entry.reviewAttempt !== index + 1 ||
              entry.reviewFeedback?.trim().length === 0,
          ) ||
          supplements.length >
            EvidenceBenchmarkInstruction.REVIEW_SUPPLEMENT_LIMIT
        )
          throw new Error("Retained review supplementation plan is invalid.");
      }
      if (entries.length !== base.length + supplementCount)
        throw new Error("Retained review supplementation plan is invalid.");
    }
    if (
      state.nextInstructionIndex < 0 ||
      state.nextInstructionIndex > entries.length ||
      state.goals.some(
        (goal) =>
          goal.index < 0 ||
          goal.index >= entries.length ||
          goal.name !== entries[goal.index]?.name ||
          goal.relativePath !== entries[goal.index]?.relativePath,
      ) ||
      new Set(state.goals.map((goal) => goal.index)).size !== state.goals.length
    )
      throw new Error("Retained Goals do not match the instruction plan.");
    for (let index = 0; index < state.nextInstructionIndex; ++index) {
      const goal = state.goals.find((candidate) => candidate.index === index);
      if (
        goal?.goal?.status !== "complete" ||
        goal.terminalTurnId === null ||
        !goal.terminalTurnCompleted ||
        !goal.threadIdle ||
        goal.tokenUsageTurnId !== goal.terminalTurnId ||
        goal.tokenUsageEnd === null
      )
        throw new Error("Retained completed Goal prefix is invalid.");
    }
    if (state.goals.some((goal) => goal.index > state.nextInstructionIndex))
      throw new Error("Retained Goals extend beyond the current cursor.");
    validateReviewTransitions(state, entries);
  }

  function validateReviewTransitions(
    state: ITtscEvidenceBenchmarkRunState,
    entries: readonly ITtscEvidenceBenchmarkInstructionPlanEntry[],
  ): void {
    const completedBoundaries = entries
      .slice(0, state.nextInstructionIndex)
      .map((entry, goalIndex) => ({
        goalIndex,
        boundary: EvidenceBenchmarkInstruction.reviewBoundary(entry),
      }))
      .filter(
        (
          value,
        ): value is {
          goalIndex: number;
          boundary: { scope: EvidenceBenchmarkReviewScope; attempt: number };
        } => value.boundary !== undefined,
      );
    const pauses = state.supervisionPauses ?? [];
    if (state.arm === "evidence") {
      if (pauses.length !== 0)
        throw new Error("Evidence run retained a Plain review decision.");
      return;
    }
    if (pauses.length !== completedBoundaries.length)
      throw new Error("Plain review boundaries do not match retained pauses.");
    pauses.forEach((pause, index) => {
      const completed = completedBoundaries[index]!;
      const goal = state.goals.find(
        (candidate) => candidate.index === completed.goalIndex,
      );
      const verdict = pause.verdict;
      const latest = index === pauses.length - 1;
      if (
        pause.scope !== completed.boundary.scope ||
        pause.attempt !== completed.boundary.attempt ||
        pause.goalIndex !== completed.goalIndex ||
        pause.afterGoal !== entries[completed.goalIndex]?.name ||
        goal?.name !== pause.afterGoal ||
        goal.terminalTurnId === null ||
        !goal.terminalTurnCompleted ||
        !goal.threadIdle
      )
        throw new Error(
          "Plain review pause does not match its completed Goal.",
        );
      if (verdict === undefined) {
        if (
          !latest ||
          (state.status !== "awaiting-review-verdict" &&
            (state.status !== "running" || state.interruption !== undefined)) ||
          pause.resumedAt !== undefined ||
          state.nextInstructionIndex !== pause.goalIndex + 1
        )
          throw new Error("Plain review pause lacks its required verdict.");
        return;
      }
      const next = entries[pause.goalIndex + 1];
      const pendingResume =
        latest &&
        state.status === "awaiting-review-verdict" &&
        state.nextInstructionIndex === pause.goalIndex + 1;
      if (
        verdict.scope !== pause.scope ||
        verdict.attempt !== pause.attempt ||
        verdict.goalIndex !== pause.goalIndex ||
        verdict.terminalTurnId !== goal.terminalTurnId ||
        ((verdict.decision === "pass" || verdict.action === "final") &&
          (verdict.decision !== "pass" ||
            verdict.action !== "final" ||
            next?.kind !== "base" ||
            next.name !== `${pause.scope}-final`)) ||
        ((verdict.decision === "fail" || verdict.action === "retry") &&
          verdict.action !== "quality-failed" &&
          (verdict.decision !== "fail" ||
            verdict.action !== "retry" ||
            next?.kind !== "review-supplement" ||
            next.reviewScope !== pause.scope ||
            next.reviewAttempt !== pause.attempt + 1 ||
            next.reviewFeedback !== verdict.feedback)) ||
        (pendingResume
          ? pause.resumedAt !== undefined || verdict.action === "quality-failed"
          : verdict.action === "quality-failed"
            ? !latest ||
              state.status !== "quality-failed" ||
              verdict.decision !== "fail" ||
              pause.attempt !==
                EvidenceBenchmarkInstruction.REVIEW_SUPPLEMENT_LIMIT ||
              pause.resumedAt !== undefined ||
              state.nextInstructionIndex !== pause.goalIndex + 1
            : pause.resumedAt === undefined)
      )
        throw new Error("Plain review verdict transition is invalid.");
    });
  }

  function nativeGoalElapsedMs(
    state: ITtscEvidenceBenchmarkRunState,
    record: ITtscEvidenceBenchmarkGoalRecord,
  ): number {
    const cumulative: unknown = record.goal?.timeUsedSeconds;
    const previous: ITtscEvidenceBenchmarkGoalRecord | undefined =
      record.index === 0
        ? undefined
        : state.goals.find((candidate) => candidate.index === record.index - 1);
    const baseline: unknown =
      record.index === state.nativeThreadStartInstructionIndex
        ? 0
        : (previous?.goal?.timeUsedSeconds ?? 0);
    if (
      typeof cumulative !== "number" ||
      !Number.isFinite(cumulative) ||
      cumulative < 0 ||
      typeof baseline !== "number" ||
      !Number.isFinite(baseline) ||
      baseline < 0 ||
      cumulative < baseline
    )
      throw new Error("Codex retained an invalid native Goal time boundary.");
    return (cumulative - baseline) * 1_000;
  }

  function isRecoverableCompletedCleanup(
    state: ITtscEvidenceBenchmarkRunState,
  ): boolean {
    const terminal: ITtscEvidenceBenchmarkProcessRecord | undefined =
      state.processes.at(-1);
    return (
      state.interruption?.message === PROCESS_CLEANUP_ERROR &&
      terminal?.shutdownForced === true &&
      (terminal.processId === undefined || !isProcessAlive(terminal.processId))
    );
  }

  /**
   * Resolves a native CLI into a shell-free cross-platform invocation.
   *
   * POSIX binaries receive arguments directly, while Windows command shims
   * receive one correctly escaped `cmd.exe` command line.
   */
  export function resolveExecutable(props: {
    name: "codex";
    environment: NodeJS.ProcessEnv;
    command?: string;
    commandPrefixArguments?: readonly string[];
  }): ITtscEvidenceBenchmarkExecutable {
    if (props.command !== undefined) {
      const prefix: readonly string[] = props.commandPrefixArguments ?? [];
      return {
        command: props.command,
        composeArguments: (arguments_) => [...prefix, ...arguments_],
        windowsVerbatimArguments: false,
      };
    }
    if (process.platform !== "win32")
      return {
        command: props.name,
        composeArguments: (arguments_) => [...arguments_],
        windowsVerbatimArguments: false,
      };
    const executable: string | undefined = locateWindowsCommand(
      props.name,
      props.environment,
    );
    if (executable === undefined)
      throw new Error(`${props.name} was not found on PATH.`);
    if (path.extname(executable).toLowerCase() === ".exe")
      return {
        command: executable,
        composeArguments: (arguments_) => [...arguments_],
        windowsVerbatimArguments: false,
      };
    const command: string | undefined = readEnvironment(
      props.environment,
      "ComSpec",
    );
    if (command === undefined)
      throw new Error("Windows command processor was not found.");
    return {
      command,
      composeArguments: (arguments_) => {
        const shellCommand: string = [
          escapeWindowsCommand(executable),
          ...arguments_.map(escapeWindowsArgument),
        ].join(" ");
        return ["/d", "/s", "/c", `"${shellCommand}"`];
      },
      windowsVerbatimArguments: true,
    };
  }

  function validateNativeGoal(
    record: ITtscEvidenceBenchmarkGoalRecord,
    goal: Record<string, unknown>,
    threadId: string,
  ): void {
    if (
      goal.threadId !== threadId ||
      !sameNativeGoalObjective(goal.objective, record.objectiveText)
    )
      throw new Error(
        "Native Goal does not match the retained thread and objective.",
      );
  }

  function sameNativeGoalObjective(actual: unknown, expected: string): boolean {
    if (typeof actual !== "string") return false;
    const canonicalize = (value: string): string =>
      value.replace(/\r\n/gu, "\n").replace(/[\r\n]+$/u, "");
    return canonicalize(actual) === canonicalize(expected);
  }

  function isRetainedGoalStatus(value: unknown): boolean {
    return (
      value === "active" ||
      value === "complete" ||
      isInterruptedGoalStatus(value)
    );
  }

  function isInterruptedGoalStatus(value: unknown): boolean {
    return (
      value === "paused" ||
      value === "blocked" ||
      value === "usageLimited" ||
      value === "budgetLimited"
    );
  }

  function canOwnInterruptedUsageReplay(value: unknown): boolean {
    return value === "active" || isInterruptedGoalStatus(value);
  }

  /**
   * Reads one Windows environment variable without depending on its spelling.
   *
   * `process.env` is case-insensitive on Windows, but the sanitized copy the
   * runner passes to children is an ordinary object, so a shell that exports
   * `COMSPEC` rather than `ComSpec` would otherwise look unset.
   */
  function readEnvironment(
    environment: NodeJS.ProcessEnv,
    name: string,
  ): string | undefined {
    const wanted: string = name.toUpperCase();
    for (const [key, value] of Object.entries(environment))
      if (key.toUpperCase() === wanted && value !== undefined) return value;
    return undefined;
  }

  function locateWindowsCommand(
    name: string,
    environment: NodeJS.ProcessEnv,
  ): string | undefined {
    const result = spawnSync("where.exe", [name], {
      encoding: "utf8",
      env: environment,
      shell: false,
      windowsHide: true,
    });
    if (result.status !== 0) return undefined;
    return (result.stdout ?? "").split(/\r?\n/).find((candidate) => {
      const extension: string = path.extname(candidate).toLowerCase();
      return extension === ".exe" || extension === ".cmd";
    });
  }

  function escapeWindowsCommand(value: string): string {
    return value.replace(/([()\][%!^"`<>&|;, *?])/g, "^$1");
  }

  function escapeWindowsArgument(value: string): string {
    let output: string = value
      .replace(/(?=(\\+?)?)\1"/g, '$1$1\\"')
      .replace(/(?=(\\+?)?)\1$/g, "$1$1");
    output = `"${output}"`;
    return escapeWindowsCommand(output);
  }

  function tokenUsage(
    params: Record<string, unknown>,
  ): ITtscEvidenceBenchmarkTokenUsage | undefined {
    const tokenUsage: Record<string, unknown> | undefined = object(
      params.tokenUsage,
      false,
    );
    const total: Record<string, unknown> | undefined = object(
      tokenUsage?.total,
      false,
    );
    if (total === undefined) return undefined;
    return typia.is<ITtscEvidenceBenchmarkTokenUsage>(total)
      ? total
      : undefined;
  }

  function subtract(
    endpoint: ITtscEvidenceBenchmarkTokenUsage,
    baseline: ITtscEvidenceBenchmarkTokenUsage,
  ): ITtscEvidenceBenchmarkTokenUsage {
    return {
      totalTokens: endpoint.totalTokens - baseline.totalTokens,
      inputTokens: endpoint.inputTokens - baseline.inputTokens,
      cachedInputTokens:
        endpoint.cachedInputTokens - baseline.cachedInputTokens,
      cacheWriteInputTokens:
        endpoint.cacheWriteInputTokens - baseline.cacheWriteInputTokens,
      outputTokens: endpoint.outputTokens - baseline.outputTokens,
      reasoningOutputTokens:
        endpoint.reasoningOutputTokens - baseline.reasoningOutputTokens,
    };
  }

  function usageAdvanced(
    endpoint: ITtscEvidenceBenchmarkTokenUsage,
    baseline: ITtscEvidenceBenchmarkTokenUsage,
  ): boolean {
    const fields: readonly (keyof ITtscEvidenceBenchmarkTokenUsage)[] = [
      "totalTokens",
      "inputTokens",
      "cachedInputTokens",
      "cacheWriteInputTokens",
      "outputTokens",
      "reasoningOutputTokens",
    ];
    return (
      endpoint.totalTokens > baseline.totalTokens &&
      fields.every((field) => endpoint[field] >= baseline[field])
    );
  }

  function sameUsage(
    left: ITtscEvidenceBenchmarkTokenUsage,
    right: ITtscEvidenceBenchmarkTokenUsage,
  ): boolean {
    return (
      left.totalTokens === right.totalTokens &&
      left.inputTokens === right.inputTokens &&
      left.cachedInputTokens === right.cachedInputTokens &&
      left.cacheWriteInputTokens === right.cacheWriteInputTokens &&
      left.outputTokens === right.outputTokens &&
      left.reasoningOutputTokens === right.reasoningOutputTokens
    );
  }

  function zeroUsage(): ITtscEvidenceBenchmarkTokenUsage {
    return {
      totalTokens: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteInputTokens: 0,
      outputTokens: 0,
      reasoningOutputTokens: 0,
    };
  }

  function normalizeInterruption(
    value: unknown,
  ): ITtscEvidenceBenchmarkInterruption {
    const source: Record<string, unknown> | undefined = object(value, false);
    const detail: unknown = serializable(value);
    const message: string =
      value instanceof Error
        ? value.message
        : typeof source?.message === "string"
          ? source.message
          : typeof value === "string"
            ? value
            : (JSON.stringify(detail) ?? String(detail));
    return {
      name:
        value instanceof Error
          ? value.name
          : typeof source?.name === "string"
            ? source.name
            : "BenchmarkInterruption",
      message,
      ...(value instanceof Error && value.stack !== undefined
        ? { stack: value.stack }
        : typeof source?.stack === "string"
          ? { stack: source.stack }
          : {}),
      ...(detail === undefined ? {} : { detail }),
    };
  }

  function serializable(value: unknown): unknown {
    try {
      const text: string | undefined = JSON.stringify(
        value,
        (_key, member: unknown) =>
          typeof member === "bigint" ? member.toString() : member,
      );
      return text === undefined ? String(value) : JSON.parse(text);
    } catch {
      return String(value);
    }
  }

  function object(value: unknown, required?: true): Record<string, unknown>;
  function object(
    value: unknown,
    required: false,
  ): Record<string, unknown> | undefined;
  function object(
    value: unknown,
    required = true,
  ): Record<string, unknown> | undefined {
    if (typia.is<Record<string, unknown>>(value)) return value;
    if (required) throw new Error("Codex app-server message is invalid.");
    return undefined;
  }

  function elapsed(started: bigint): number {
    return Number(process.hrtime.bigint() - started) / 1_000_000;
  }

  function isProcessAlive(targetPid: number): boolean {
    try {
      process.kill(targetPid, 0);
      return true;
    } catch {
      return false;
    }
  }

  function monitorProcess(
    ownerPid: number,
    targetPid: number,
    onError: (error: Error) => void,
  ): void {
    const monitor = spawn(
      process.execPath,
      [
        path.join(
          __dirname,
          "executable",
          "EvidenceBenchmarkProcessMonitor.mjs",
        ),
        String(ownerPid),
        String(targetPid),
      ],
      {
        detached: true,
        shell: false,
        stdio: "ignore",
        windowsHide: true,
      },
    );
    monitor.once("error", onError);
    monitor.unref();
  }

  async function terminateProcessTree(targetPid: number): Promise<void> {
    if (process.platform !== "win32") {
      try {
        process.kill(-targetPid, "SIGKILL");
      } catch {
        try {
          process.kill(targetPid, "SIGKILL");
        } catch {
          // The app-server exited between the timeout and cleanup.
        }
      }
      return;
    }
    await new Promise<void>((resolve) => {
      const cleanup = spawn(
        "taskkill.exe",
        ["/pid", String(targetPid), "/T", "/F"],
        {
          shell: false,
          stdio: "ignore",
          windowsHide: true,
        },
      );
      cleanup.once("error", () => resolve());
      cleanup.once("close", () => resolve());
    });
  }

  async function waitFor(
    promise: Promise<void>,
    timeoutMs: number,
  ): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise.then(() => true),
        new Promise<false>((resolve) => {
          timer = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
