import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostInputRealpath } from "../inputs/hostInputRealpath";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { inputMetadataSignature } from "../inputs/inputMetadataSignature";
import { MISSING_INPUT_STATE } from "./MISSING_INPUT_STATE";
import type { TtscHostInputValidation } from "./TtscHostInputValidation";
import { inputSignatureSlot } from "./inputSignatureSlot";
import { matchesRecordedInput } from "./matchesRecordedInput";

/**
 * Validate the universal inputs that exist, by metadata first and content only
 * when that moved.
 *
 * Every rejection here is evidence of a change — a vanished path, a moved
 * physical target, a strict blocker's metadata, differing content — so this
 * half is safe for a validation path that must never discard a generation for
 * want of a proof.
 */
export function matchesUniversalHostInputEntries(
  cached: TtscCachedProjectTransform,
  validation: TtscHostInputValidation,
): boolean {
  const filesystem = resultFilesystem(cached.result);
  for (const entry of validation.entries.values()) {
    const evidence = inputMetadataEvidence(entry.path, filesystem);
    if (
      entry.signature !== undefined &&
      evidence?.signature === entry.signature &&
      (entry.strict === true || evidence.separable)
    )
      continue;
    if (entry.strict === true) return false;
    if (hostInputRealpath(entry.path, filesystem) !== entry.realpath)
      return false;
    if (!matchesRecordedInput(cached, entry.path)) {
      return false;
    }
    if (entry.readable === false) {
      const slot = inputSignatureSlot(
        cached,
        envelopeDerivation(cached),
        entry.path,
      );
      entry.readable =
        slot !== undefined && slot.recorded !== MISSING_INPUT_STATE;
    }
    if (evidence === undefined) return false;
    // Re-earn the proof under the rules the capture applies: an entry whose
    // recorded state came from reading nothing keeps its content comparison, a
    // write racing the read that just proved it records nothing, and a stamp
    // the filesystem's clock has not provably left records nothing either.
    const after = inputMetadataSignature(entry.path, filesystem);
    entry.signature =
      entry.readable && evidence.separable && after === evidence.signature
        ? evidence.signature
        : undefined;
  }
  return true;
}
