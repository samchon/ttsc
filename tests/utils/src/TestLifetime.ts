/**
 * Own an explicit test failure deadline without granting native retirement.
 *
 * A caller-selected failure budget rejects observation and must reach the containing native owner's cancellation signal (#1700). The caller still awaits its original operation and native retirement receipt; elapsed time establishes no readiness, result correctness or cleanup authority.
 *
 * @evidence contracts/common.md#principled-implementation A caller-selected millisecond budget and an optional earlier parent deadline govern one AbortController. Expiry, clock, acquisition and disposal refusals retain their original reasons; independent primitive occurrences remain separate. Clock failure cannot skip registered disposal, and callers still await original native receipts before releasing inputs.
 * @evidence contracts/common.md#clear-and-simple-design One owner retains the deadline, signal, latest phase and ordered resource/failure ledgers; portable observation is separate from the caller's native containment and joins.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Expiry rejects rather than manufacturing progress or retirement. Authored scheduling and clock seams replace no global method, and the generic waitFor keeps its existing unbounded contract.
 * @evidence contracts/common.md#meaningful-documentation Prose records explicit failure policy and native ownership limits; members state milliseconds, observation cancellation, acquired capabilities and post-join disposal.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Node timers and AbortController operate on test observation; original native owners still adjudicate process and filesystem authority.
 * @evidence contracts/performance.md#efficient-algorithms Phase replacement and observation bookkeeping are constant structural work. For D registered disposers and F failures, disposal is O(D), identity admission is O(F) per fault and snapshots or aggregate creation are O(F). Clock, scheduler and callback work remain caller-owned.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each original test lifetime owns a fresh controller; a parent deadline limits the same borrow rather than sharing results or extending its budget.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The default timer is unreferenced so it cannot postpone natural beforeExit. Every registered capability is attempted once after original cleanup; failed capabilities remain retained and unknown, including transfer in a constructor refusal's cause. Disposer/failure counts have no internal cap. Observations remove abort listeners on settlement; original promise callbacks remain until that operation settles. Event-loop blocking requires independent native cancellation.
 */
export class TestLifetime {
  /** Failure deadline in UTC epoch milliseconds, capped by the parent lifetime. */
  public readonly deadline: number;

  /** Cancellation of observation; it supplies no original-operation join receipt. */
  public readonly signal: AbortSignal;

  private readonly controller = new AbortController();
  private phase = "startup";
  private readonly disposers: (() => void)[] = [];
  private readonly failedDisposers: (() => void)[] = [];
  private readonly failures: unknown[] = [];
  private finishResult: readonly unknown[] | undefined;
  private verdict: { error: unknown } | undefined;
  private finished = false;
  private readonly now: () => number;
  private readonly expire: () => void;

  /**
   * Start one explicit observation budget before the caller admits its work.
   *
   * timeoutMs is an integer from 1 through Node's maximum timer delay. The parent's optional UTC epoch-millisecond deadline can shorten this lifetime, and an already expired deadline refuses immediately. The clock is read before scheduling; its original failure precedes resource acquisition.
   *
   * A scheduler registers each acquired disposal capability through own before further fallible setup. A scheduler refusal attempts every registered disposer and preserves acquisition, clock and disposal errors. Failed attempts remain unknown: a thrown acquisition aggregate transfers their original capabilities in its cause. The default registers its timer before unref, so a setup refusal cannot orphan that timer.
   */
  public constructor(options: {
    /** Name used to attribute this test's failure. */
    name: string;

    /** Positive integer observation budget in milliseconds, at most 2^31-1. */
    timeoutMs: number;

    /** Earlier parent deadline in safe integer UTC epoch milliseconds. */
    deadline?: number;

    /** Owned clock returning safe integer milliseconds; its failures remain failures. */
    now?: () => number;

    /** Synchronously register acquired capabilities before fallible setup; every registered disposer is attempted once. */
    schedule?: (expire: () => void, delayMs: number, own: (dispose: () => void) => void) => void;
  }) {
    if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0 || options.timeoutMs > 2_147_483_647)
      throw new RangeError("Test lifetime budget must fit Node's positive timer range");
    this.now = options.now ?? Date.now;
    const now = this.readClock();
    if (options.deadline !== undefined && !Number.isSafeInteger(options.deadline))
      throw new RangeError("Test lifetime parent deadline must be integer milliseconds");
    this.deadline = Math.min(now + options.timeoutMs, options.deadline ?? Infinity);
    if (!Number.isSafeInteger(this.deadline)) throw new RangeError("Test lifetime deadline exceeds integer millisecond precision");
    this.signal = this.controller.signal;
    const name = options.name, timeoutMs = options.timeoutMs;
    const expire = this.expire = (): void => {
      if (this.finished || this.signal.aborted) return;
      this.fail(new Error(`${name} exceeded its explicit ${timeoutMs} ms failure budget during ${this.phase}`));
    };
    const remaining = this.deadline - now;
    if (remaining <= 0) expire();
    else {
      try {
        (options.schedule ?? ((callback, delay, own) => {
          const timer = setTimeout(callback, delay);
          own(() => clearTimeout(timer));
          timer.unref();
        }))(expire, remaining, (dispose) => this.disposers.push(dispose));
      } catch (error) {
        this.fail(error);
        this.finish();
        if (this.failedDisposers.length !== 0)
          throw new AggregateError([...this.failures], "Test lifetime acquisition failed and resource release remains unknown", {
            cause: { disposal: "unknown", retainedDisposers: [...this.failedDisposers] },
          });
        throw this.failure();
      }
    }
  }

  /** A clock refusal cannot become a missing or unqualified expiry comparison. */
  private readClock(): number {
    const value = this.now();
    if (!Number.isSafeInteger(value)) throw new RangeError("Test lifetime clock must return integer milliseconds");
    return value;
  }

  /** Retain distinct original faults without replacing an earlier abort reason. */
  private fail(error: unknown): void {
    // Re-reporting the same object can repeat one refusal. Equal primitives
    // from independent clock, acquisition or disposal calls are distinct faults.
    const reference = error !== null && (typeof error === "object" || typeof error === "function");
    if (!reference || !this.failures.some((prior) => Object.is(prior, error))) {
      this.failures.push(error);
      this.verdict = undefined;
    }
    if (!this.signal.aborted)
      this.controller.abort(error === undefined ? new AggregateError([error], "Test lifetime refused with undefined") : error);
  }

  /** Multiple original faults remain separate aggregate members with stable identity. */
  private failure(): unknown {
    this.verdict ??= { error: this.failures.length === 1 ? this.failures[0] : new AggregateError([...this.failures], "Test lifetime observation and resource release failed") };
    return this.verdict.error;
  }

  /**
   * Retain the latest actual phase, including cleanup after cancellation.
   *
   * @evidence contracts/common.md#principled-implementation A checkpoint changes only diagnostic text and cannot renew the original deadline or erase failure.
   * @evidence contracts/common.md#clear-and-simple-design One string records current progress without a retained history.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Calling a checkpoint supplies no completion or readiness verdict.
   * @evidence contracts/common.md#meaningful-documentation Prose states phase replacement and cancellation-safe recording.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Phase text has no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms Replaces one reference in constant structural time.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Mutable progress is not reused as an answer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Only the latest caller-owned string remains with this lifetime.
   */
  public checkpoint(phase: string): void { this.phase = phase; }

  /**
   * Report original lifetime failures at a test's assertion boundary.
   *
   * @evidence contracts/common.md#principled-implementation The owned clock checks expiry even when synchronous work returns before its timer callback. A clock refusal enters the same ledger; one original reason or an ordered aggregate is thrown without converting failure to success.
   * @evidence contracts/common.md#clear-and-simple-design One explicit assertion observes cancellation after awaited owner work.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This checks only test failure policy, never native liveness or resource safety.
   * @evidence contracts/common.md#meaningful-documentation Prose identifies failure identity and the assertion boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Signal inspection has no native operation.
   * @evidence contracts/performance.md#efficient-algorithms A successful clock check takes constant structural work; fault identity admission and a new aggregate take O(F) for F retained reasons, with clock work delegated.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The signal's current state is inspected each time.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The assertion adds no callback or native capability; a new clock fault remains in the lifetime's uncapped reason ledger and its cached verdict until the caller discards this owner.
   */
  public assertActive(): void {
    if (!this.finished && !this.signal.aborted) {
      try { if (this.readClock() >= this.deadline) this.expire(); }
      catch (error) { this.fail(error); }
    }
    if (this.failures.length !== 0) throw this.failure();
  }

  /**
   * Observe an original promise, rejecting observation when this lifetime fails.
   * The caller still owns and joins that promise and its native work; cancelling this observation does not settle the operation.
   *
   * @evidence contracts/common.md#principled-implementation Original fulfillment/rejection and the owning signal independently settle observation once; actual operation settlement remains unchanged and late rejection stays observed.
   * @evidence contracts/common.md#clear-and-simple-design One observation adapter pairs the existing promise with this controller without taking over its producer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Observation rejection supplies no replacement completion, implicit retry or native retirement proof.
   * @evidence contracts/common.md#meaningful-documentation Prose distinguishes rejected observation from the caller's required original join.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Promise and AbortSignal callbacks have no native boundary.
   * @evidence contracts/performance.md#efficient-algorithms One listener and two original terminal callbacks use constant observation bookkeeping; the initial assertion's clock-failure admission or aggregate work is O(F) for F retained reasons.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each effectful observation owns its own settlement rather than reusing a result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Every observational outcome removes its abort listener; terminal callbacks remain on a still-pending original promise until its owner settles it, without an internal duration cap.
   */
  public wait<T>(original: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const settle = (failed: boolean, value: unknown): void => {
        if (settled) return;
        settled = true;
        this.signal.removeEventListener("abort", aborted);
        if (failed) reject(value);
        else resolve(value as T);
      };
      const aborted = (): void => settle(true, this.signal.reason);
      this.signal.addEventListener("abort", aborted, { once: true });
      original.then((value) => settle(false, value), (error) => settle(true, error));
      try { this.assertActive(); }
      catch (error) { settle(true, error); }
    });
  }

  /**
   * Clear this timer after the caller's original operation and cleanup finish.
   * Returns every original expiry, clock and disposal fault for the caller's error ledger. It does not throw over a body failure; repeated calls return the same completed ledger, and assertActive retains its failed verdict.
   *
   * @evidence contracts/common.md#principled-implementation The final clock check preserves overdue completion or its original refusal, while an independent finally attempts every registered disposer. Ordered reasons preserve prior expiry and independent cleanup failures; disposal cannot manufacture caller joins.
   * @evidence contracts/common.md#clear-and-simple-design Terminal state and one cached readonly failure snapshot make repeated finish idempotent; refused capabilities remain separately retained.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The caller must finish original cleanup separately; disposal certifies no native lifetime.
   * @evidence contracts/common.md#meaningful-documentation Prose states post-cleanup timing and preserved failure.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Timer disposal invokes no native process or filesystem policy.
   * @evidence contracts/performance.md#efficient-algorithms D registered callbacks are attempted once, F reasons are copied once, and failure identity admission costs O(F) per fault. Repeated finish returns the same snapshot in constant time.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated finish shares this exact owner's completed attempts and reason snapshot without retrying a refused disposer.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Successful capabilities are dropped after their single attempt; failed capabilities stay retained with unknown release. Original reasons and the immutable snapshot remain caller-owned without a count cap; finishing grants no native reclamation authority.
   */
  public finish(): readonly unknown[] {
    if (this.finishResult !== undefined) return this.finishResult;
    try {
      try { if (this.readClock() >= this.deadline) this.expire(); }
      catch (error) { this.fail(error); }
    } finally {
      this.finished = true;
      // Clock refusal cannot bypass original disposal. Remove each capability
      // from pending work before its attempt; a refusal stays retained below.
      for (const dispose of this.disposers.splice(0)) {
        try { dispose(); }
        catch (error) { this.failedDisposers.push(dispose); this.fail(error); }
      }
      this.finishResult = Object.freeze([...this.failures]);
    }
    return this.finishResult;
  }
}
