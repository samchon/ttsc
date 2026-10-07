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
import { nativeInputPredicatesHold } from "./nativeInputPredicatesHold";
import { notificationsProveProgramUnchanged } from "./notificationsProveProgramUnchanged";

/**
 * Validate a cached project transform against the current on-disk project
 * state.
 *
 * A module with a recorded source compares its delivered text with the
 * generation snapshot. An unrelated module outside an unchanged program needs
 * no source comparison. A cache with a delivery epoch can use that comparison
 * alone for a stable generation's first delivery of each module in the current
 * pass, once the pass's own first delivery has proven the whole generation
 * still matches the filesystem. An incomplete generation may not take this
 * shortcut: otherwise a sibling output captured during a filesystem race could
 * still be served once. Later graph-bearing requests validate the file's
 * derived input set and project membership. A failed result is a diagnostic of
 * the whole loaded program, so its repair cannot be proved by one delivered
 * output's dependency closure. Failed and graph-free envelopes conservatively
 * validate the complete project and out-of-walk snapshots, reusing qualified
 * signatures. A mismatch rejects this generation for the delivery; its caller
 * chooses replacement or capture. Delivered text that differs while the disk
 * still holds the bytes the generation compiled is not one: it is reported and
 * served, since the compile read the disk (samchon/ttsc#1394).
 *
 * Its place in the adapter's invalidation model, and the units beside it, are
 * mapped in the maintainer page
 * `website/src/content/docs/development/reference/unplugin-invalidation.mdx`.
 *
 * @evidence contracts/common.md#principled-implementation Delivered source, generation completeness, pass identity and notification authority choose between first-delivery proof, derived-input validation and complete snapshots; divergent editor text never substitutes for compiler disk inputs.
 * @evidence contracts/common.md#clear-and-simple-design This admission boundary chooses the required proof while dedicated validators own membership, universal inputs and content comparisons.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An incomplete generation cannot earn a first-delivery shortcut; inherited object members cannot invent a project baseline, and losing watcher proof falls back to recorded-state validation.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain disk-versus-delivered authority, epoch qualification, fallback and related maintainer guidance before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Project membership and path identity use recorded compiler case policy and injected native operations; OS names do not certify case sensitivity or watcher capabilities.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Epoch updates clear the generation's served checkpoint Set; the delivery
 *   marker owns insertion and its unique-identity/text growth. Lazy output and
 *   native identity indexes follow the generation's output/path population,
 *   while validators replace current signature/directory witnesses. No new
 *   independent handle or historical epoch collection is acquired here.
 * @evidence contracts/performance.md#efficient-algorithms Every admission first replays all generation-owned typed config predicates; this mandatory cost includes native queries, file bytes or directory membership independently of watcher/epoch qualification.
 *   Fresh-only rejection precedes native identity work. Baseline-bearing paths
 *   hash delivered text and divergent paths read/hash host bytes; unrelated
 *   absent outputs can return before that hash after an initial K-output index.
 *   Epoch-qualified first checkpoints share the complete proof. Other paths
 *   pay derived-input or complete project/external/universal proof costs,
 *   including path/byte populations, native observations and clock refresh.
 * @evidence contracts/performance.md#reuse-equivalent-work Typed config predicate replay is not cached by this coordinator and remains mandatory even when the following existing shortcut shares other proof.  A complete generation earns one whole-snapshot proof per new delivery epoch; later first deliveries share it, while repeated or persistent deliveries revalidate their authoritative dependency scope.
 */
export function matchesCachedSource(
  /** Generation retaining recorded baselines and distinct proof authority. */
  cached: TtscCachedProjectTransform,
  /** Actual filesystem address whose identity and program role are tested. */
  file: string,
  /** Delivered text, compared with the recorded baseline rather than adopted. */
  source: string,
  /** Current host pass, or undefined for persistent input validation. */
  epoch: number | undefined,
): boolean {
  if (!nativeInputPredicatesHold(cached)) return false;
  if (cached.freshDeliveryOnly === true) return false;
  const identities = envelopeDerivation(cached).identityContext;
  const currentKey = toProjectKey(cached.projectRoot, file, identities);
  const identity = pathIdentityKey(file, identities);
  const expected =
    cached.sourceHashes?.[identity] ??
    (Object.prototype.hasOwnProperty.call(cached.inputHashes, currentKey)
      ? cached.inputHashes[currentKey]
      : undefined) ??
    cached.externalInputHashes?.[identity];
  if (
    expected === undefined &&
    cached.result.type === "success" &&
    !matchesProjectRootFile(
      file,
      cached.membershipPolicy,
      false,
      resultFilesystem(cached.result).platform,
    )
  ) {
    const state = envelopeDerivation(cached);
    const outputs = (state.outputIndex ??= createEnvelopeKeyIndex(
      state,
      cached.projectRoot,
      Object.fromEntries(
        Object.keys(cached.result.typescript).map((entry) => [entry, entry]),
      ),
    ));
    if (!outputs.has(identity)) {
      // While the watchers prove the program unchanged, the module is still
      // outside it, and no walk is needed to say so (samchon/ttsc#1398).
      if (notificationsProveProgramUnchanged(cached)) {
        return true;
      }
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
    cached.result.type === "success" &&
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
