/**
 * A child process's standard output and error, captured through files instead
 * of pipes.
 *
 * Produced by {@link captureProcessOutput}. Pass `stdoutFd` and `stderrFd` as
 * the child's stdio, read the streams back after it exits, and always call
 * `dispose` so the descriptors close and the private directory is removed.
 */
export interface CapturedProcessOutput {
  /** Close the descriptors and remove the backing files. */
  dispose(): void;

  /** Read one stream's bytes, decoded unless `"buffer"` is asked for. */
  read(
    stream: "stdout" | "stderr",
    encoding: BufferEncoding | "buffer" | undefined,
  ): string | Buffer;

  /** Open descriptor of the standard-error file, to hand to the child. */
  stderrFd: number;

  /**
   * Path of the standard-error file inside the per-call private directory. A
   * descriptor-exhaustion retry reopens it by name (see
   * {@link spawnSyncResilient}).
   */
  stderrPath: string;

  /** Open descriptor of the standard-output file, to hand to the child. */
  stdoutFd: number;

  /** Path of the standard-output file inside the per-call private directory. */
  stdoutPath: string;
}
