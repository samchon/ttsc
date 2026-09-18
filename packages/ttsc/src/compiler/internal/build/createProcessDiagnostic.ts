import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Synthesize one structured diagnostic from a non-zero process result that
 * produced no parsable diagnostics, carrying the captured stderr/stdout as the
 * message. Shared by the public API result mapping and the plugin-failure
 * recovery pass so the failure text is never dropped from structured output.
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
