import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/**
 * One derived input and its optional generation proof.
 *
 * @evidence contracts/common.md#principled-implementation A lexical path identifies the watched spelling while optional evidence distinguishes recorded state from recovery-only registrations.
 * @evidence contracts/common.md#clear-and-simple-design The pair separates the host's registration path from the generation facts used to validate it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing evidence remains explicit rather than supplying a guessed successful state.
 * @evidence contracts/common.md#meaningful-documentation Native member comments explain absolute spelling and recovery absence, with member spacing and a blank tag separator following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical spelling remains separate from evidence identity; no OS-wide case assumption is encoded in the carrier.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscWatchInput only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscWatchInput only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscWatchInput only declares a shape; it has no handle or retained state
 *   at runtime.
 */
export interface TtscWatchInput {
  /**
   * What the generation recorded for this input; absent on failed-generation
   * recovery registrations.
   */
  evidence?: TtscWatchInputEvidence;

  /** Absolute lexical spelling of the input. */
  file: string;
}
