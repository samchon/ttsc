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
