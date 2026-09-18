import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { derivationIdentity } from "../envelope/derivationIdentity";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { graphInputStateHash } from "../inputs/graphInputStateHash";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { matchesGraphInputObservation } from "../inputs/matchesGraphInputObservation";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";

/**
 * Re-check a cached mixed graph/dependency input set with its owning codec,
 * reusing the recorded hash of any input whose metadata signature still holds
 * under a freshly minted same-device reference and reporting the signatures
 * this pass captured.
 *
 * The caller adopts those signatures only once every input is proven unchanged,
 * so a signature never outlives the content comparison that justified it.
 */
export function matchesCachedExternalInputs(
  cached: TtscCachedProjectTransform,
): {
  matches: boolean;
  signatures: Record<string, string>;
} {
  const signatures: Record<string, string> = {};
  let matches = true;
  const state = envelopeDerivation(cached);
  const graphRealpaths = cached.externalInputRealpaths ?? {};
  const filesystem = resultFilesystem(cached.result);
  const recordedHashes = cached.externalInputHashes ?? {};
  const recordedSignatures = cached.externalInputSignatures ?? {};
  // Compare each spelling against the recorded state under its own name. Two
  // spellings share one identity exactly when they selected one physical file
  // at generation time, which is the state a retarget ends, so neither may
  // answer for the other: skipping the second would leave a retargeted alias
  // unvalidated, and comparing them only through a shared key would let
  // whichever came first decide.
  for (const file of cached.externalInputPaths ??
    Object.keys(cached.externalInputHashes ?? {})) {
    const identity = derivationIdentity(state, file);
    const spelling = path.resolve(file);
    const observation = cached.externalInputObservations?.[spelling];
    if (observation !== undefined) {
      const before = inputMetadataEvidence(file, filesystem);
      if (
        before !== undefined &&
        before.separable &&
        recordedSignatures[spelling] === before.signature
      ) {
        signatures[spelling] = before.signature;
        continue;
      }
      const observed = matchesGraphInputObservation(
        file,
        observation,
        filesystem,
        state.identityContext,
      );
      const after = inputMetadataSignature(file, filesystem);
      if (!observed) {
        matches = false;
      } else if (before?.separable === true && before.signature === after) {
        signatures[spelling] = after;
      }
      continue;
    }
    // Reuse the recorded hash of an out-of-walk input whose signature still
    // equals the one captured around the read that proved it. The signature is
    // keyed by this exact spelling, so an alias of the same physical file
    // cannot answer for it.
    const before = inputMetadataEvidence(file, filesystem);
    if (
      before !== undefined &&
      Object.prototype.hasOwnProperty.call(recordedSignatures, spelling) &&
      Object.prototype.hasOwnProperty.call(recordedHashes, identity) &&
      before.separable &&
      before.signature === recordedSignatures[spelling]
    ) {
      continue;
    }
    const hash = Object.prototype.hasOwnProperty.call(graphRealpaths, identity)
      ? graphInputStateHash(file, filesystem)
      : hostInputStateHash(file, filesystem);
    const after = inputMetadataSignature(file, filesystem);
    if (
      !Object.prototype.hasOwnProperty.call(recordedHashes, identity) ||
      recordedHashes[identity] !== (hash ?? MISSING_INPUT_STATE)
    ) {
      matches = false;
    }
    if (
      hash !== null &&
      after !== undefined &&
      before?.signature === after &&
      before.separable
    ) {
      signatures[spelling] = after;
    }
  }
  return { matches, signatures };
}
