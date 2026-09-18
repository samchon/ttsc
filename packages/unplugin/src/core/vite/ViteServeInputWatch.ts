import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { ViteDevServerLike } from "./ViteDevServerLike";

/** Serve-time compiler dependencies never enter Vite's runtime import graph. */
export interface ViteServeInputWatch {
  attach(server: ViteDevServerLike): void;
  begin(): number;
  dispose(): Promise<void>;
  /** Release every compiler input owned by one removed source module. */
  forget(importer: string): void;
  replace(
    importer: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
