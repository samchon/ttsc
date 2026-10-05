import { stripTerminalEscapes } from "./stripTerminalEscapes";

/**
 * Render any thrown value as plain text for a bundler's error channel.
 *
 * Errors and error-shaped objects contribute their message, and anything else
 * is stringified. ANSI CSI escape sequences are stripped, because the text ends
 * up in a Vite overlay, a webpack report, or a CI annotation, where colour
 * codes render as noise around the file and line the reader needs. Other
 * terminal protocols remain outside the escape-removal helper's grammar.
 *
 * @evidence contracts/common.md#principled-implementation Error instances and message-bearing objects contribute their message; remaining thrown values use JavaScript string conversion before removing terminal control sequences.
 * @evidence contracts/common.md#clear-and-simple-design Three direct representation cases share one escape-removal helper instead of introducing a separate exception taxonomy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The formatter does not guess recovery or success from message text and does not mutate the thrown object.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs describe opaque thrown values and explain why terminal rendering cannot be carried into bundler reports.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed representation branches select one message and delegate one CSI
 *   scan, linear in message length. Message accessors and String conversion
 *   can invoke caller code, whose cost and failures are not bounded here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return stripTerminalEscapes(error.message);
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return stripTerminalEscapes(error.message);
  }
  return stripTerminalEscapes(String(error));
}
