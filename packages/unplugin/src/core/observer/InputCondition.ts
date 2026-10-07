import type { TtscWatchInputBaseline } from "../transform/watch/TtscWatchInputBaseline";
import type { TtscWatchInputEvidence } from "../transform/watch/TtscWatchInputEvidence";

/**
 * One recorded state of a watched compiler input, shared by the owners that
 * registered it.
 *
 * Either the generation's own evidence for the input, or a baseline this
 * watcher attempted to capture itself. A failed baseline attempt stays
 * undefined, and later comparison cannot certify it. The owners are told when
 * the state no longer holds or cannot be proven. Conditions coexist when
 * different generations recorded different states for it.
 *
 * @evidence contracts/common.md#principled-implementation Evidence or an observer baseline belongs to one condition, allowing different generations to share a path without overwriting each other's recorded state.
 * @evidence contracts/common.md#clear-and-simple-design The condition combines one state representation and its owner set; path aliases and watch resources remain in the entry and scope.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing generation state attempts a current baseline; unavailable observation remains unproved rather than implying success or borrowing another owner's evidence.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains coexisting conditions, baseline fallback, and which owners hear a failed condition.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Evidence/baseline carry their owners' native identity, stat and realpath
 *   observations, including unavailable states. Owner strings are the native
 *   absolute registration spellings, not URLs or guessed physical aliases.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The carrier defines state/owner association; observer comparison owns
 *   traversal, native observations and encoding costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The carrier defines no sharing coordinator; observer condition keys and
 *   owner registration determine whether recorded states can be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Observer entries own condition/owner retention and removal. This carrier
 *   defines no independent acquisition, release or persistent state owner.
 */
export interface InputCondition {
  /**
   * State this watcher could capture when the evidence records none, even if
   * evidence exists.
   */
  baseline?: TtscWatchInputBaseline;

  /** The generation's recorded state for the input. */
  evidence?: TtscWatchInputEvidence;

  /** Native owner spellings notified when this state changes or is unproved. */
  owners: Set<string>;
}
