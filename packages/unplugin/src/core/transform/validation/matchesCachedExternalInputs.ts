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
 *
 * @evidence contracts/common.md#principled-implementation Each lexical spelling replays its predicates or owning content codec; only stable separable metadata can replace that comparison, so aliases cannot answer for one another.
 * @evidence contracts/common.md#clear-and-simple-design One pass returns the aggregate verdict and earned signatures, leaving all-or-nothing adoption to its caller.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Recorded missing states and absent hash keys remain distinct from successful content proof; newer reads do not rewrite the authoritative recorded hashes.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish mixed codecs, clock-qualified reuse and caller-owned signature adoption before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Lexical resolution remains separate from derivation identity, and native predicate/content reads use the result's filesystem operations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned signature DTO transfers to the generation owner; this pass retains no independent cache or native resource.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Scans the recorded spelling population, including later entries after a
 *   mismatch. Each input pays path/identity and initial native metadata work;
 *   a qualified signature skips replay and recapture. Formatting follows
 *   path/bigint text. Replay hashes selected bytes or collects predicate
 *   failures/listings, then recaptures metadata for earned signatures.
 *   Earned signature storage grows with successful observed spellings; legacy
 *   fallback also materializes the recorded hash key array.
 * @evidence contracts/performance.md#reuse-equivalent-work The generation's unchanged separable signatures share prior content validation; changed metadata or clock ordering requires replay, and adopted signatures come only from a completely successful caller verdict.
 */
export function matchesCachedExternalInputs(
  /** Generation recording lexical inputs, distinct codecs and earned signatures. */
  cached: TtscCachedProjectTransform,
): {
  /** Whether every recorded external spelling still matches its authority. */
  matches: boolean;

  /** Earned metadata witnesses adopted only after aggregate proof succeeds. */
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
