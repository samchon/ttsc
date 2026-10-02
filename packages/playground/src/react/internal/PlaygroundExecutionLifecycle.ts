/**
 * Attempt token whose signal and publication rights end on supersession.
 *
 * @evidence contracts/common.md#principled-implementation Signal propagates cancellation while isCurrent and finish condition state publication and completion on the same captured owner.
 * @evidence contracts/common.md#clear-and-simple-design One token bundles the attempt capabilities without exposing the controller or lifecycle state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Attempt rights are explicit rather than guessed from elapsed time or the last completed bundle.
 * @evidence contracts/common.md#meaningful-documentation Native prose and member comments explain cancellation and ownership with documentation-skill member spacing.
  * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
 */
export interface IPlaygroundExecutionAttempt {
  /** Signal passed through every cancellable step owned by this attempt. */
  readonly signal: AbortSignal;

  /**
   * Whether this attempt may still commit messages or state.
   *
   * @evidence contracts/common.md#principled-implementation Current epoch and active controller identity jointly decide publication rights.
   * @evidence contracts/common.md#clear-and-simple-design The predicate keeps lifecycle storage private while exposing one decision.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Superseded work cannot regain rights through a successful late result.
   * @evidence contracts/common.md#meaningful-documentation Native prose states publication meaning with tag separation under the documentation skill.
    * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
    * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
    * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
    * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
   */
  isCurrent(): boolean;

  /**
   * Release the active slot only while this attempt remains its owner.
   *
   * @evidence contracts/common.md#principled-implementation Conditional completion cannot clear a newer attempt's controller and returns whether the caller owned the transition.
   * @evidence contracts/common.md#clear-and-simple-design One completion capability centralizes active-slot release.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Old finally callbacks cannot force a new attempt into completed state.
   * @evidence contracts/common.md#meaningful-documentation Native prose states conditional release with tag separation under the documentation skill.
    * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition declares a shape and retains no state or handle.
    * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition declares a shape and performs no computation.
    * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition declares a shape and shares no computation.
    * @evidenceExclude contracts/portability.md#os-neutral-implementation A type definition owns no native filesystem, path or process decision.
   */
  finish(): boolean;
}

/**
 * Owns the cancellation and stale-write boundary for Execute attempts.
 *
 * React state stays in `PlaygroundShell`; this small state machine keeps the
 * supersession rules independently testable and makes every invalidation path
 * use the same abort behavior.
 *
 * @evidence contracts/common.md#principled-implementation Epoch and controller identity fence stale messages; invalidation clears ownership before dispatching synchronous abort listeners.
 * @evidence contracts/common.md#clear-and-simple-design This state machine owns attempts only while React owns rendering and the site owns execution isolation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared invalidation corrects ownership directly rather than using separate timing-based cancellation wrappers.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state cancellation ownership and shared invalidation purpose under the documentation skill.
  * @evidence contracts/performance.md#bound-retention-and-release-resources Holds at most one active AbortController; beginning or invalidating aborts and drops the previous one, so no attempt's controller outlives its supersession.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
 */
export class PlaygroundExecutionLifecycle {
  private active: AbortController | null = null;
  private epoch = 0;

  /**
   * Supersede the active attempt and capture a fresh controller and epoch.
   *
   * @evidence contracts/common.md#principled-implementation Invalidation aborts the prior owner before the new controller is installed; returned closures compare both epoch and controller.
   * @evidence contracts/common.md#clear-and-simple-design One constructor supplies cancellation, validity and conditional completion for an attempt.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supersession uses the common owning transition instead of stacking compensating callbacks.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines fresh ownership and prior-attempt behavior with tag separation under the documentation skill.
    * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources State retention is owned by the enclosing class, which documents it.
    * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
    * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
    * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
   */
  public begin(): IPlaygroundExecutionAttempt {
    this.invalidate("a newer Execute started");
    const controller = new AbortController();
    const epoch = this.epoch;
    this.active = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.epoch === epoch && this.active === controller,
      finish: () => {
        if (this.epoch !== epoch || this.active !== controller) return false;
        this.active = null;
        return true;
      },
    };
  }

  /**
   * Abort the active attempt and make its callbacks stale.
   *
   * Returns whether an active attempt was canceled.
   *
   * @evidence contracts/common.md#principled-implementation Clearing active identity and advancing epoch precede abort notification, preventing reentrant old callbacks from publishing.
   * @evidence contracts/common.md#clear-and-simple-design One transition handles every invalidation reason and delegates error construction locally.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual owner receives cancellation; an absent owner is reported without inventing a task to cancel.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs state abort effect and return meaning under the documentation skill.
    * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources State retention is owned by the enclosing class, which documents it.
    * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
    * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
    * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
   */
  public invalidate(reason: string): boolean {
    const active = this.active;
    this.active = null;
    ++this.epoch;
    active?.abort(createExecutionAbortError(reason));
    return active !== null;
  }
}

function createExecutionAbortError(reason: string): Error {
  const error = new Error(`Playground execution aborted: ${reason}.`);
  error.name = "AbortError";
  return error;
}
