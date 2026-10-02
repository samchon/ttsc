/**
 * Owned temporary storage for one synchronous child stdout/stderr capture.
 *
 * @evidence contracts/common.md#principled-implementation Numeric descriptors can be passed directly to spawnSync while the stream union selects the matching captured text.
 * @evidence contracts/common.md#clear-and-simple-design One handle groups two descriptors with read and disposal operations owned by the same capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts File capture avoids a guessed pipe ceiling without modifying spawnSync internals.
 * @evidence contracts/common.md#meaningful-documentation Native member comments state stream selection, caller ownership and the cleanup boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CapturedProcessOutput declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms CapturedProcessOutput declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work CapturedProcessOutput declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation CapturedProcessOutput declares a data shape or groups members and performs no filesystem, path or process operation.
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
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CapturedProcessOutput.dispose acquires no handle or task and retains nothing beyond its return value.
   * @evidenceExclude contracts/performance.md#efficient-algorithms CapturedProcessOutput.dispose makes a bounded pass over its arguments and chooses no algorithm or data structure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work CapturedProcessOutput.dispose computes its value from its arguments on each call and shares no completed or in-flight work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation CapturedProcessOutput.dispose operates on in-memory values and performs no filesystem, path or process operation.
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
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources CapturedProcessOutput.read acquires no handle or task and retains nothing beyond its return value.
   * @evidenceExclude contracts/performance.md#efficient-algorithms CapturedProcessOutput.read makes a bounded pass over its arguments and chooses no algorithm or data structure.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work CapturedProcessOutput.read computes its value from its arguments on each call and shares no completed or in-flight work.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation CapturedProcessOutput.read operates on in-memory values and performs no filesystem, path or process operation.
   */
  read(stream: "stdout" | "stderr"): string;

  /** Owned writable descriptor passed as the child's stderr destination. */
  stderrFd: number;

  /** Owned writable descriptor passed as the child's stdout destination. */
  stdoutFd: number;
}
