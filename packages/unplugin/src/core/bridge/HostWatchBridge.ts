import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * The watching build session's observer of the compiler's inputs, which tells
 * the host of a change by moving the project's record (`openHostWatchBridge`).
 */
export interface HostWatchBridge {
  /**
   * The current change sequence, taken before a compile so registration can
   * tell what changed during it.
   */
  begin(): number;
  /**
   * Close every observer and drop every owed signal. The records stay: a host's
   * persistent cache holds them as dependencies, and the next session proves
   * them against the disk.
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
   * @param depends Whether the compile depends on a record, by its path as it
   *   was registered.
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
   */
  register(
    record: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
