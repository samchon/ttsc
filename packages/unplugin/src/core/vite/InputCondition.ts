import type { TtscWatchInputBaseline } from "../transform/watch/TtscWatchInputBaseline";
import type { TtscWatchInputEvidence } from "../transform/watch/TtscWatchInputEvidence";

/**
 * One recorded state of a watched compiler input, shared by the importers that
 * registered it.
 *
 * Either the generation's own evidence for the input, or a baseline this
 * watcher captured itself. The importers are the modules to invalidate when the
 * state no longer holds. Several conditions can coexist for one path when
 * different generations recorded different states for it.
 */
export interface InputCondition {
  /** State this watcher captured itself when the generation supplied none. */
  baseline?: TtscWatchInputBaseline;
  /** The generation's recorded state for the input. */
  evidence?: TtscWatchInputEvidence;
  /** Modules to invalidate when this state stops holding. */
  importers: Set<string>;
}
