import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import { PassthroughFlags } from "./PassthroughFlags";

/**
 * Wall-clock timing lines ttsc adds to a build's standard output.
 *
 * TypeScript-Go prints its own phase timings under `--diagnostics` and
 * `--extendedDiagnostics`; ttsc spends time the compiler cannot see (plugin
 * loading, source-plugin builds, the transform host), so the same flags make
 * ttsc append its own phases and a total after the compiler's report. Without
 * either flag every operation here is a no-op, so a build never pays for it.
 */
export namespace BuildTiming {
  /** The timing ledger of one build. */
  export type BuildTiming = {
    /** A diagnostics flag was forwarded, so timings are collected at all. */
    enabled: boolean;

    /** Finished phase lines, in completion order, e.g. `plugin load: 0.12s`. */
    lines: string[];

    /** `process.hrtime.bigint()` when the build began, for the total line. */
    startedAt: bigint;
  };

  /**
   * Start a ledger for one build. Collection is enabled exactly when the
   * forwarded arguments contain an enabled `--diagnostics` or
   * `--extendedDiagnostics`, spelled however the compiler accepts it.
   */
  export function createBuildTiming(options: TtscCommonOptions): BuildTiming {
    return {
      enabled: PassthroughFlags.hasDiagnosticsFlag(options),
      lines: [],
      startedAt: process.hrtime.bigint(),
    };
  }

  /** Record one finished phase that began at `startedAt`. */
  export function recordTiming(
    timing: BuildTiming,
    label: string,
    startedAt: bigint,
  ): void {
    if (!timing.enabled) return;
    timing.lines.push(`${label}: ${formatTimingSeconds(hrtimeMs(startedAt))}`);
  }

  /**
   * Append the recorded phases and the total to `result.stdout`, after the
   * compiler's own report and on a line of their own. Returns `result` unchanged
   * when timing is disabled.
   */
  export function appendTimingOutput(
    result: TtscBuildResult,
    timing: BuildTiming,
  ): TtscBuildResult {
    if (!timing.enabled) return result;
    const lines = [
      ...timing.lines,
      `ttsc total time: ${formatTimingSeconds(hrtimeMs(timing.startedAt))}`,
    ];
    return {
      ...result,
      stdout: appendStdout(result.stdout, lines.join("\n") + "\n"),
    };
  }

  function appendStdout(stdout: string, text: string): string {
    if (stdout.length === 0 || stdout.endsWith("\n")) return stdout + text;
    return `${stdout}\n${text}`;
  }

  function hrtimeMs(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1e6;
  }

  function formatTimingSeconds(ms: number): string {
    return `${(ms / 1000).toFixed(3)}s`;
  }
}
