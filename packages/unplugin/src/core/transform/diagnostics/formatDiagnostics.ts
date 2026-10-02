import type { ITtscCompilerDiagnostic } from "ttsc";

import { stripTerminalEscapes } from "./stripTerminalEscapes";

/**
 * Format a compiler diagnostic list into a human-readable string.
 *
 * Produces `"file: line:col: message"` entries joined by newlines, matching the
 * output style of `tsc`. When the list is empty (e.g. a failure with no
 * attached diagnostics) returns a generic fallback message so the thrown
 * `Error` is never empty.
 *
 * @evidence contracts/common.md#principled-implementation Structured compiler locations and messages are rendered without inferring error categories from their text; the empty-list fallback belongs to failure formatting.
 * @evidence contracts/common.md#clear-and-simple-design One projection joins present location components and delegates terminal escape removal to its single owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Formatting preserves diagnostic order and supplied positions rather than substituting expected fixture messages or synthetic success.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the rendered shape and explains why an empty failure still needs a message.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Maps the diagnostics once; each message is stripped once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function formatDiagnostics(
  diagnostics: ITtscCompilerDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "ttsc transform failed";
  }
  return diagnostics
    .map((diag) =>
      [
        diag.file ?? "ttsc",
        diag.line === undefined
          ? undefined
          : `${diag.line}:${diag.character ?? 1}`,
        stripTerminalEscapes(diag.messageText),
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(": "),
    )
    .join("\n");
}
