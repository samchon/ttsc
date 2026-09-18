import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { selectWatchInputs } from "../envelope/selectWatchInputs";
import { notificationsProveMembership } from "../tracker/notificationsProveMembership";
import { reportsMembershipChange } from "../tracker/reportsMembershipChange";
import { matchesProvenInput } from "./matchesProvenInput";
import { matchesUniversalHostInputs } from "./matchesUniversalHostInputs";

/**
 * Validate one graph-bearing cached output against only the inputs that can
 * affect that file. Project membership is validated once per event-loop turn,
 * so sibling module deliveries share one directory-metadata pass instead of
 * multiplying it by module count.
 *
 * Returns `undefined` when this narrow proof is unavailable — live
 * notifications can no longer prove membership, or the generation carries no
 * universal-input manifest. That is the absence of a proof, not evidence of a
 * change, so the caller falls back to complete-snapshot validation instead of
 * discarding the generation. A reported membership event, a changed universal
 * input, or a changed derived input is evidence, and returns `false`.
 */
export function matchesNarrowPersistentInputs(
  cached: TtscCachedProjectTransform,
  file: string,
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
  if (!matchesUniversalHostInputs(cached, hostValidation)) {
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
