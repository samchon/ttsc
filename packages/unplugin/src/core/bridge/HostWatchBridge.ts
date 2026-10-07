import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * A watching build session's input-observation boundary, which requests host
 * invalidation by moving the project's record (`openHostWatchBridge`). A move
 * is not itself proof that the host observed or rebuilt that project.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Sequence capture, input registration and owed-state queries represent the
 *   delivery/change race; compile dependency reports distinguish watched records.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One session boundary exposes record ownership without leaking watcher/timer maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The bridge signals through owned record files rather than modifying host watchers.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native member paragraphs explain capture timing, persistence and retry scope;
 *   documented members and tags are separated per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Record/input arguments and dependency callbacks carry absolute native
 *   spellings handed to the host; sequence tokens and pass windows are separate
 *   from native timestamps. The implementing observer owns actual case/path
 *   capability and reproof; this boundary does not infer them from an OS name.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   This boundary organizes capture/query/registration/lifecycle operations.
 *   Record scans, timer scheduling and input condition proofs are selected and
 *   costed by openHostWatchBridge and its observer, not by this representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Immutable delivery arrays/tokens permit the implementation's registration
 *   reuse; this shape supplies no independent cache key or validity mechanism.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   openHostWatchBridge owns records, retry timers and its observer; the close
 *   member specifies cleanup attempts and persisted-file behavior. This shape
 *   does not independently acquire those resources or bound their populations.
 */
export interface HostWatchBridge {
  /**
   * The current change sequence, taken before a compile so registration can
   * tell what changed during it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The observer sequence captured before delivery relates registered evidence
   *   to changes during the pass instead of treating late delivery as current.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One scalar exposes the pass boundary without leaking event storage.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   A real change token replaces timing guesses about host watcher baselines.
   * @evidence contracts/common.md#meaningful-documentation
   *   The method states capture timing and reason with native tag/member spacing
   *   required by documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   The returned number is a monotone change sequence, not a native timestamp,
   *   path identity or filesystem capability.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   This scalar capture boundary selects no algorithm; openHostWatchBridge
   *   owns pass advancement and the observer's sequence read.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Captures a pass token rather than sharing a computation across callers.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The scalar result acquires no resource or retained population.
   */
  begin(): number;

  /**
   * Attempt observer cleanup and drop every owed signal. Backend close failures
   * are suppressed by the observer and are not certified as released. The
   * records stay: a host's persistent cache holds them as dependencies, and the
   * next session proves them against the disk. A later delivery can register
   * inputs again on the observer's retained root. Pass counters and the recent
   * answering-pass window remain; completion does not promise owes() is false.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Completion represents clearing bridge registrations/signals and attempting
   *   observer disposal. Persistent record files remain for host cache dependencies;
   *   completion does not certify a backend whose close threw.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One close boundary groups release rather than exposing each resource handle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Keeping records preserves actual persistent-cache dependencies, not abandoned
   *   live watcher resources.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose distinguishes observer release from persisted files, separated
   *   from tags and members per documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   This closure boundary carries no native spelling or capability value;
   *   observer disposal and record persistence are implemented by their owners.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   openHostWatchBridge owns clearing record/timer populations and delegating
   *   observer disposal; this member declares their completion boundary.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Disposal is a lifecycle effect, not a reusable computed result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The bridge implementation owns timers and observer handles. This member
   *   specifies when its cleanup attempt is complete, without owning the state.
   */
  close(): Promise<void>;

  /**
   * Report the records a compile of the host ended depending on, which the
   * host's watcher observes until its next compile. The moves after a signal's
   * first defend that watcher against a baseline taken after the move, so only
   * a record the watcher observes is moved on the growing schedule; one it does
   * not observe is still observed here and moved once per change, which a
   * compile that later depends on it reads through its cache's snapshot. A host
   * with several compilers opens one bridge per compiler, and each takes every
   * record of the tool directory at its first pass: a compiler holding no
   * module of a project never delivers the registration that ends the schedule,
   * and would otherwise move the record for the rest of the session and run the
   * compilers that do observe it each time. A record the watcher starts
   * observing with a signal still owed is moved again at once, on the schedule,
   * since the watcher took its baseline without that move.
   *
   * @param depends Whether the compile depends on a record, by its absolute
   *   path, the one `projectRecordFile` spells and the host was handed.
   * @evidence contracts/common.md#principled-implementation
   *   The host predicate reports current record dependencies, so retries target
   *   reported recipients. That report alone does not prove watcher health or
   *   that a recipient will ever deliver a settling registration.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One predicate transfers dependency knowledge without a bundler-specific graph type.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The predicate reports actual host dependencies rather than guessed compiler names.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native paragraphs explain unwatched records and resumed retries; parameter
   *   and acknowledgment spacing follow documentation guidance.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The callback receives the absolute native record spelling delivered to
   *   the host. It must report dependencies in that representation; this member
   *   does not certify arbitrary alias equivalence or actual watcher health.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   The implementing bridge owns the registered-record scan and caller's
   *   predicate cost; the signature selects no traversal strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Reports one completed host pass's dependencies rather than caching a
   *   result across later passes.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The bridge owns retry timers and observed records; this callback contract
   *   transfers dependency knowledge without acquiring or retaining a handle.
   */
  compiled(depends: (record: string) => boolean): void;

  /**
   * Whether the host has yet to run its modules against a change: a project was
   * signalled since its record last registered, the one named or any the bridge
   * observes, or a signal was answered in the current pass or the one before,
   * whose other modules the host would still serve from the cache the signal
   * was about. A host whose watcher applies the record's move to the build in
   * progress, and then keeps that build's cache of the modules, loses the
   * signal; Rollup does, measured on its watcher (samchon/ttsc#1460), and asks
   * through `shouldTransformCachedModule` instead, before it serves a module
   * from its cache, for any project since the module names none.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Per-record or global queries include unsettled signals and the answering
   *   pass window, preventing earlier stale modules from being reused immediately.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One query exposes pass invalidation without exposing signal collections.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The extra pass follows a real host cache baseline race rather than forcing
   *   all cached modules to transform unconditionally.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose explains the pass window and global query's purpose, with
   *   separated paragraphs/tags per documentation guidance.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The optional record uses the absolute native delivered spelling; the
   *   implementing bridge resolves it before Set lookup. The global pass-window
   *   answer is separate from record spelling and certifies no native file state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   The implementation owns scalar/Set lookup and optional native resolution;
   *   this member declares the query semantics rather than an algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Queries current owed/pass state; it does not coordinate reusable work.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The implementing bridge owns the owed Set and pass window, while this
   *   boolean result acquires no handle or history.
   */
  owes(record?: string): boolean;

  /**
   * Replace the inputs observed for one project's record with a delivery's, as
   * the Vite serve watcher does for an importer. The registration answers every
   * signal still owed to the record, and signals again at once when the
   * delivery read a state a change since `startedAt` has left
   * (samchon/ttsc#1423). Without `startedAt`, every input is proven against the
   * disk now, which is how a record handed over at a build start, read from the
   * file rather than delivered, is taken (`refreshProjectRecordFiles`).
   *
   * @evidence contracts/common.md#principled-implementation
   *   Inputs and optional capture sequence replace the record's evidence; without
   *   a token the observer proves inputs now, while failed delivery retains recovery paths.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One replacement boundary keeps record identity and evidence together.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Registration settles then rechecks races instead of declaring a host signal answered
   *   solely because any module returned.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native paragraphs explain capture-token omission and immediate re-signaling,
   *   with native tag/member spacing following documentation guidance.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   Record and input paths carry the native spellings delivered to the host;
   *   the implementing bridge resolves the record and delegates input identity
   *   and native condition reproof to its observer. startedAt is a sequence,
   *   not an OS timestamp or direct proof of unchanged input bytes.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   The implementing bridge and observer own registration/condition indexing
   *   and proof costs; the member defines their input transfer boundary.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   The implementation may share a delivery only for the same immutable input
   *   array and capture token when not failed; a changed population needs a new
   *   array. This declaration owns no memo or independent validity mechanism.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The bridge retains registration arrays and settles retry timers; its
   *   observer owns transferred input conditions. This member acquires no handle.
   */
  register(
    record: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
