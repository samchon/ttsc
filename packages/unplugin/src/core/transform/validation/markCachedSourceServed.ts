import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";

/**
 * Record a successfully selected module as delivered by this generation.
 *
 * @evidence contracts/common.md#principled-implementation The generation's path identity key records successful delivery once across equivalent spellings, enabling first-versus-later delivery validation.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns delivery-set insertion while transformTtsc owns successful selection timing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This marks only an admitted delivery, not a cache hit before selection or a guessed output.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies successful selection and generation ownership rather than implying compilation itself delivers a module.
 * @evidence contracts/portability.md#os-neutral-implementation Identity follows the envelope's filesystem context and actual case policy rather than lowercasing paths by OS name.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The servedFiles set records each served file once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The set lives on the cached transform and is released with it.
 */
export function markCachedSourceServed(
  cached: TtscCachedProjectTransform,
  file: string,
): void {
  (cached.servedFiles ??= new Set()).add(
    pathIdentityKey(file, envelopeDerivation(cached).identityContext),
  );
}
