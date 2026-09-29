import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * The watching build session's observer of the compiler's inputs, which tells
 * the host of a change by moving the project's record (`openHostWatchBridge`).
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
   */
  begin(): number;

  /**
   * Close every observer and drop every owed signal. The records stay: a host's
   * persistent cache holds them as dependencies, and the next session proves
   * them against the disk.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Promise completion represents session observer disposal; persistent record
   *   files remain because host caches continue to depend on their paths.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One close boundary groups release rather than exposing each resource handle.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Keeping records preserves actual persistent-cache dependencies, not abandoned
   *   live watcher resources.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose distinguishes observer release from persisted files, separated
   *   from tags and members per documentation guidance.
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
   *
   * @evidence contracts/common.md#principled-implementation
   *   The host predicate identifies records its current compiler watches, so
   *   retry movements target only records with a recipient capable of settling them.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One predicate transfers dependency knowledge without a bundler-specific graph type.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The predicate reports actual host dependencies rather than guessed compiler names.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native paragraphs explain unwatched records and resumed retries; parameter
   *   and acknowledgment spacing follow documentation guidance.
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
   */
  register(
    record: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
