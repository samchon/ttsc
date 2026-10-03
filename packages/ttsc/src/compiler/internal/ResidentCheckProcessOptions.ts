/**
 * How to start a resident `check-serve` sidecar for a watch session.
 *
 * Everything that fixes the check (compiler options, project, plugins,
 * threading) travels in `args` once, at spawn time. Only filesystem changes
 * travel later, as {@link ResidentCheckRequest} lines.
 *
 * @evidence contracts/common.md#principled-implementation Executable, argv, cwd and complete environment represent the fixed native invocation independently from per-cycle change requests.
 * @evidence contracts/common.md#clear-and-simple-design Required fields establish one complete check-sidecar startup context without implicit environment merge policy inside the client.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration uses explicit invocation data rather than recognizing a plugin name or supplying fixture-specific compiler arguments.
 * @evidence contracts/common.md#meaningful-documentation The type explains fixed startup state, and separated member comments document native executable, argument and environment authority following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The executable and cwd are native paths, argv remains separate strings, and environment names retain the supplying boundary's native identity policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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
