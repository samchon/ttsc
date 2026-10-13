/**
 * Complete each watch-input handoff before resuming its producer.
 *
 * Synchronous compiler APIs retain their return types and require synchronous
 * handlers. Watch callers use the asynchronous runner so a worker establishes
 * its baseline before the producer reads or builds the reported inputs.
 *
 * @evidence contracts/common.md#principled-implementation Generator suspension preserves ordered publication checkpoints; rejected handoffs return to the producer's failure policy and finally blocks. The synchronous guard recognizes callable then members across realms and observes an already-started promise's rejection before refusing asynchronous completion.
 * @evidence contracts/common.md#clear-and-simple-design Two runners share one producer sequence; the synchronous guard owns promise recognition and refusal, and its caller delivers that failure to the producer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A synchronous entry refuses asynchronous work instead of reporting completion or blocking; neither runner changes watcher or filesystem internals.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies publication ordering, synchronous restrictions, cross-realm recognition and already-started handler ownership; each runner documents failure delivery.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Promise recognition and publication stepping introduce no native filesystem, path identity or process boundary.
 * @evidence contracts/performance.md#efficient-algorithms Each runner advances each handoff once with constant state; the synchronous guard adds one then-member observation and one rejection observer. Callback work and retained producer state remain owner costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Publication and completion validation belong to each current producer handoff and are never memoized or shared away.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One suspended sequence remains until completion or failure, and rejected handoffs enter its cleanup path. The rejection observer lasts until the already-started handler settles; the synchronous runner cannot join or cancel it. Handler duration and retained producer bytes have no independent bound.
 */
export namespace WatchInputPublication {
  /**
   * A producer suspends only at a watch owner's completion boundary.
   *
   * @evidence contracts/common.md#principled-implementation Yielded values describe handler completion, and the final return preserves the producer's result type.
   * @evidence contracts/common.md#clear-and-simple-design One generator shape serves both completion runners without changing the producer's return contract.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The type models real callback completion without injecting watcher or filesystem behavior.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the suspension boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This type has no native representation or process boundary.
   * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes no reusable work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires no resource.
   */
  export type Sequence<Result> = Generator<void | Promise<void>, Result, void>;

  /**
   * Finish a synchronous producer, refusing a handler that returns a promise.
   * The refusal enters the producer's ordinary exception and cleanup path.
   *
   * @evidence contracts/common.md#principled-implementation Each yielded completion is checked before advancing; asynchronous completion becomes an exception delivered into the producer.
   * @evidence contracts/common.md#clear-and-simple-design The runner owns synchronous completion while the sequence owns operation policy and cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Promise rejection is observed and synchronous success cannot precede its completion.
   * @evidence contracts/common.md#meaningful-documentation Native prose states promise refusal and the producer-owned exception path.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Sequence stepping performs no native operation.
   * @evidence contracts/performance.md#efficient-algorithms The runner visits each handoff once and retains one iterator result at a time.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Ordered effectful publications are not cached or shared.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Refusal enters generator cleanup and observes the already-started promise's rejection; its unfinished handler remains handler-owned rather than joined by this synchronous API.
   */
  export function run<Result>(sequence: Sequence<Result>): Result {
    let step = sequence.next();
    while (!step.done) {
      try {
        assertSynchronous(step.value);
      } catch (error) {
        step = sequence.throw(error);
        continue;
      }
      step = sequence.next();
    }
    return step.value;
  }

  /**
   * Join every handoff before continuing, delivering rejection to the producer
   * rather than bypassing its error handling or temporary-resource cleanup.
   *
   * @evidence contracts/common.md#principled-implementation Await settles each yielded handoff and throws rejection back into the same suspended generator before advancing.
   * @evidence contracts/common.md#clear-and-simple-design The runner owns asynchronous completion while producer policy remains inside the shared sequence.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No pending or rejected publication is silently treated as completed registration.
   * @evidence contracts/common.md#meaningful-documentation Native prose states ordered joining, rejection delivery and cleanup ownership.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Promise and generator stepping introduce no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Each yielded handoff is awaited once with constant runner state.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each effectful publication belongs to its current producer and is not cached.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One suspended sequence remains live until the handler settles; rejection enters its cleanup path, with no independent callback deadline imposed here.
   */
  export async function runAsync<Result>(
    sequence: Sequence<Result>,
  ): Promise<Result> {
    let step = sequence.next();
    while (!step.done) {
      try {
        await step.value;
      } catch (error) {
        step = sequence.throw(error);
        continue;
      }
      step = sequence.next();
    }
    return step.value;
  }

  /**
   * Refuse cross-realm promises and thenables through the producer's failure
   * path, observing rejection from a handler that has already started.
   */
  function assertSynchronous(value: unknown): void {
    if (
      value !== null &&
      (typeof value === "object" || typeof value === "function") &&
      typeof (value as { then?: unknown }).then === "function"
    ) {
      // The handler has already started; observe its rejection even though
      // this synchronous caller cannot join it and must fail the operation.
      void Promise.resolve(value).catch(() => {});
      throw new TypeError(
        "ttsc: asynchronous watch input publication requires an asynchronous build entry",
      );
    }
  }
}
