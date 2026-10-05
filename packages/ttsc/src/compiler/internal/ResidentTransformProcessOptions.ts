/**
 * How to start the resident transform host behind {@link TtscService}.
 *
 * The host is spawned once and then answers transform requests over its line
 * protocol. This record fixes startup executable, argv and spawn authority;
 * later operation data belongs to the request lane. It does not freeze files or
 * certify how a custom host responds to configuration changes.
 *
 * @evidence contracts/common.md#principled-implementation A fixed executable and argv identify the resident producer; optional cwd and environment retain Node's explicitly documented spawn defaults.
 * @evidence contracts/common.md#clear-and-simple-design This startup record contains only spawn inputs, keeping later operation and cancellation data outside the fixed project configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native invocation is caller-supplied data rather than a recognized consumer name or a patched child-process implementation.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph explains fixed configuration, and separated member comments state paths and default meanings following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable and cwd representations stay distinct from argv strings; optional environment delegates to Node's supported native spawn behavior.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface ResidentTransformProcessOptions {
  /** Full argv of the host, including its serve subcommand. */
  args: readonly string[];

  /** Absolute path of the native transform host executable. */
  binary: string;

  /** Working directory of the host; defaults to the current directory. */
  cwd?: string;

  /** Environment of the host; defaults to this process's environment. */
  env?: NodeJS.ProcessEnv;
}
