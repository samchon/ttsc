import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { ViteDevServerLike } from "./ViteDevServerLike";

/** Serve-time compiler dependencies never enter Vite's runtime import graph. */
export interface ViteServeInputWatch {
  /**
   * Bind the dev server whose graphs are invalidated, and open the pinned
   * project-root scope.
   */
  attach(server: ViteDevServerLike): void;
  /**
   * The current change sequence, taken before a compile so registration can
   * tell what changed during it.
   */
  begin(): number;
  /**
   * Close every scope, poller, and timer, and forget every entry; the attached
   * server is kept for an overlapping restart container.
   */
  dispose(): Promise<void>;
  /** Release every compiler input owned by one removed source module. */
  forget(importer: string): void;
  /**
   * Replace one importer's compiler inputs with a delivery's, keeping a failed
   * delivery's previous spellings for recovery.
   */
  replace(
    importer: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
