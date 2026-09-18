/**
 * How to start a resident `check-serve` sidecar for a watch session.
 *
 * Everything that fixes the check (compiler options, project, plugins,
 * threading) travels in `args` once, at spawn time. Only filesystem changes
 * travel later, as {@link ResidentCheckRequest} lines.
 */
export interface ResidentCheckProcessOptions {
  /** Full argv of the sidecar, including its `check-serve` subcommand. */
  args: readonly string[];

  /** Absolute path of the native check host executable. */
  binary: string;

  /** Working directory the sidecar resolves project-relative paths from. */
  cwd: string;

  /**
   * Complete environment of the sidecar. It is passed verbatim rather than
   * merged, so the caller decides which inherited ttsc variables survive.
   */
  env: NodeJS.ProcessEnv;
}
