/**
 * Owned temporary storage for one synchronous child stdout/stderr capture.
 *
 * @evidence contracts/common.md#principled-implementation Numeric descriptors can be passed directly to spawnSync while the stream union selects the matching captured text.
 * @evidence contracts/common.md#clear-and-simple-design One handle groups two descriptors with read and disposal operations owned by the same capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts File capture avoids a guessed pipe ceiling without modifying spawnSync internals.
 * @evidence contracts/common.md#meaningful-documentation Native member comments state stream selection, caller ownership and the cleanup boundary.
 */
export interface CapturedProcessOutput {
  /**
   * Close the descriptors and remove the backing files once. Invoke after the
   * child finishes, including failure paths; removal remains best effort.
   *
   * @evidence contracts/common.md#principled-implementation Disposal releases both capture descriptors before removing their containing directory.
   * @evidence contracts/common.md#clear-and-simple-design Cleanup is one owned operation rather than independent caller-managed paths.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup preserves the child outcome instead of replacing it with a secondary removal error.
   * @evidence contracts/common.md#meaningful-documentation Native prose states invocation timing, failure coverage and best-effort removal.
   */
  dispose(): void;

  /**
   * Read one stream's UTF-8 text after the child finishes. A failed spawn
   * leaves its pre-created capture file empty; a filesystem read failure
   * propagates.
   *
   * @evidence contracts/common.md#principled-implementation The stream discriminant selects its backing file and UTF-8 decoding returns the captured textual channel.
   * @evidence contracts/common.md#clear-and-simple-design One reader shares the same storage paths as the capture owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An unreadable capture is not replaced with empty text that could disguise lost output.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains encoding, timing and read-failure propagation.
   */
  read(stream: "stdout" | "stderr"): string;

  /** Owned writable descriptor passed as the child's stderr destination. */
  stderrFd: number;

  /** Owned writable descriptor passed as the child's stdout destination. */
  stdoutFd: number;
}
