import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * An adapter-owned observer for build hosts whose own watch channel cannot
 * observe what the compiler observed (samchon/ttsc#1388).
 *
 * The host is told about a change through one owned sentinel file per importer.
 * That is a file the host can always watch, and writing it re-runs exactly the
 * importers whose inputs changed.
 */
export interface HostWatchBridge {
  /**
   * The current change sequence, taken before a compile so registration can
   * tell what changed during it.
   */
  begin(): number;
  /**
   * Close every observer and drop every owed signal. The sentinels stay: a
   * host's persistent cache records them, and the next session reuses them.
   */
  close(): Promise<void>;
  /**
   * Whether the importer was signalled since it last registered, so the host
   * has yet to run it against the change. A host whose watcher applies a
   * sentinel rewrite to the build in progress, and then keeps that build's
   * cache of the importer, loses the signal; Rollup does, measured on its
   * watcher (samchon/ttsc#1460), and asks through `shouldTransformCachedModule`
   * instead, before it serves a module from its cache.
   */
  owes(importer: string): boolean;
  /**
   * Replace one importer's compiler inputs with a delivery's, as the Vite serve
   * watcher does. The registration answers every signal still owed to the
   * importer, and signals again at once when the delivery read a state a change
   * since `startedAt` has left (samchon/ttsc#1423).
   *
   * @returns The importer's sentinel, which the caller registers through the
   *   host's own file channel, or `undefined` when the bridge observes nothing
   *   for the importer.
   */
  register(
    importer: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): string | undefined;
}
