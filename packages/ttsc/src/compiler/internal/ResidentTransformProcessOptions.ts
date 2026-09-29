/**
 * How to start the resident transform host behind {@link TtscService}.
 *
 * The host is spawned once and then answers transform requests over its line
 * protocol, so project, plugin, and compiler configuration are fixed here and
 * never change for the life of the process.
 *
 * @evidence contracts/common.md#principled-implementation A fixed executable and argv identify the resident producer; optional cwd and environment retain Node's explicitly documented spawn defaults.
 * @evidence contracts/common.md#clear-and-simple-design This startup record contains only spawn inputs, keeping later operation and cancellation data outside the fixed project configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native invocation is caller-supplied data rather than a recognized consumer name or a patched child-process implementation.
 * @evidence contracts/common.md#meaningful-documentation The native paragraph explains fixed configuration, and separated member comments state paths and default meanings following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native executable and cwd representations stay distinct from argv strings; optional environment delegates to Node's supported native spawn behavior.
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
