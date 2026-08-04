import fs from "node:fs";

interface DescriptorProcessResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
}

/**
 * Classify the ways the isolated TypeScript descriptor evaluator can stop.
 *
 * The loader writes the child's own output straight to this process's stderr,
 * so a diagnostic has already reached the user by the time anything here runs.
 * What is left to say is only how the process ended: it never launched,
 * something outside killed it, or it exited non-zero after printing its own
 * reason.
 *
 * Nothing is bounded here — not time, not output. Both were the compiler
 * deciding, on numbers nobody chose for this machine, that a user's own
 * descriptor had run too long or said too much. Neither is this process's
 * memory to spend either, because the child's streams are no longer collected
 * into it.
 */
export function pluginDescriptorProcessFailure(
  result: DescriptorProcessResult,
  request: string,
): Error | undefined {
  if (result.error) {
    return new Error(
      `ttsc: failed to launch ttsx for plugin descriptor "${request}": ${result.error.message}`,
    );
  }
  if (result.signal) {
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx was killed by signal ${result.signal}.`,
    );
  }
  if (result.status !== 0) {
    return new Error(
      `ttsc: plugin descriptor "${request}" evaluation through ttsx failed with exit code ${String(result.status)}`,
    );
  }
  return undefined;
}

/**
 * Read the failure envelope the descriptor shim writes to its result file when
 * it stops on an error it can name.
 *
 * This is the other half of classifying how the evaluation ended, which is why
 * it lives beside {@link pluginDescriptorProcessFailure} rather than at the call
 * site: the status says that it failed, and this says why.
 *
 * Only a well-formed envelope is honoured. A real descriptor never carries this
 * key, and every other shape — an absent file, a shim that died before writing,
 * a half-written result, a descriptor written before a later non-zero exit —
 * leaves the process status to speak for itself.
 */
export function pluginDescriptorFailureReason(outputPath: string): string {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return "";
    const message = (parsed as { __ttscLoaderError?: unknown })
      .__ttscLoaderError;
    return typeof message === "string" ? message.trim() : "";
  } catch {
    return "";
  }
}
