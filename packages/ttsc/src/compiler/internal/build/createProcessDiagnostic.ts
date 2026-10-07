import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Synthesize one structured diagnostic from a non-zero process result that
 * produced no parsable diagnostics. A truthy stderr string is selected before
 * stdout and then trimmed; an empty trimmed selection falls back to exit
 * status. Public API mapping and plugin-failure recovery share this policy,
 * which does not preserve every captured byte or both streams.
 *
 * @evidence contracts/common.md#principled-implementation A process-level error has no source file and uses TTSC_PROCESS; captured stderr takes precedence over stdout, with actual exit status as the empty-output fallback.
 * @evidence contracts/common.md#clear-and-simple-design One adapter supplies the same process-failure representation to API mapping and plugin fallback rather than duplicating their message policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The stable process diagnostic code is a product discriminant; message content comes from the real result rather than a fixture-specific synthetic compiler error.
 * @evidence contracts/common.md#meaningful-documentation Native documentation gives the intended nonzero, unparsed-result premise and explains why callers share this mapping.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned diagnostic transfers its selected message to the caller; this adapter acquires no handle, task or persistent state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This single-result adapter delegates string trimming and constructs a fixed-shape diagnostic. Work depends on selected text length, but it selects no independent growing-population algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The supplied result is current input; this adapter owns no stable producer capture or cross-call cache.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Captured streams and status are supplied data, file is null, and this adapter performs no native path, filesystem or process operation.
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
