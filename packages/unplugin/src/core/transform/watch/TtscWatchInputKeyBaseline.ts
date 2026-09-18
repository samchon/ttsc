import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/** Baseline shape stored for either a discovery predicate or a full input. */
export type TtscWatchInputKeyBaseline =
  | TtscWatchInputFileBaseline
  | TtscWatchInputBaseline;
