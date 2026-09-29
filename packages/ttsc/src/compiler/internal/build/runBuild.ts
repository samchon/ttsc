import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { BuildExecution } from "./BuildExecution";
import { BuildTiming } from "./BuildTiming";
import type { RunBuildOptions } from "./RunBuildOptions";

/**
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the CLI can
 * decide how to surface diagnostics. Non-zero process exit is returned as a
 * result; configuration resolution and process-launch failures may throw.
 *
 * Project-free terminal flags bypass project/plugin setup when applicable.
 * Required emit provenance preserves compiler selection and exposes unknown
 * ownership when the selected producer cannot establish the requested
 * relation.
 *
 * @evidence contracts/common.md#principled-implementation Shared preparation selects project and plugins before execution, while project-free terminal requests take their supported direct compiler path; timing is appended after the resulting build phase.
 * @evidence contracts/common.md#clear-and-simple-design The public synchronous entry owns timing and delegates setup/execution to BuildExecution, keeping the same build policy available to watch sessions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Terminal bypass follows compiler flag semantics and plugin failures remain visible; no retry hides configuration or spawn errors.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes returned exit failures from thrown setup/launch errors and explains the project-free branch.
 * @evidence contracts/portability.md#os-neutral-implementation Execution selection and spawning use the shared native path/process boundaries with cwd and separate argv, rather than constructing a shell command here.
 * @evidence contracts/performance.md#efficient-algorithms One timing ledger and one selected preparation/execution path are used; total work is dominated by actual compiler/plugin operations, not repeated orchestration scans.
 * @evidence contracts/performance.md#reuse-equivalent-work A resolved execution context is carried through preparation and execution, so this build does not reload its plugin selection between phases.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous process operations finish before return; the ledger and execution state live for this build and no resident process is retained by this entry point.
 */
export function runBuild(options: RunBuildOptions = {}): TtscBuildResult {
  const timing = BuildTiming.createBuildTiming(options);
  const result = runBuildTimed(options, timing);
  return BuildTiming.appendTimingOutput(result, timing);
}

function runBuildTimed(
  options: RunBuildOptions,
  timing: BuildTiming.BuildTiming,
): TtscBuildResult {
  const projectFree = BuildExecution.runProjectFreeTerminalFlag(options);
  if (projectFree !== null) return projectFree;
  const setupStartedAt = process.hrtime.bigint();
  const execution = BuildExecution.resolveExecutionContext(options);
  return runBuildWithExecution(options, timing, execution, setupStartedAt);
}

function runBuildWithExecution(
  options: RunBuildOptions,
  timing: BuildTiming.BuildTiming,
  execution: ReturnType<typeof BuildExecution.resolveExecutionContext>,
  setupStartedAt: bigint,
): TtscBuildResult {
  const prepared = BuildExecution.prepareBuildExecution(
    options,
    timing,
    execution,
    setupStartedAt,
  );
  if (prepared.result !== undefined) return prepared.result;
  return BuildExecution.runPreparedBuild(
    options,
    timing,
    execution,
    prepared.buildOptions,
  );
}
