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
  /** Close every observer and remove every sentinel. */
  close(): Promise<void>;
  /**
   * Replace one importer's compiler inputs with a delivery's, as the Vite serve
   * watcher does.
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
