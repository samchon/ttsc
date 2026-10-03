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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
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
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources close declares a signature only; the implementation owns acquisition and release of resources.
   * @evidenceExclude contracts/performance.md#efficient-algorithms close declares a signature only; the implementation owns the processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work close declares a signature only; the implementation owns any shared work.
   */
  close(): void;

  /**
   * Subscribe to failure notification so the owner can retire the watch.
   *
   * @evidence contracts/common.md#principled-implementation The failure subscription communicates observation loss so the owner can reconcile its watch set.
   * @evidence contracts/common.md#clear-and-simple-design One error event avoids exposing unrelated backend event channels.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure is not replaced with a fabricated healthy watcher result.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains failure notification and caller retirement responsibility following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native backend failures share an Error callback rather than OS-specific result shapes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This method signature acquires no runtime resource; backend implementations own listener storage and the watcher owner closes the subscription.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This method signature defines no processing algorithm; the backend implements event subscription.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This method signature coordinates no runtime work; backend event distribution owns any sharing.
   */
  on(event: "error", listener: (error: Error) => void): unknown;
}
