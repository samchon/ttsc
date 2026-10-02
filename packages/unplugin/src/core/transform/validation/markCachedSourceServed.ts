import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";

/**
 * Record a module after admitted output selection and watch notification.
 *
 * transformTtsc also marks an admitted missing-output return, then hands the
 * source back unchanged. For actual output it marks before constructing the
 * final host value; this is a generation validation checkpoint, not a guarantee
 * that downstream result construction or the host's delivery completed.
 *
 * @evidence contracts/common.md#principled-implementation The generation's path identity key records the caller's admitted selection checkpoint across equivalent spellings, enabling first-versus-later validation without claiming completed host delivery.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns delivery-set insertion while transformTtsc owns successful selection timing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual transformTtsc call sites follow output selection or the typed missing-output continuation and completed watch notification; a mere cache hit or generic selection failure does not call this marker.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish the admitted checkpoint, missing-output continuation and later host-result construction from completed delivery.
 * @evidence contracts/portability.md#os-neutral-implementation Identity follows the envelope's filesystem context and actual case policy rather than lowercasing paths by OS name.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Set insertion hashes the identity text; envelope state lookup shares an
 *   existing transaction or initializes native root identity on first use.
 *   Uncached path resolution may observe aliases, ancestors and directory case
 *   policy, so delegation is not constant work independent of spelling length.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The servedFiles set records each served file once.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The generation-owned set grows with distinct served identities and their
 *   text. A successfully proven new epoch clears it; generation retirement
 *   leaves it collectible with the generation, without a separate native handle.
 */
export function markCachedSourceServed(
  /** Generation owning the served set and native identity transaction. */
  cached: TtscCachedProjectTransform,
  /** Admitted native source spelling converted to the generation identity. */
  file: string,
): void {
  (cached.servedFiles ??= new Set()).add(
    pathIdentityKey(file, envelopeDerivation(cached).identityContext),
  );
}
