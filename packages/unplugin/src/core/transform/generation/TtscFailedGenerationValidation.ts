import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscFailedGenerationInputState } from "./TtscFailedGenerationInputState";

/**
 * Filesystem comparison baseline that may authorize replacing a terminal failed
 * generation. The cached attempt supplies retained comparison data; its live
 * watchers and clock probe are released before the terminal error is retained.
 *
 * @evidence contracts/common.md#principled-implementation Declared keys, project hashes, walk failure shape and exact out-of-walk states jointly represent the environment whose change permits retry; cached supplies the same attempt's membership and identity context.
 * @evidence contracts/common.md#clear-and-simple-design This carrier groups project-walk and external-input baselines without owning re-probing or cache lifecycle decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Retry premises preserve observed state rather than substituting a module request count or arbitrary timeout for environmental change.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes retained comparison data from released live resources, and separated member comments identify each witness and undefined declared-scope meaning.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscFailedGenerationValidation only declares a shape; it has no
 *   filesystem, path or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscFailedGenerationValidation only declares a shape; it has no
 *   computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscFailedGenerationValidation only declares a shape; it has no work to
 *   reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscFailedGenerationValidation only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscFailedGenerationValidation {
  /** Last attempted generation, retained only as a comparison baseline. */
  cached: TtscCachedProjectTransform;

  /** Input keys whose content can affect the generation, or the whole walk. */
  declaredInputs: ReadonlySet<string> | undefined;

  /** Fingerprints of every out-of-walk and exact host input. */
  inputStates: ReadonlyMap<string, TtscFailedGenerationInputState>;

  /** On-disk project hashes the final attempt's walk recorded. */
  projectInputHashes: Readonly<Record<string, string>>;

  /** Coherence and exact failure state of the final project walk. */
  projectWalkComplete: boolean;

  /**
   * Fingerprint of the walk failures relevant to the declared inputs, so a
   * change in them permits a retry.
   */
  projectWalkFailures: string;
}
