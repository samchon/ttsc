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
