/**
 * Token for the compiler generation captured before asynchronous work.
 *
 * @evidence contracts/common.md#principled-implementation A live predicate compares captured epoch identity with the lifecycle's current epoch; the token does not grant ownership of a replacement Worker.
 * @evidence contracts/common.md#clear-and-simple-design One capability hides epoch storage from callers while permitting stale-work fencing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Generation validity is actual owner identity rather than timing guesses or retries around stale state.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines capture and ownership meaning with tag separation under the documentation skill.
 */
export interface IPlaygroundCompilerGeneration {
  /**
   * Whether this token still owns the active compiler Worker generation.
   *
   * @evidence contracts/common.md#principled-implementation Equality with the captured epoch determines validity synchronously before a caller publishes state.
   * @evidence contracts/common.md#clear-and-simple-design A predicate exposes validity without exposing mutable lifecycle state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Validity depends on ownership rather than a grace period after replacement.
   * @evidence contracts/common.md#meaningful-documentation Native prose states current ownership with tag separation under the documentation skill.
   */
  isCurrent(): boolean;
}

/**
 * Serializes dependency mutations and fences every asynchronous consumer of a
 * compiler Worker generation.
 *
 * Invalidating a generation immediately makes its active task advisory-only and
 * prevents its queued tasks from starting. New-generation tasks remain
 * serialized behind an active old task so two dependency installers can never
 * mutate the shared compiler filesystem concurrently.
 *
 * @evidence contracts/common.md#principled-implementation Monotonic epochs fence old callbacks and one promise chain orders mutations, retaining serialization even when an earlier task rejects.
 * @evidence contracts/common.md#clear-and-simple-design The lifecycle owns generation and ordering only; callers provide Worker mutation, reset and metadata clearing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Stale work loses publication rights through explicit identity checks instead of compensating retries or fixed timing windows.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain invalidation and old-task serialization; operation comments define reset ordering under the documentation skill.
 */
export class PlaygroundCompilerLifecycle {
  private epoch: number = 0;
  private queue: Promise<void> = Promise.resolve();

  /**
   * Capture the current epoch without advancing it.
   *
   * @evidence contracts/common.md#principled-implementation A closure over the captured scalar remains valid exactly while the owning epoch is unchanged.
   * @evidence contracts/common.md#clear-and-simple-design Token creation exposes one predicate and keeps epoch mutation internal.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Capture uses actual generation identity rather than inspecting unrelated Worker internals.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes observation from invalidation with tag separation under the documentation skill.
   */
  public capture(): IPlaygroundCompilerGeneration {
    const epoch = this.epoch;
    return {
      isCurrent: () => this.epoch === epoch,
    };
  }

  /**
   * Advance the epoch and return the replacement generation's token.
   *
   * @evidence contracts/common.md#principled-implementation Incrementing the epoch makes all prior captured predicates false before replacement work begins.
   * @evidence contracts/common.md#clear-and-simple-design One operation owns the generation transition and reuses token construction.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalidation changes the owning state directly instead of preserving stale assumptions beneath wrappers.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines transition and return identity with tag separation under the documentation skill.
   */
  public invalidate(): IPlaygroundCompilerGeneration {
    this.epoch++;
    return this.capture();
  }

  /**
   * Claim replacement only if the supplied generation still owns the lifecycle.
   *
   * @evidence contracts/common.md#principled-implementation Synchronous validity checking and epoch advance prevent a stale claimant from invalidating newer work.
   * @evidence contracts/common.md#clear-and-simple-design Conditional claiming delegates the actual transition to invalidate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Stale claims return undefined rather than retrying against a replacement they do not own.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines the ownership condition with tag separation under the documentation skill.
   */
  public invalidateIfCurrent(
    generation: IPlaygroundCompilerGeneration,
  ): IPlaygroundCompilerGeneration | undefined {
    if (!generation.isCurrent()) return undefined;
    return this.invalidate();
  }

  /**
   * Reset a Worker owned by `generation`, then clear its dependency metadata.
   *
   * The clear deliberately happens before a caller checks any independent
   * source version. A source edit during reset still leaves an empty Worker, so
   * its metadata must become empty too. A Worker-generation replacement
   * performs its own synchronous clear and prevents this stale reset from
   * clearing the replacement.
   *
   * @evidence contracts/common.md#principled-implementation Validity is checked before and after asynchronous reset; metadata clears only for the same Worker generation even if its source changed.
   * @evidence contracts/common.md#clear-and-simple-design Callbacks separate Worker disposal from metadata ownership while this method orders both effects.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The reset corrects actual stale Worker contents instead of suppressing source errors or clearing a newer generation's state.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why source-version checking must follow metadata clearing under the documentation skill.
   */
  public async resetWorkerIfCurrent(
    generation: IPlaygroundCompilerGeneration,
    reset: () => Promise<void>,
    clear: () => void,
  ): Promise<boolean> {
    if (!generation.isCurrent()) return false;
    await reset();
    if (!generation.isCurrent()) return false;
    clear();
    return true;
  }

  /**
   * Run a Worker mutation and reconcile a source edit that lands during it.
   *
   * An RPC cannot be cancelled after it has started mutating the Worker's
   * MemFS. If its source becomes stale before completion, reset that Worker and
   * clear the matching dependency metadata before another source can reuse it.
   *
   * @evidence contracts/common.md#principled-implementation Both source and Worker identity gate mutation; a source becoming stale after a non-cancellable RPC triggers reset before the generation is reusable.
   * @evidence contracts/common.md#clear-and-simple-design Mutation and reconciliation share one owning method, delegating reset ordering to the lifecycle helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Obsolete writes are removed at their owner rather than hidden by a stale-result wrapper alone.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the non-cancellable RPC and required reconciliation under the documentation skill.
   */
  public async mutateWorkerIfCurrent(
    generation: IPlaygroundCompilerGeneration,
    isSourceCurrent: () => boolean,
    mutate: () => Promise<unknown>,
    reset: () => Promise<void>,
    clear: () => void,
  ): Promise<boolean> {
    if (!generation.isCurrent() || !isSourceCurrent()) return false;
    await mutate();
    if (!generation.isCurrent()) return false;
    if (isSourceCurrent()) return true;
    await this.resetWorkerIfCurrent(generation, reset, clear);
    return false;
  }

  /**
   * Serialize a task behind prior mutations; stale queued tasks never start.
   * Rejection propagates to the caller without poisoning later tasks.
   *
   * @evidence contracts/common.md#principled-implementation The captured generation gates task start and a fulfilled continuation tail preserves total ordering after either prior settlement.
   * @evidence contracts/common.md#clear-and-simple-design One queue boundary coordinates every caller instead of duplicating ordering policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Queue recovery preserves the original rejection for its caller and does not fabricate a successful mutation.
   * @evidence contracts/common.md#meaningful-documentation Native prose defines stale-task omission and rejection ownership with tag separation under the documentation skill.
   */
  public enqueue<T>(
    task: (generation: IPlaygroundCompilerGeneration) => Promise<T>,
  ): Promise<T | undefined> {
    const generation = this.capture();
    const result = this.queue.then(async () => {
      if (!generation.isCurrent()) return undefined;
      return task(generation);
    });
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
