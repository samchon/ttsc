/**
 * Preserve observation and cleanup failures without replacing their reasons.
 *
 * Primitive values cannot identify a repeated report: two thrown undefined values are two failures. Only another report of the same object or function reference is deduplicated. Collection never certifies native retirement.
 *
 * @evidence contracts/common.md#principled-implementation Construction creates fresh caller-owned array and reference membership state. Ordered reasons preserve thrown values, including undefined; a WeakSet deduplicates only reference-identifiable reports, while primitive occurrences remain distinct.
 * @evidence contracts/common.md#clear-and-simple-design One ledger collects original reasons, runs owned synchronous cleanup and reports a single original or ordered aggregate. Construction adds no phase, scheduling or cleanup policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Construction reads no foreign state or elapsed-time verdict. Original callbacks and reasons remain intact; no product, global or filesystem method is replaced and no collected failure grants cleanup authority.
 * @evidence contracts/common.md#meaningful-documentation Constructor prose states empty admission and absence of resource acquisition; class prose explains primitive occurrence identity, repeated reference reports and the separate native-retirement responsibility.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Construction and collection use JavaScript containers and values; callers own every native operation and retirement receipt.
 * @evidence contracts/performance.md#efficient-algorithms Empty container initialization takes constant structural work. Reference admission uses one WeakSet lookup, and ordered storage grows with admitted failures. Callback cost belongs to the supplied operation; aggregate creation copies its reasons once.
 * @evidence contracts/performance.md#reuse-equivalent-work Each invocation starts empty rather than borrowing another owner's verdicts. Only repeated reports of one reason reference share an entry; cleanup operations and primitive failures are never reused or skipped.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the empty containers and admitted reasons until discarding the ledger, with no automatic count or byte cap. Construction and collection acquire no process, timer or filesystem handle.
 */
export class TestFailureLedger {
  private readonly failures: unknown[] = [];
  private readonly references = new WeakSet<object>();

  /**
   * Start an empty collection without acquiring an operation or resource.
   */
  public constructor() {}

  /**
   * Append an original failure, preserving every primitive occurrence.
   *
   * @evidence contracts/common.md#principled-implementation Only non-null object or function identity can prove a repeated report; every primitive add appends, including undefined, null, NaN and equal strings.
   * @evidence contracts/common.md#clear-and-simple-design One reference membership check precedes ordered append.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No truthiness check, string conversion or primitive equality discards a thrown reason.
   * @evidence contracts/common.md#meaningful-documentation States occurrence preservation and original-value retention.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Reason classification uses JavaScript value types and identity.
   * @evidence contracts/performance.md#efficient-algorithms One WeakSet lookup and amortized array append avoid scanning previous failures; reason payloads are not traversed or copied.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated reference reports share one entry without suppressing distinct objects or primitive occurrences.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Each admitted reason remains strongly referenced by the caller-owned array until the ledger is discarded; failure count has no internal cap.
   */
  public add(reason: unknown): void {
    if (
      (typeof reason === "object" && reason !== null) ||
      typeof reason === "function"
    ) {
      if (this.references.has(reason)) return;
      this.references.add(reason);
    }
    this.failures.push(reason);
  }

  /**
   * Attempt one owned synchronous cleanup and retain its thrown reason.
   *
   * The caller must separately await asynchronous work and its native receipt.
   *
   * @evidence contracts/common.md#principled-implementation Invokes the supplied operation once and catches its actual thrown value, including undefined, into the same ordered ledger.
   * @evidence contracts/common.md#clear-and-simple-design One try/catch lets subsequent cleanup attempts run after a failure.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The authored callback performs the original operation; capture substitutes no product callback or success result.
   * @evidence contracts/common.md#meaningful-documentation States synchronous scope and the caller's remaining asynchronous and native-join obligations.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation The supplied callback owns platform operations and retirement authority.
   * @evidence contracts/performance.md#efficient-algorithms One callback and constant structural admission overhead leave operation cost with its owner.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each requested cleanup executes once even when its reason was previously reported.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Capture retains no callback after return; an admitted thrown reason follows the ledger lifetime, and the callback owns its resources.
   */
  public capture(cleanup: () => void): void {
    try {
      cleanup();
    } catch (reason) {
      this.add(reason);
    }
  }

  /**
   * Report one original reason or all distinct reports in admission order.
   *
   * An empty collection returns normally; a thrown undefined remains failure.
   *
   * @evidence contracts/common.md#principled-implementation Array length distinguishes no failure from a single undefined reason; one entry is thrown unchanged and multiple entries become AggregateError.errors in their original order.
   * @evidence contracts/common.md#clear-and-simple-design Three count branches preserve a single reason's identity without adding a wrapper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No failure is translated into success or filtered by value; the message labels only a multi-reason aggregate.
   * @evidence contracts/common.md#meaningful-documentation Explains empty, single and aggregate outcomes, including undefined.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Reporting uses JavaScript throws and AggregateError only.
   * @evidence contracts/performance.md#efficient-algorithms Empty and single reporting take constant work; an aggregate copies the admitted reason list in linear time and space.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Verdicts observe the current ledger and do not cache or reuse operation results.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The aggregate owns its copied reason list; the original ledger remains caller-owned, and reporting releases no native resource.
   */
  public throwIfFailed(message: string): void {
    if (this.failures.length === 1) throw this.failures[0];
    if (this.failures.length > 1)
      throw new AggregateError(this.failures, message);
  }
}
