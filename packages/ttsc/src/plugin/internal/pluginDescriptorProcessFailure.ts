/**
 * Classify the ways the isolated TypeScript descriptor evaluator can stop.
 *
 * The ttsx loader routes any child stdout/stderr directly to the parent's
 * stderr; a failed process need not have printed a diagnostic. This classifier
 * formats the reported error, signal or nonzero status without proving a
 * signal's origin or collecting the child's stream bytes.
 *
 * It sets no deadline or output ceiling. Request/error text and the returned
 * Error still occupy memory; descriptor output-file parsing and process
 * lifetime remain with the loader.
 *
 * @evidence contracts/common.md#principled-implementation Launch error, signal and nonzero status are classified in causal order from the child-process result; only a zero-status run without either earlier failure has no process error.
 * @evidence contracts/common.md#clear-and-simple-design The classifier returns an error without owning spawning, streamed diagnostics or descriptor decoding, keeping those responsibilities with the loader.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No descriptor-name exception, fixed runtime deadline or output threshold replaces the actual process result.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the already-streamed child output and remaining process-level information; separate paragraphs and a blank line before tags follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The classifier acquires no child or stream; a returned Error transfers to the caller and no helper-owned history is retained.
 * @evidence contracts/performance.md#efficient-algorithms A fixed precedence chain formats at most one Error. Request and reported-message text affect allocation/formatting; text length is uncapped and no child-output population is collected here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work One supplied result is classified without coordinating completed or in-flight evaluations.
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
