/**
 * Waits for an owner's idle observation without losing changes during that
 * observation. The owner announces every scheduling and terminal transition.
 *
 * Elapsed silence cannot certify idle: a queued build or an asynchronous input
 * decision can remain silent until it starts. A changed revision therefore
 * requires another observation, even when the earlier one reported idle.
 *
 * @evidence contracts/common.md#principled-implementation A monotonic revision detects transitions across an asynchronous idle query; wait registration and the final revision comparison share one JavaScript turn, preventing a lost wake.
 * @evidence contracts/common.md#clear-and-simple-design The owner supplies its actual idle predicate and announces state changes; this class owns only revision validation and waiting callbacks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No timeout, retry limit, process hook or consumer-specific decision substitutes for the owner's state.
 * @evidence contracts/common.md#meaningful-documentation Prose defines idle-query ownership and why silent queued work and intervening changes require a fresh observation; methods describe notification and failure effects.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Revisions and promises have no native path, filesystem or process boundary.
 * @evidence contracts/performance.md#efficient-algorithms Each transition visits current waiters once; each observation is constant bookkeeping plus the supplied owner's work, without polling.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each wait observes mutable owner state independently; no computed result is cached across transitions.
 * @evidence contracts/performance.md#bound-retention-and-release-resources A non-idle wait registers one callback until the next transition; an in-flight idle query or publication retains its call closure until settlement. Errors reject directly. The owner must announce terminal transitions so registered callbacks can recheck and reject. Concurrent caller population has no fixed cap.
 */
export class WatchSettlement {
  private revision = 0;
  private readonly waiters = new Set<() => void>();

  /**
   * Announces a scheduling or terminal transition and releases current waits.
   *
   * @evidence contracts/common.md#principled-implementation Advancing the revision invalidates queries already in flight, and releasing the current callback population permits each pending wait to query again.
   * @evidence contracts/common.md#clear-and-simple-design One notification handles both ordinary scheduling and terminal transitions without interpreting the owner's state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Callbacks observe a real owner transition without polling or replacing owner operations.
   * @evidence contracts/common.md#meaningful-documentation The prose states which transitions callers announce and that current waits are released.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This in-memory notification has no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Copying and waking current callbacks costs linear time and temporary space in pending waits.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This effectful transition does not compute a reusable result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Clearing the set releases its references before callbacks run; each resumed wait owns any later registration.
   */
  public changed(): void {
    ++this.revision;
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const wake of waiters) wake();
  }

  /**
   * Publishes and resolves after an idle query spans no transition; errors
   * reject. The owner must reject its query after shutdown and announce that
   * shutdown. Publication starts in the same turn as the final revision check.
   *
   * @evidence contracts/common.md#principled-implementation The revision comparison validates the complete awaited observation; publication starts synchronously after that comparison, and a non-idle result registers its wake in the same turn, so neither path loses an intervening transition.
   * @evidence contracts/common.md#clear-and-simple-design The loop retries only after a real transition and delegates all idle and terminal meaning to the supplied owner query.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No elapsed silence, deadline or fixed retry count stands for the owner's actual pending work.
   * @evidence contracts/common.md#meaningful-documentation The prose describes successful observation, same-turn publication, error propagation and the terminal notification obligation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Awaiting an owner query imposes no native path or process policy.
   * @evidence contracts/performance.md#efficient-algorithms Each query adds constant revision bookkeeping and at most one callback; query work belongs to the supplied owner, and no timer polls state.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Queries observe mutable state and are not cached across transitions.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A non-idle observation retains one resolver until changed clears it; successful and failed queries retain no registered callback, while an in-flight query or publication retains this call until settlement. Terminal wake and rejection are the owner's obligation.
   */
  public async wait(
    idle: () => Promise<boolean>,
    publish: () => void | Promise<void> = () => {},
  ): Promise<void> {
    for (;;) {
      const revision = this.revision;
      const observed = await idle();
      if (revision !== this.revision) continue;
      if (observed) return await publish();
      await new Promise<void>((resolve) => this.waiters.add(resolve));
    }
  }
}
