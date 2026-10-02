import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Synthesize one structured diagnostic from a non-zero process result that
 * produced no parsable diagnostics, carrying the captured stderr/stdout as the
 * message. Shared by the public API result mapping and the plugin-failure
 * recovery pass so the failure text is never dropped from structured output.
 *
 * @evidence contracts/common.md#principled-implementation A process-level error has no source file and uses TTSC_PROCESS; captured stderr takes precedence over stdout, with actual exit status as the empty-output fallback.
 * @evidence contracts/common.md#clear-and-simple-design One adapter supplies the same process-failure representation to API mapping and plugin fallback rather than duplicating their message policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The stable process diagnostic code is a product discriminant; message content comes from the real result rather than a fixture-specific synthetic compiler error.
 * @evidence contracts/common.md#meaningful-documentation Native documentation gives the intended nonzero, unparsed-result premise and explains why callers share this mapping.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources createProcessDiagnostic declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms createProcessDiagnostic declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work createProcessDiagnostic declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation createProcessDiagnostic is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
 */
export function createProcessDiagnostic(
  result: TtscBuildResult,
): ITtscCompilerDiagnostic {
  const messageText =
    (result.stderr || result.stdout).trim() ||
    `ttsc exited with status ${result.status}`;
  return {
    category: "error",
    code: "TTSC_PROCESS",
    file: null,
    messageText,
  };
}
