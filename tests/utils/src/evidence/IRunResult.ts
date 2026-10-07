/**
 * Everything one `ttsc check` run said, captured for assertion.
 *
 * The exit status and the text are kept apart because they answer different
 * questions: whether the toolchain rejected the project, and which diagnostic
 * it rejected it with. A case that asserts only the text can pass while the
 * build succeeded.
 *
 * @evidence contracts/common.md#principled-implementation Nullable process status and separate stdout/stderr preserve different native outcomes, while output is only a convenience concatenation.
 * @evidence contracts/common.md#clear-and-simple-design One readonly receipt keeps the exit verdict separate from diagnostic text.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation records observed output; diagnostic substrings alone cannot manufacture a successful or failed exit.
 * @evidence contracts/common.md#meaningful-documentation Fields describe stdout, stderr, combined text and nullable termination status.
 * @evidence contracts/portability.md#os-neutral-implementation Native nullable status represents abnormal or unavailable termination; it is not a platform-independent proof of descendant closure.
 * @evidenceExclude contracts/performance.md#efficient-algorithms IRunResult defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work IRunResult defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources IRunResult carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface IRunResult {
  /** Process exit status, or `null` when the run was killed by a signal. */
  readonly status: number | null;

  /** Everything the run wrote to standard output. */
  readonly stdout: string;

  /** Everything the run wrote to standard error. */
  readonly stderr: string;

  /** Stdout and stderr joined, for substring assertions. */
  readonly output: string;
}
