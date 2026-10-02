import type { TtscWatchInputBaseline } from "./TtscWatchInputBaseline";
import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/**
 * Baseline shape stored for either a discovery predicate or a full input.
 *
 * @evidence contracts/common.md#principled-implementation The union admits either the narrow discovery facts or the broader codec facts, matching the two capture operations.
 * @evidence contracts/common.md#clear-and-simple-design Named baseline types retain their own member meanings instead of duplicating their representations in this alias.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The union preserves the supported narrow shape without inventing content evidence for discovery-only inputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the two purposes and the constituent types expose their documented facts; separated tags follow documentation guidance.
 */
export type TtscWatchInputKeyBaseline =
  | TtscWatchInputFileBaseline
  | TtscWatchInputBaseline;
