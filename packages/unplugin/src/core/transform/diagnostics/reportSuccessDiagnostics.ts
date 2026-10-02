import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { formatDiagnostics } from "./formatDiagnostics";

/**
 * Attempt non-fatal diagnostic reporting once per generation per pass.
 *
 * A `success` result may still carry warnings or informational messages from
 * plugins — `@ttsc/lint` reports every rule below error severity this way.
 * The ordinary reporting path uses stderr without turning diagnostics into a
 * compile error. Failure and exception envelopes are handled by the caller.
 *
 * They describe one compile of one program, so writing them per delivery
 * printed the same warning once per module and scaled the noise with exactly
 * the reuse the cache exists to provide (samchon/ttsc#1304). A pass that reuses
 * a retained generation still attempts reporting once, because a build's
 * warnings are part of what that build reports; a host with no pass boundary
 * attempts them once per generation, which is the same rule with one pass.
 * Reporting state is recorded before formatting and writing. A synchronous
 * formatter or stream failure propagates without undoing suppression; this
 * state does not certify that the stream successfully displayed a message.
 *
 * @evidence contracts/common.md#principled-implementation Only nonempty success-envelope diagnostics enter a reporting attempt per delivery epoch, so the failure formatter's empty-list fallback cannot turn an ordinary success into a misleading failure report. Reporting state records the attempt before formatting or stream output.
 * @evidence contracts/common.md#clear-and-simple-design Result gating and generation-owned reporting state keep nonfatal reporting separate from compilation failure handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Severity and success follow the structured envelope rather than warning-text matching, and an empty success list does not manufacture a failure diagnostic.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain nonfatal diagnostics and why both retained generations and fresh passes must report them once.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Forwards formatted structured text to the existing stderr stream, without
 *   resolving supplied locations, selecting an executable or interpreting
 *   native path identity or capabilities. Text can contain multiple lines.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed envelope/epoch gates avoid formatting on suppressed deliveries.
 *   An admitted attempt projects every diagnostic, strips CSI escapes and
 *   joins locations/messages: work and temporary text scale with diagnostic
 *   count and total rendered text. Stream output adds the message byte cost.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The generation's fixed diagnostic envelope and mutable reporting fields
 *   skip formatting and writing for repeated requests in the recorded epoch.
 *   Undefined persistent epochs still admit the first attempt because the
 *   boolean is separate. Failed attempts retain suppression rather than
 *   claiming success.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Two scalar reporting fields remain with the generation without per-request
 *   history. Formatted text is not cached here; stderr owns buffered bytes and
 *   backpressure. This reporter acquires no independent handle or running task.
 */
export function reportSuccessDiagnostics(
  /** Generation owning structured diagnostics and attempted-report state. */
  cached: TtscCachedProjectTransform,
  /** Delivery pass, or undefined for persistent generation reporting. */
  epoch: number | undefined,
): void {
  const result = cached.result;
  if (
    result.type !== "success" ||
    result.diagnostics === undefined ||
    result.diagnostics.length === 0
  ) {
    return;
  }
  if (
    cached.diagnosticsReported === true &&
    cached.diagnosticsEpoch === epoch
  ) {
    return;
  }
  cached.diagnosticsReported = true;
  cached.diagnosticsEpoch = epoch;
  const text = formatDiagnostics(result.diagnostics);
  if (text.length !== 0) {
    process.stderr.write(`${text}\n`);
  }
}
