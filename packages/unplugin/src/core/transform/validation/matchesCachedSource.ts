import { matchesProjectRootFile } from "../../tsconfig/matchesProjectRootFile";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { resultFilesystem } from "../cache/resultFilesystem";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { refreshFilesystemClockReference } from "../clock/refreshFilesystemClockReference";
import { reportDivergentDelivery } from "../diagnostics/reportDivergentDelivery";
import { createEnvelopeKeyIndex } from "../envelope/createEnvelopeKeyIndex";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { toProjectKey } from "../project/toProjectKey";
import { hashText } from "../utils/hashText";
import { matchesCompleteInputSnapshot } from "./matchesCompleteInputSnapshot";
import { matchesNarrowPersistentInputs } from "./matchesNarrowPersistentInputs";

/**
 * Validate a cached project transform against the current on-disk project
 * state.
 *
 * Always compares the current module's in-memory source with the generation
 * snapshot. A cache with a delivery epoch can use that comparison alone for a
 * stable generation's first delivery of each module in the current pass, once
 * the pass's own first delivery has proven the whole generation still matches
 * the filesystem. An incomplete generation may not take this shortcut:
 * otherwise a sibling output captured during a filesystem race could still be
 * served once. Later graph-bearing requests validate the file's derived input
 * set and project membership; graph-free envelopes conservatively re-hash the
 * complete project and out-of-walk snapshots. Any mismatch forces a complete
 * re-transform.
 */
export function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
  epoch: number | undefined,
): boolean {
  const identities = envelopeDerivation(cached).identityContext;
  const currentKey = toProjectKey(cached.projectRoot, file, identities);
  const identity = pathIdentityKey(file, identities);
  const expected =
    cached.sourceHashes?.[identity] ??
    cached.inputHashes[currentKey] ??
    cached.externalInputHashes?.[identity];
  if (
    expected === undefined &&
    cached.result.type === "success" &&
    !matchesProjectRootFile(file, cached.membershipPolicy, false)
  ) {
    const state = envelopeDerivation(cached);
    const outputs = (state.outputIndex ??= createEnvelopeKeyIndex(
      state,
      cached.projectRoot,
      cached.result.typescript,
    ));
    if (!outputs.has(identity)) {
      // Root discovery deliberately never hashed this unrelated module. Its
      // bytes cannot affect an output the compiler did not produce, but the
      // whole program must still be current before we reuse that absence: a
      // changed config or importer can bring this file into the next program.
      refreshFilesystemClockReference(
        TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
        resultFilesystem(cached.result),
      );
      return matchesCompleteInputSnapshot(cached);
    }
  }
  if (expected !== hashText(source)) {
    // The generation compiled the file from disk. When the disk still holds
    // exactly those bytes, the delivered text came from somewhere else, a
    // plugin ordered before ttsc or a read that raced an edit, and cannot
    // change the output; recompiling for it would repeat on every delivery
    // (samchon/ttsc#1394).
    if (
      expected === undefined ||
      hostInputStateHash(file, resultFilesystem(cached.result)) !== expected
    ) {
      return false;
    }
    reportDivergentDelivery(cached, file);
  }
  if (epoch !== undefined && cached.projectSnapshotComplete === true) {
    if (cached.deliveryEpoch !== epoch) {
      // The pass's first delivery. The generation was settled against an
      // earlier pass, so prove the whole of it once — every input the envelope
      // declares, the directory membership, the universal host inputs, and the
      // out-of-walk snapshot — before any of this pass's deliveries may be
      // settled against it. That proof is what a per-pass recompile used to buy
      // (samchon/ttsc#1300), at a walk instead of a compile.
      refreshFilesystemClockReference(
        TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
        resultFilesystem(cached.result),
      );
      if (!matchesCompleteInputSnapshot(cached)) {
        return false;
      }
      cached.deliveryEpoch = epoch;
      cached.servedFiles?.clear();
      return true;
    }
    if (!cached.servedFiles?.has(identity)) {
      return true;
    }
  }
  refreshFilesystemClockReference(
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.get(cached),
    resultFilesystem(cached.result),
  );
  if (
    cached.result.type !== "exception" &&
    cached.result.graph !== undefined &&
    cached.projectSnapshotComplete === true &&
    cached.projectDirectories !== undefined &&
    cached.projectMutationTracker !== undefined &&
    cached.hostInputMutationTracker !== undefined
  ) {
    const narrow = matchesNarrowPersistentInputs(cached, file);
    if (narrow !== undefined) {
      return narrow;
    }
    // Notifications stopped proving membership after this generation was
    // produced. Losing the proof is not evidence of a change, so fall through
    // to the snapshot the entry still carries.
  }
  return matchesCompleteInputSnapshot(cached);
}
