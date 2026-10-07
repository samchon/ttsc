import type { SpawnSyncOptions, SpawnSyncReturns, spawnSync } from "node:child_process";

/**
 * A synchronous resolver task's explicit cancellation and native-command seam.
 * Ordinary compiler callers retain their established synchronous execution.
 * Worker owners supply a relay which joins native process containment before
 * returning, allowing cancellation to unwind normal lock and scratch cleanup.
 *
 * @evidence contracts/common.md#principled-implementation Scope installation is lexical and restored in finally; only an explicitly owned task delegates commands and observes its shared cancellation cell.
 * @evidence contracts/common.md#clear-and-simple-design The namespace owns scoped checkpoints and synchronous delegation; the parent relay owns process launch, containment and joining.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No child-process monkeypatch or inferred empty result substitutes for real command completion; cancellation throws outside the resolver's outcome conversion.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes opt-in worker execution from unchanged synchronous consumers and preserves cleanup responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Shared memory and explicit argv/options cross the Node worker boundary; native process differences remain in the supervisor.
 * @evidence contracts/performance.md#efficient-algorithms Checkpoints inspect one atomic cell; sleeps wait on that same cell so cancellation wakes them without polling. Native execution costs remain delegated.
 * @evidence contracts/performance.md#reuse-equivalent-work A scope conveys task ownership only and never caches command results or authorizes reuse of a discovery proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Scope state is restored after the synchronous callback; tracked retirement promises remain with the worker request owner until joined.
 */
export namespace OwnedSynchronousProcess {
  /**
   * One synchronous task's cancellation, command relay and retirement records.
   * The asynchronous owner supplies these collections and joins/reports them
   * after the synchronous scope restores its predecessor.
   *
   * @evidence contracts/common.md#principled-implementation One scope binds cancellation and native command ownership to the same task; caller-owned collections preserve retirement and cleanup failures after scope restoration.
   * @evidence contracts/common.md#clear-and-simple-design Four fields express admission, command delegation, pending closure and ownership failure without placing process containment in this type.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit ownership carries actual promises and errors rather than inferring closure from a kill request or an unavailable result.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the owner's post-scope responsibility; field comments specify cancellation-cell encoding and optional collection behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Shared memory and Node spawn options represent the worker/native boundary; the relay owns platform process containment.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This type declares task capabilities and collections, without executing a command or selecting an algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Scope identity authorizes no reusable computation or cache hit.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The type allocates no task or handle; runtime members and the asynchronous owner govern collection lifetime and joining.
   */
  export interface Scope {
    /** First Int32 cell: zero admits work; any nonzero value cancels it. */
    cancel: SharedArrayBuffer;

    /**
     * Synchronous relay whose owner contains and joins the actual command.
     * The returned spawn result describes that command's real completion;
     * callers do not transfer closure authority merely by requesting a kill.
     *
     * @evidence contracts/common.md#principled-implementation This capability supplies actual synchronous command completion to the same task that owns cancellation and post-task retirement.
     * @evidence contracts/common.md#clear-and-simple-design Command, argv and Node options form one explicit relay boundary; the owning supervisor retains native process containment policy.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts A real spawn result is required; no patched child-process API, cached success or empty output stands in for command execution.
     * @evidence contracts/common.md#meaningful-documentation Native prose defines synchronous completion and distinguishes a termination request from closure authority.
     * @evidence contracts/portability.md#os-neutral-implementation Native Node spawn arguments/options and return types cross the seam without shell assembly; the supplied supervisor handles platform containment.
     * @evidenceExclude contracts/performance.md#efficient-algorithms The function field declares the command capability; its concrete relay owns launch, output and joining algorithms.
     * @evidenceExclude contracts/performance.md#reuse-equivalent-work Declaring a relay authorizes no equivalent-result reuse or deduplication of effectful commands.
     * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This signature acquires no process or handle; the concrete synchronous relay must contain and join its command before returning.
     */
    launch?: (
      command: string,
      args: readonly string[],
      options: SpawnSyncOptions,
    ) => ReturnType<typeof spawnSync>;

    /** Optional original retirement promises, awaited after synchronous work. */
    retirements?: Set<Promise<unknown>>;

    /** Optional original cleanup failures that legacy catches must not erase. */
    failures?: unknown[];
  }

  /**
   * Run one synchronous payload, restoring a prior scope even on failure.
   * Returning a Promise does not extend this lexical scope until settlement.
   *
   * @evidence contracts/common.md#principled-implementation Entry and successful completion check cancellation; finally restores the previous scope even when admission, callback or completion throws.
   * @evidence contracts/common.md#clear-and-simple-design One saved predecessor supports nesting without an asynchronous context registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual callback runs under explicit scope; no monkeypatch or unavailable result represents cancellation.
   * @evidence contracts/common.md#meaningful-documentation Native prose states restoration and the synchronous lifetime limit for returned Promises.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Scope installation sequences opaque callbacks and cancellation checks; command and filesystem representation remain with the supplied owner.
   * @evidence contracts/performance.md#efficient-algorithms A saved reference and two delegated checks surround the callback; callback costs and native blocking remain its owner's responsibility.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every invocation runs its own effectful callback and establishes no equivalent-result reuse.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Finally restores the previous reference; task-created promises and failures stay in caller-owned collections for later joining rather than being silently discarded.
   */
  export function run<T>(scope: Scope, callback: () => T): T {
    const previous = current;
    current = scope;
    try {
      checkpoint();
      const result = callback();
      checkpoint();
      return result;
    } finally {
      current = previous;
    }
  }

  /**
   * Reject cancelled payload work with AbortError. Cleanup must instead finish
   * its ownership transitions, optionally observing cancelled without throwing.
   *
   * @evidence contracts/common.md#principled-implementation The shared admission state determines cancellation and produces the documented AbortError rather than a degraded plugin result.
   * @evidence contracts/common.md#clear-and-simple-design One predicate and one exception separate admission from cleanup policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Real cancellation is thrown; no success value or empty result impersonates completed work.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies the error and explains why cleanup must not use this throwing guard.
   * @evidence contracts/portability.md#os-neutral-implementation Atomics and DOMException provide the same shared-cell and AbortError contract across supported Node platforms.
   * @evidence contracts/performance.md#efficient-algorithms One delegated atomic observation and at most one exception allocation perform the guard.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Cancellation is mutable admission state and is observed anew rather than cached.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The guard opens no resource and retains no error after throwing; lexical cleanup remains with callers.
   */
  export function checkpoint(): void {
    if (cancelled())
      throw new DOMException("ttsc: operation cancelled", "AbortError");
  }

  /**
   * Identify withdrawn payload admission without interrupting cleanup.
   * No installed scope means ordinary synchronous work remains admitted.
   *
   * @evidence contracts/common.md#principled-implementation Only an installed scope's first shared Int32 cell determines this task's cancellation; nonzero values uniformly withdraw admission.
   * @evidence contracts/common.md#clear-and-simple-design A boolean observation allows cleanup to choose its own grace without throwing midway through release.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An atomic shared value is cancellation authority; elapsed time or process-name guesses are not substituted.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes nonthrowing cleanup observation from ordinary unscoped admission.
   * @evidence contracts/portability.md#os-neutral-implementation SharedArrayBuffer and Atomics.load avoid platform-specific worker signaling conventions.
   * @evidence contracts/performance.md#efficient-algorithms Each scoped call creates one short typed view and loads one cell; it scans no task collection.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A cancellation cell may change between calls, so prior observations cannot be reused.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The temporary view retains no independent handle or asynchronous work after return.
   */
  export function cancelled(): boolean {
    return (
      current !== undefined && Atomics.load(new Int32Array(current.cancel), 0) !== 0
    );
  }

  /**
   * Sleep between payload attempts; a cancelling owner stores the cell and
   * notifies it to wake the wait. Native scheduling can delay resumed execution.
   *
   * @evidence contracts/common.md#principled-implementation Checks before and after Atomics.wait cover cancellation before admission, during the wait and before subsequent work.
   * @evidence contracts/common.md#clear-and-simple-design The cancellation cell doubles as the wait address; ordinary callers use a fresh zero cell.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Shared-cell notification interrupts the actual wait instead of substituting a delayed cancellation result.
   * @evidence contracts/common.md#meaningful-documentation Native prose states store-plus-notify ownership and avoids claiming a hard scheduling deadline.
   * @evidence contracts/portability.md#os-neutral-implementation Node shared-memory waits replace shell sleeps and preserve the ordinary synchronous wait behavior.
   * @evidence contracts/performance.md#efficient-algorithms One blocking wait avoids active polling; timeout and native scheduling govern the suspension's duration.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each sleep sequences its own payload attempts and produces no reusable result.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No timer or child is installed; the synchronous wait and temporary view end on notification, value mismatch or timeout before the final guard.
   */
  export function sleep(milliseconds: number): void {
    checkpoint();
    const state = new Int32Array(current?.cancel ?? new SharedArrayBuffer(4));
    Atomics.wait(state, 0, 0, milliseconds);
    checkpoint();
  }

  /**
   * Delegate a command only through the installed owner's synchronous relay.
   * Undefined means no relay is installed; callers retain their native path.
   *
   * @evidence contracts/common.md#principled-implementation The explicit relay receives the original command, argv and options, with cancellation guards before and after real completion.
   * @evidence contracts/common.md#clear-and-simple-design Optional delegation preserves ordinary synchronous callers without importing supervisor policy here.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Undefined denotes absent delegation, never fabricated command success; the relay must return the actual joined command result.
   * @evidence contracts/common.md#meaningful-documentation Native prose identifies optional delegation and the ordinary caller's fallback responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation Node spawn argument/options types cross the seam without shell string assembly; native containment remains the relay owner's responsibility.
   * @evidence contracts/performance.md#efficient-algorithms A relay lookup and two guards surround one opaque synchronous launch; command execution, output buffers and joining are delegated costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Effectful commands are never cached or deduplicated by this seam.
   * @evidence contracts/performance.md#bound-retention-and-release-resources This function retains no child itself; the supplied relay owns actual containment and completion before returning, while scope restoration belongs to run.
   */
  export function launch<T extends string | Buffer = Buffer<ArrayBuffer>>(
    command: string,
    args: readonly string[],
    options: SpawnSyncOptions,
  ): SpawnSyncReturns<T> | undefined {
    if (current?.launch === undefined) return undefined;
    checkpoint();
    const result = current.launch(command, args, options);
    checkpoint();
    return result as SpawnSyncReturns<T>;
  }

  /**
   * Register an original retirement promise for the asynchronous owner to join.
   * True means registration occurred, so a producer must keep that work
   * referenced until closure; this function neither awaits nor removes entries.
   *
   * @evidence contracts/common.md#principled-implementation The original promise is retained, including rejection, while an attached rejection handler prevents an unhandled notification before the owner joins it.
   * @evidence contracts/common.md#clear-and-simple-design The registration boolean lets producers preserve ordinary unref behavior while scoped work remains alive through joining.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Registering actual exit/close promises never certifies closure merely from a termination request; rejection remains in the original promise.
   * @evidence contracts/common.md#meaningful-documentation Native prose states registration, keepalive ownership and the absence of awaiting or collection removal here.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Promise registration interprets no native process or filesystem representation; producers supply actual native closure promises.
   * @evidence contracts/performance.md#efficient-algorithms One Set insertion and rejection-handler attachment avoid scanning previously registered work; costs scale with distinct promise registrations.
   * @evidence contracts/performance.md#reuse-equivalent-work Set identity prevents duplicate references to the same promise; no result equivalence or shared command execution is inferred.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Caller-owned entries remain for the request lifetime until its asynchronous owner joins and releases the collection; this registration operation schedules no collection cleanup.
   */
  export function track(retirement: Promise<unknown>): boolean {
    if (current?.retirements === undefined) return false;
    current.retirements.add(retirement);
    void retirement.catch(() => undefined);
    return true;
  }

  /**
   * Preserve original ownership failures across legacy unavailable conversion.
   * The asynchronous owner reports the collected failures after joining work;
   * absent scope or collection means this reporting seam does nothing.
   *
   * @evidence contracts/common.md#principled-implementation The original error is appended before a cleanup caller throws, so a legacy catch cannot erase the asynchronous owner's failure record.
   * @evidence contracts/common.md#clear-and-simple-design One optional caller-owned array separates failure recording from later aggregate publication.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Recording preserves the actual failure rather than treating an unavailable outcome as successful cleanup.
   * @evidence contracts/common.md#meaningful-documentation Native prose states deferred reporting and the ordinary unscoped no-op behavior.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Appending an opaque failure interprets no platform-specific errno or native ownership state.
   * @evidence contracts/performance.md#efficient-algorithms One append retains a reference per reported failure without formatting errors or traversing prior records.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each occurrence is preserved as reported; error identity does not authorize skipping a distinct failed ownership transition.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The caller's request collection retains original errors until aggregate reporting and request release; this seam owns no independent handle or asynchronous task.
   */
  export function reportFailure(error: unknown): void {
    current?.failures?.push(error);
  }
}

let current: OwnedSynchronousProcess.Scope | undefined;
