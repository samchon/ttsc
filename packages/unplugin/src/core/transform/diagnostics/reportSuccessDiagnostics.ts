import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { formatDiagnostics } from "./formatDiagnostics";

/**
 * Forward non-fatal plugin diagnostics to stderr, once per generation per pass.
 *
 * A `success` result may still carry warnings or informational messages from
 * plugins — `@ttsc/lint` reports every rule below error severity this way.
 * These are surfaced via stderr rather than throwing so the build continues.
 * Failures and exceptions are handled by the caller.
 *
 * They describe one compile of one program, so writing them per delivery
 * printed the same warning once per module and scaled the noise with exactly
 * the reuse the cache exists to provide (samchon/ttsc#1304). A pass that reuses
 * a retained generation still surfaces them once, because a build's warnings
 * are part of what that build reports; a host with no pass boundary surfaces
 * them once per generation, which is the same rule with one pass.
 *
 * @evidence contracts/common.md#principled-implementation Only nonempty success-envelope diagnostics are forwarded once per delivery epoch, so the failure formatter's empty-list fallback cannot turn an ordinary success into a misleading failure report.
 * @evidence contracts/common.md#clear-and-simple-design Result gating and generation-owned reporting state keep nonfatal reporting separate from compilation failure handling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Severity and success follow the structured envelope rather than warning-text matching, and an empty success list does not manufacture a failure diagnostic.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain nonfatal diagnostics and why both retained generations and fresh passes must report them once.
 */
export function reportSuccessDiagnostics(
  cached: TtscCachedProjectTransform,
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
