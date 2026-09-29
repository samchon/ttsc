/**
 * A watch on one directory, as `watchDirectory` opens it on every platform.
 *
 * It carries what the watch set needs from `fs.FSWatcher` and nothing else, so
 * a backend other than `fs.watch` can serve it: closing it, and hearing that it
 * failed.
 *
 * @evidence contracts/common.md#principled-implementation The method set represents the lifecycle and failure notification both native watcher backends can provide.
 * @evidence contracts/common.md#clear-and-simple-design Closing and failure subscription remain independent of backend-specific event-emitter features.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Backends implement this supported boundary without replacing foreign watcher methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains the reduced interface and idempotent closure following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The interface isolates fs.watch and macOS FSEvents behind the same lifecycle contract.
 */
export interface DirectoryWatcher {
  /**
   * Stop delivering events. Closing a watch twice is harmless.
   *
   * @evidence contracts/common.md#principled-implementation Closing retires this subscription and repeated closure preserves the already retired state.
   * @evidence contracts/common.md#clear-and-simple-design One lifecycle operation hides whether the backend closes a handle or releases a shared stream subscription.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Closure uses the backend's supported resource boundary rather than patching its native implementation.
   * @evidence contracts/common.md#meaningful-documentation The native comment states event retirement and idempotency following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Callers close through the shared method rather than assuming platform-specific handle types.
   */
  close(): void;

  /**
   * Hear the watch fail; it delivers nothing afterwards.
   *
   * @evidence contracts/common.md#principled-implementation The failure subscription communicates observation loss so the owner can reconcile its watch set.
   * @evidence contracts/common.md#clear-and-simple-design One error event avoids exposing unrelated backend event channels.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is not replaced with a fabricated healthy watcher result.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains failure notification and subsequent observation loss following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native backend failures share an Error callback rather than OS-specific result shapes.
   */
  on(event: "error", listener: (error: Error) => void): unknown;
}
