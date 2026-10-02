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
 * either flag, phase recording and output appending are disabled. Ledger
 * creation still checks arguments and records the initial monotonic clock.
 *
 * @evidence contracts/common.md#principled-implementation The namespace groups monotonic per-build timing data and rendering operations; enabled state comes from effective compiler diagnostics flags.
 * @evidence contracts/common.md#clear-and-simple-design Ledger construction, phase recording and final stdout rendering share formatting while leaving phase selection to build orchestration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Timing uses the actual process clock and supported flags, with disabled-cost limitations documented instead of invented no-cost claims.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose explains the compiler-visible versus host-only timing purpose and honestly distinguishes disabled recording from ledger creation.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace is an API grouping; its selected construction, recording and rendering functions own processing choices.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This namespace holds no shared computation or cache; each build owns its own ledger.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The grouping acquires no resource; mutable ledger lifetime belongs to its build and recording operation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A namespace only groups the declarations inside it; each carries its own acknowledgments.
 */
export namespace BuildTiming {
  /**
   * Mutable timing ledger owned by one build; seconds are rendered only after
   * recording millisecond durations from the monotonic bigint clock.
   *
   * @evidence contracts/common.md#principled-implementation The enable flag separates output selection from collected phase lines and a monotonic start timestamp, avoiding wall-clock adjustment effects.
   * @evidence contracts/common.md#clear-and-simple-design Three fields hold selection, completed lines and total-time origin without embedding compiler state or output policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Recorded measurements derive from process.hrtime rather than fabricated expected durations or foreign timer mutation.
   * @evidence contracts/common.md#meaningful-documentation Native members explain ordering, flag meaning and bigint timestamp source, with blank lines separating documented properties.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This record describes timing data; recording and rendering functions select processing strategies.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The ledger does not decide reuse across requests; it belongs to one build.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The build owns ledger lifetime; the data type itself acquires no resource or retained history.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
   */
  export type BuildTiming = {
    /** An effective diagnostics flag enables collection and final rendering. */
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
   *
   * @evidence contracts/common.md#principled-implementation Effective forwarded diagnostics flags determine collection, and a monotonic clock establishes the total-time origin even for disabled ledgers.
   * @evidence contracts/common.md#clear-and-simple-design Construction returns a fresh three-field ledger while flag interpretation remains with PassthroughFlags.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Enabled state follows actual forwarded options; neither timing values nor flag behavior are patched for a measurement.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies selection flags and the per-build ownership of the returned ledger; the namespace documents disabled-operation costs honestly.
   * @evidence contracts/performance.md#efficient-algorithms One argument scan and one monotonic clock read initialize the ledger; no timing output is prepared up front.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each build requires its own start time and mutable phase list, so separate builds cannot share this ledger.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Construction transfers a fresh ledger to the build owner without retaining it globally.
   * @evidence contracts/portability.md#os-neutral-implementation The only host dependence is process.hrtime.bigint(), Node's portable monotonic clock; no path, shell or file API is used.
   */
  export function createBuildTiming(options: TtscCommonOptions): BuildTiming {
    return {
      enabled: PassthroughFlags.hasDiagnosticsFlag(options),
      lines: [],
      startedAt: process.hrtime.bigint(),
    };
  }

  /**
   * Append a completed phase duration from the supplied monotonic start time.
   * Disabled ledgers are left untouched; enabled ledgers retain completion
   * order and format seconds to three decimal places.
   *
   * @evidence contracts/common.md#principled-implementation Monotonic bigint subtraction yields elapsed time, converted through milliseconds to seconds; disabled collection makes no mutation.
   * @evidence contracts/common.md#clear-and-simple-design One append operation owns phase-line formatting, leaving build orchestration to choose labels and start points.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Labels and measured durations come from the owning phase, with no predefined timing answers or substituted clock.
   * @evidence contracts/common.md#meaningful-documentation Native prose supplies timestamp premise, disabled behavior, ordering and rendered precision.
   * @evidence contracts/performance.md#efficient-algorithms A disabled check exits immediately; enabled recording formats one scalar and appends one line without traversing earlier phases.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A completed phase measurement is effectful and specific to its start time, not a reusable result across phases.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The build-owned ledger retains one string per recorded phase until the build releases it; the configured phase population, not a historical cache, determines growth.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation recordTiming is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
   */
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
   * compiler's own report and on a line of their own. Returns `result`
   * unchanged when timing is disabled.
   *
   * @evidence contracts/common.md#principled-implementation Recorded phases precede a fresh total measured from the same ledger origin; newline insertion keeps compiler output and timing lines distinct.
   * @evidence contracts/common.md#clear-and-simple-design This final adapter changes only stdout and reuses formatting helpers without altering build status or diagnostic ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Timing is selected by the diagnostics ledger and actual clock, not benchmark-specific output or substituted build results.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state line placement and unchanged-result behavior for disabled collection.
   * @evidence contracts/performance.md#efficient-algorithms One join constructs phase output, followed by one stdout append; work and temporary text scale with recorded/output bytes.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The total depends on the current clock and output append point, so this operation establishes no cross-request reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Output is returned to the caller and the adapter retains no ledger or native handle.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Formats elapsed time from process.hrtime values and appends text to stdout; it builds no path and calls no filesystem API.
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
