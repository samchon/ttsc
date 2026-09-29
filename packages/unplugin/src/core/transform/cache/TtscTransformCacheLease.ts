/**
 * The lifetime of a build-scoped cache across the sessions that use it
 * (samchon/ttsc#1396).
 *
 * @evidence contracts/common.md#principled-implementation Acquisition and release represent sessions sharing one build cache, whose generation may survive briefly between adjacent sessions.
 * @evidence contracts/common.md#clear-and-simple-design Two lifecycle operations expose ownership without exposing the grace timer or resetting the cache from each consumer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A lease grants retention, not proof that retained output is fresh; each delivery pass still owns validation.
 * @evidence contracts/common.md#meaningful-documentation The interface and method comments identify session ownership and the delayed final release.
 */
export interface TtscTransformCacheLease {
  /**
   * Start a session that uses the cache, cancelling a pending release.
   *
   * @evidence contracts/common.md#principled-implementation Acquisition declares one active session and prevents an earlier final-release timer from resetting its cache.
   * @evidence contracts/common.md#clear-and-simple-design A synchronous lifecycle operation leaves the timer implementation with the lease owner.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Acquisition does not bypass generation validation or alter host lifecycle methods.
   * @evidence contracts/common.md#meaningful-documentation The method comment states both ownership and cancellation effects needed by callers.
   */
  acquire(): void;

  /**
   * End a session; the last one schedules the cache's release.
   *
   * @evidence contracts/common.md#principled-implementation Release ends session ownership while retaining the generation only for the lease owner's bounded grace.
   * @evidence contracts/common.md#clear-and-simple-design Consumers report their lifecycle boundary without managing another owner's cache or timer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Release does not simulate a successful delivery or patch another compiler's shutdown.
   * @evidence contracts/common.md#meaningful-documentation The comment explains why final release schedules cleanup rather than immediately discarding a shared generation.
   */
  release(): void;
}
