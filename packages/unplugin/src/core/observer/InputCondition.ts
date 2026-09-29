import type { TtscWatchInputBaseline } from "../transform/watch/TtscWatchInputBaseline";
import type { TtscWatchInputEvidence } from "../transform/watch/TtscWatchInputEvidence";

/**
 * One recorded state of a watched compiler input, shared by the owners that
 * registered it.
 *
 * Either the generation's own evidence for the input, or a baseline this
 * watcher captured itself. The owners are the ones told when the state no
 * longer holds. Several conditions can coexist for one path when different
 * generations recorded different states for it.
 *
 * @evidence contracts/common.md#principled-implementation Evidence or an observer baseline belongs to one condition, allowing different generations to share a path without overwriting each other's recorded state.
 * @evidence contracts/common.md#clear-and-simple-design The condition combines one state representation and its owner set; path aliases and watch resources remain in the entry and scope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing generation state requires an observed baseline rather than implied success or another owner's later evidence.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains coexisting conditions, baseline fallback, and which owners hear a failed condition.
 */
export interface InputCondition {
  /**
   * State this watcher captured itself when the evidence records none, even if
   * evidence exists.
   */
  baseline?: TtscWatchInputBaseline;

  /** The generation's recorded state for the input. */
  evidence?: TtscWatchInputEvidence;

  /** The owners told when this state stops holding. */
  owners: Set<string>;
}
