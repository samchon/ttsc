/**
 * How to start the resident transform host behind {@link TtscService}.
 *
 * The host is spawned once and then answers transform requests over its line
 * protocol, so project, plugin, and compiler configuration are fixed here and
 * never change for the life of the process.
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
