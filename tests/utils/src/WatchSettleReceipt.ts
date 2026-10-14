import { randomUUID } from "node:crypto";

/**
 * Correlates a watch idle receipt with the stdout builds its caller consumed.
 * IPC can precede those markers or follow markers from a newer cycle.
 *
 * @evidence contracts/common.md#principled-implementation A fresh nonce identifies each requested boundary, and a nonnegative safe cumulative count cannot precede the builds consumed when that request began.
 * @evidence contracts/common.md#clear-and-simple-design One owner validates receipt identity and compares counts; stream parsing, sending and process lifetime stay with the harness.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Literal message types are the launcher protocol, and actual counts replace an elapsed quiet assumption without impersonating a process.
 * @evidence contracts/common.md#meaningful-documentation The prose explains independent pipe arrival; members describe request supersession, malformed receipts and the three count outcomes.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Standard cryptographic nonces and in-memory protocol values introduce no filesystem, path or process boundary.
 * @evidence contracts/performance.md#efficient-algorithms Requests, receipt admission and count comparisons use constant work and storage beyond nonce generation; observation drains each available completion once plus supplied parsing and callback work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A new request supersedes prior mutable boundary state rather than reusing its result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One nonce, requested minimum and optional acknowledged count remain until replacement or owner disposal; no callback, handle or history is retained.
 */
export class WatchSettleReceipt {
  private id: string | undefined;
  private minimum = 0;
  private builds: number | undefined;

  /**
   * Begins a boundary after `consumed` completed builds and supersedes old
   * replies.
   *
   * @evidence contracts/common.md#principled-implementation A fresh random nonce and captured consumed count distinguish this boundary from earlier replies.
   * @evidence contracts/common.md#clear-and-simple-design Request construction and reset of its receipt state occur together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The message uses the actual launcher's settle contract.
   * @evidence contracts/common.md#meaningful-documentation The prose states count units and supersession.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Request values are independent of native paths and processes.
   * @evidence contracts/performance.md#efficient-algorithms Capturing a count and generating one nonce use constant state.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request observes a new mutable boundary.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Replacing fields drops the earlier nonce and count with no retained history.
   */
  public request(consumed: number): { type: "ttsc.watch.settle"; id: string } {
    this.id = randomUUID();
    this.minimum = consumed;
    this.builds = undefined;
    return { type: "ttsc.watch.settle", id: this.id };
  }

  /**
   * Accepts only this request's idle reply; malformed matching counts throw.
   * Returns false for unrelated messages without changing the current
   * boundary.
   *
   * @evidence contracts/common.md#principled-implementation Type and nonce select the owning reply before a safe cumulative count is checked against the request's already consumed population.
   * @evidence contracts/common.md#clear-and-simple-design Identity filtering and payload admission have one owner and leave transport errors to the harness.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invalid owning replies fail explicitly instead of manufacturing idle or accepting an older count.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes ignored foreign messages from malformed matching receipts.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Object admission and numeric comparison have no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms A fixed set of fields is inspected in constant time and space.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Admission records this request's own reply rather than sharing another request's answer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only the admitted numeric count is retained; unrelated message objects are not stored.
   */
  public accept(value: unknown): boolean {
    if (typeof value !== "object" || value === null || this.id === undefined)
      return false;
    const message = value as Record<string, unknown>;
    if (message.type !== "ttsc.watch.settled" || message.id !== this.id)
      return false;
    if (
      !Number.isSafeInteger(message.builds) ||
      (message.builds as number) < this.minimum
    )
      throw new Error("The watcher returned an invalid settled build count.");
    this.builds = message.builds as number;
    return true;
  }

  /**
   * Requires missing stdout builds, accepts an exact idle count, or renews a
   * boundary overtaken by newer completed or already started work.
   *
   * @evidence contracts/common.md#principled-implementation Counts below the receipt require more output; equality without an observed outstanding start proves all acknowledged markers were consumed, while newer completed or started work needs a new idle request.
   * @evidence contracts/common.md#clear-and-simple-design One comparison expresses the harness's pending, complete and superseded decisions.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Neither pipe arrival order nor elapsed silence substitutes for count agreement.
   * @evidence contracts/common.md#meaningful-documentation The prose identifies each outcome and why newer completed work needs another boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Count comparison has no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Evaluation is constant time with no allocation or traversal.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Evaluation reads only the current admitted receipt.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Evaluation acquires no retained state or resource.
   */
  public evaluate(
    consumed: number,
    started = false,
  ): "pending" | "idle" | "renew" {
    if (this.builds === undefined || consumed < this.builds) return "pending";
    return consumed === this.builds && !started ? "idle" : "renew";
  }

  /**
   * Consumes every available completion before evaluating the idle boundary. A
   * receipt can precede a chunk containing both its last marker and newer work,
   * so reaching its count inside the chunk cannot end this drain. Callback
   * errors propagate so the harness can reject excessive rebuilds.
   *
   * @evidence contracts/common.md#principled-implementation Available completion consumption runs to exhaustion before cumulative-count and outstanding-start evaluation, preventing an earlier IPC receipt from hiding later work already present in stdout.
   * @evidence contracts/common.md#clear-and-simple-design One orchestration method joins receipt validation to the harness's actual marker cursor and observation callback without taking over stream or process ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual available completions and observed starts determine the boundary without an elapsed quiet window or fabricated process messages.
   * @evidence contracts/common.md#meaningful-documentation The prose explains why receipt equality cannot truncate consumption within an already delivered chunk.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied in-memory transcript operations have no native boundary here.
   * @evidence contracts/performance.md#efficient-algorithms The method calls next once per available completion plus one exhaustion check and adds constant bookkeeping to supplied parsing and observation work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each invocation consumes the currently available transcript rather than reusing a prior boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The method borrows callbacks and completion values only during this synchronous call and retains none.
   */
  public observe<T>(observation: {
    next(): T | null;
    consume(build: T): void;
    consumed(): number;
    started(): boolean;
  }): "pending" | "idle" | "renew" {
    for (;;) {
      const build = observation.next();
      if (build === null) break;
      observation.consume(build);
    }
    return this.evaluate(observation.consumed(), observation.started());
  }
}
