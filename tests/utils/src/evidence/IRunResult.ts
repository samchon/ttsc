/**
 * Everything one `ttsc check` run said, captured for assertion.
 *
 * The exit status and the text are kept apart because they answer different
 * questions: whether the toolchain rejected the project, and which diagnostic
 * it rejected it with. A case that asserts only the text can pass while the
 * build succeeded.
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
