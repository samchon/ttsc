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
