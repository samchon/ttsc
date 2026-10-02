/**
 * A child process's standard output and error, captured through files instead
 * of pipes.
 *
 * Produced by {@link captureProcessOutput}. Pass `stdoutFd` and `stderrFd` as
 * the child's stdio, read the streams back after it exits, and always call
 * `dispose` so the descriptors close and the private directory is removed.
 *
 * @evidence contracts/common.md#principled-implementation Separate descriptors and paths represent inherited child writes and retry-by-name reads, while read and dispose expose the two permitted lifecycle operations.
 * @evidence contracts/common.md#clear-and-simple-design The interface groups both streams under one ownership handle so callers cannot release half a capture accidentally; encoding remains a read-time choice.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Stream names and encoding choices are declared capture semantics, not consumer-specific substitutions or mutations of a child-process API.
 * @evidence contracts/common.md#meaningful-documentation The type documents producer, handoff and mandatory disposal; each member has a separated native explanation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Paths and descriptor numbers carry Node's native filesystem representation; retry callers receive physical file paths rather than a shell command or assumed slash spelling.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface CapturedProcessOutput {
  /**
   * Close each descriptor once and attempt backing-file removal. Repeated calls
   * have no effect; removal failure does not replace the process outcome.
   *
   * @evidence contracts/common.md#principled-implementation Disposal terminates ownership once, so a later call cannot close a descriptor number that the OS has already reassigned.
   * @evidence contracts/common.md#clear-and-simple-design One operation ends ownership of both streams and their directory; callers use it in finally without separate cleanup ordering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Best-effort cleanup preserves the real process outcome instead of manufacturing a successful acquisition or hiding a read failure.
   * @evidence contracts/common.md#meaningful-documentation The comment states idempotence and removal's best-effort effect, following the documentation skill's guidance on ownership and failure.
   * @evidence contracts/portability.md#os-neutral-implementation Descriptor closure and removal use native Node APIs; inherited Windows handles can defer removal without changing descriptor ownership.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources dispose declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms dispose declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work dispose declares a signature only; the implementation owns any shared work.
   */
  dispose(): void;

  /**
   * Read one stream after the child exits, decoded unless `"buffer"` is asked
   * for. Undefined encoding means UTF-8. Filesystem read errors propagate.
   *
   * @evidence contracts/common.md#principled-implementation The literal stream choice selects its owned file; buffer returns raw bytes, while a requested BufferEncoding determines decoding.
   * @evidence contracts/common.md#clear-and-simple-design Read is separate from disposal so callers can obtain both streams before ending their shared ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Read errors remain errors rather than being replaced by expected or empty output.
   * @evidence contracts/common.md#meaningful-documentation Timing, default encoding and I/O failure are documented in a separate native paragraph following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation The stream is read from a native file path with Node's byte and encoding APIs, independent of platform newline conventions.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources read declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms read declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work read declares a signature only; the implementation owns any shared work.
   */
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
