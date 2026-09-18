import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { BuildExecution } from "./BuildExecution";
import { BuildTiming } from "./BuildTiming";
import type { RunBuildOptions } from "./RunBuildOptions";

/**
 * Run `ttsc` against a tsconfig. Returns once the binary exits so the CLI can
 * decide how to surface diagnostics. Does not throw on non-zero exit.
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
