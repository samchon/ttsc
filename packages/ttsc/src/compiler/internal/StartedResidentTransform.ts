import { ResidentTransformProcess } from "./ResidentTransformProcess";

/**
 * A started resident transform host plus the project root its keys are relative
 * to.
 *
 * Returned by {@link startResidentTransform}. The two travel together because a
 * request names files by project-relative key, and a caller that resolved the
 * root differently from the host would ask about a file the host never loaded.
 *
 * @evidence contracts/common.md#principled-implementation Pairing the live client with the producer's project root preserves the identity needed to form its project-relative file keys.
 * @evidence contracts/common.md#clear-and-simple-design One startup return record transfers the process and its key anchor together rather than asking callers to resolve the root again.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The root is the configured producer's actual anchor, not a guessed working directory or consumer-specific filename substitution.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why the pair travels together, and separated members document disposal and root spelling following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The project root carries the native spelling used by the resident Program; callers derive keys relative to that same anchor instead of assuming a slash or case policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface StartedResidentTransform {
  /** The live host process; dispose it when the service shuts down. */
  process: ResidentTransformProcess;

  /** Project root in the spelling the resident Program uses for its files. */
  projectRoot: string;
}
