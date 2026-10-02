/**
 * Classify the ways the isolated TypeScript descriptor evaluator can stop.
 *
 * The loader writes the child's own output straight to this process's stderr,
 * so a diagnostic has already reached the user by the time anything here runs.
 * What is left to say is only how the process ended: it never launched,
 * something outside killed it, or it exited non-zero after printing its own
 * reason.
 *
 * Nothing is bounded here, neither time nor output: a user's own descriptor
 * decides how long it runs and how much it says, and this process spends no
 * memory on it because the child's streams are not collected into it.
 *
 * @evidence contracts/common.md#principled-implementation Launch error, signal and nonzero status are classified in causal order from the child-process result; only a zero-status run without either earlier failure has no process error.
 * @evidence contracts/common.md#clear-and-simple-design The classifier returns an error without owning spawning, streamed diagnostics or descriptor decoding, keeping those responsibilities with the loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No descriptor-name exception, fixed runtime deadline or output threshold replaces the actual process result.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the already-streamed child output and remaining process-level information; separate paragraphs and a blank line before tags follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources pluginDescriptorProcessFailure declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms pluginDescriptorProcessFailure declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work pluginDescriptorProcessFailure declares a signature only; the implementation owns any shared work.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Formats the process result's error, signal and exit status into a message; it reads no file and builds no path.
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

interface DescriptorProcessResult {
  error?: Error;
  signal: NodeJS.Signals | null;
  status: number | null;
}
