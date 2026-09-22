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
   * Whether a project was signalled since its record last registered, so the
   * host has yet to run its modules against the change: the one project named,
   * or any project the bridge observes. A host whose watcher applies the
   * record's move to the build in progress, and then keeps that build's cache
   * of the modules, loses the signal; Rollup does, measured on its watcher
   * (samchon/ttsc#1460), and asks through `shouldTransformCachedModule`
   * instead, before it serves a module from its cache, for any project since
   * the module names none.
   */
  owes(record?: string): boolean;
  /**
   * Replace the inputs observed for one project's record with a delivery's, as
   * the Vite serve watcher does for an importer. The registration answers every
   * signal still owed to the record, and signals again at once when the
   * delivery read a state a change since `startedAt` has left
   * (samchon/ttsc#1423).
   */
  register(
    record: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
