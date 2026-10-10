import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import { notificationsProveMembership } from "../tracker/notificationsProveMembership";
import { reportsMembershipChange } from "../tracker/reportsMembershipChange";
import type { TtscGenerationProof } from "./TtscGenerationProof";
import { matchesProvenInput } from "./matchesProvenInput";
import { matchesUniversalHostInputs } from "./matchesUniversalHostInputs";

/**
 * Validate one graph-bearing cached output against only the inputs that can
 * affect that file. The delivery validator establishes its complete baseline
 * before admitting this path. Here live project notifications qualify current
 * membership, and universal and derived inputs still require their own proof.
 *
 * Returns `undefined` when this narrow proof is unavailable — live
 * notifications can no longer prove membership, or the generation carries no
 * universal-input manifest. That is the absence of a proof, not evidence of a
 * change, so the caller falls back to complete-snapshot validation instead of
 * discarding the generation. A reported membership event, a changed universal
 * input, or a changed derived input is evidence, and returns `false`.
 *
 * @evidence contracts/common.md#principled-implementation Proven membership and a universal manifest qualify derived-input validation; undefined distinguishes unavailable narrow authority from an observed mismatch.
 * @evidence contracts/common.md#clear-and-simple-design One narrow boundary composes universal and per-input proofs while its caller owns complete-snapshot fallback.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Lost watcher authority cannot be converted to false unchanged data or an invented dependency set.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs distinguish baseline admission, current membership authority and the three-state verdict's required caller behavior.
 * @evidence contracts/portability.md#os-neutral-implementation Native lexical spelling qualifies exact manifest coverage while dependency selection and its validators use the generation's filesystem identity policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This boundary borrows generation trackers and manifests; their owners acquire and retire retained resources.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed membership flag checks precede universal validation and one selected
 *   input scan. Universal costs include coverage/event comparisons, unresolved
 *   native probes/content and mandatory tree/environment qualification. A first
 *   module spelling also derives its graph/dependency union; each unskipped
 *   input pays native identity/metadata and any necessary predicate/content
 *   replay. Work follows these populations, path text and bytes, not just the
 *   number of modules or a fixed membership check.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Immutable envelope selections, universal manifests and currently qualified
 *   per-input signatures serve sibling deliveries. Universal validation is
 *   invoked on each call; covered lexical spellings skip only the second input
 *   proof, and memoized dependency lists do not themselves prove fresh content.
 */
export function matchesNarrowPersistentInputs(
  /**
   * Generation whose baseline, trackers and input witnesses the caller
   * qualified.
   */
  cached: TtscCachedProjectTransform,
  /** Delivered file spelling selecting this envelope's dependency closure. */
  file: string,
  proof?: TtscGenerationProof.Transaction,
): boolean | undefined {
  if (reportsMembershipChange(cached)) {
    return false;
  }
  if (!notificationsProveMembership(cached)) {
    return undefined;
  }
  const state = envelopeDerivation(cached);
  const hostValidation = cached.hostInputValidation;
  if (hostValidation === undefined) {
    return undefined;
  }
  if (!matchesUniversalHostInputs(cached, hostValidation, proof)) {
    return false;
  }
  const inputs = selectWatchInputs({
    file,
    projectRoot: cached.projectRoot,
    result: cached.result,
    scratchDirectory: cached.scratchDirectory,
    temporaryTsconfig: cached.temporaryTsconfig,
  });
  for (const input of inputs) {
    // Skip by spelling, not identity: the manifest proved this exact path, and
    // an alias of the same physical file is a different input whose own
    // retarget nothing else would see.
    if (hostValidation.covered.has(path.resolve(input))) {
      continue;
    }
    if (!matchesProvenInput(cached, state, input)) {
      return false;
    }
  }
  return true;
}
