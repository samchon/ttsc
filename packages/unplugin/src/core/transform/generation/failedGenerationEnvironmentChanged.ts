import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import { refreshProcessClockReference } from "../clock/refreshProcessClockReference";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import { pluginSourceState } from "../inputs/pluginSourceState";
import { usesPreparedPluginBuildEnvironments } from "../inputs/preparePluginBuildEnvironments";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { hashText } from "../utils/hashText";
import { MISSING_INPUT_STATE } from "../validation/MISSING_INPUT_STATE";
import { sameHashes } from "../validation/sameHashes";
import { sameProjectDirectories } from "../validation/sameProjectDirectories";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";
import { TERMINAL_ENVIRONMENT_VERDICTS } from "./TERMINAL_ENVIRONMENT_VERDICTS";
import type { TtscFailedGenerationValidation } from "./TtscFailedGenerationValidation";
import { failedGenerationInputState } from "./failedGenerationInputState";
import { projectWalkFailureFingerprint } from "./projectWalkFailureFingerprint";

/**
 * Whether a terminal proof failure's observed environment actually changed.
 *
 * This is deliberately a confirmation test: inability to re-probe retains the
 * old verdict instead of turning every module request into another compile.
 * Cache lifecycle reset remains the unconditional recovery boundary.
 *
 * The delivered module's own text is checked on every delivery. The rest of the
 * environment, the project walk and every recorded input outside it, is
 * confirmed once per event-loop turn and shared by that turn's deliveries, and
 * it is proven by metadata first, as live validation does: a file or input
 * whose separable signature still matches carries its recorded state and is not
 * read again (samchon/ttsc#1398). Separable means against a clock reference the
 * confirmation mints itself before it reads, as a delivery does, so a write a
 * clock rollback put into a recorded stamp's tick is read. The generation's own
 * probe directory was released with it, so the reference is minted in the probe
 * directory this process keeps (`refreshProcessClockReference`).
 *
 * A write made in the same turn as a confirmation is seen from the next turn
 * on. Every host delivers a changed module from a later turn, after its own
 * watcher has reported the change.
 *
 * @evidence contracts/common.md#principled-implementation Delivered-source divergence is checked against disk before reuse, and terminal retry requires a changed project/failure fingerprint or exact/tree input state; failed re-probing conservatively preserves the existing verdict.
 * @evidence contracts/common.md#clear-and-simple-design The exported boundary handles per-delivery text and turn-shared coordination, while its private environment comparator owns walk and out-of-walk revalidation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A text-only upstream rewrite does not replace the compiler's disk baseline, and probe failure is not treated as a fabricated change that would repeatedly compile unchanged failed state.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain confirmation rather than successful-generation proof, current-turn sharing, clock separation and next-turn freshness limitations, with props and tags visibly separated.
 * @evidence contracts/portability.md#os-neutral-implementation Filesystem identity and metadata separation use the supplied host operations and process clock reference; plugin tree state uses the same native build environment composition that keyed its binary.
 * @evidence contracts/performance.md#efficient-algorithms Each delivery hashes its own supplied text; the first uncached verdict per turn walks the project and uses separable matching metadata to avoid unnecessary exact-input state reads.
 * @evidence contracts/performance.md#reuse-equivalent-work One WeakMap verdict per validation object is shared only through the current event-loop turn and removed by setImmediate; delivered-source checks remain outside that shared verdict.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Weak keys do not independently retain old terminal baselines, scheduled eviction releases each turn's verdict and the shared process-clock owner controls the retained probe lifecycle.
 */
export function failedGenerationEnvironmentChanged(
  validation: TtscFailedGenerationValidation,
  props: {
    /** Native source path requested by this delivery. */
    currentFile: string;

    /** Host-supplied text checked separately from the turn-shared environment. */
    currentSource: string;

    /** Same host filesystem boundary that observed the cached generation. */
    filesystem: TtscTransformFilesystemOperations;
  },
): boolean {
  try {
    const identities = envelopeDerivation(validation.cached).identityContext;
    const currentSourceHash = hashText(props.currentSource);
    const expectedSourceHash =
      validation.cached.sourceHashes?.[
        pathIdentityKey(props.currentFile, identities)
      ];
    // A delivered text that differs from the file changes nothing while the
    // disk still holds the bytes the compile read (samchon/ttsc#1394).
    if (
      expectedSourceHash !== undefined &&
      expectedSourceHash !== currentSourceHash &&
      hostInputStateHash(props.currentFile, props.filesystem) !==
        expectedSourceHash
    ) {
      return true;
    }
    const shared = TERMINAL_ENVIRONMENT_VERDICTS.get(validation);
    if (shared !== undefined) return shared;
    const verdict = environmentChanged(validation, props.filesystem);
    TERMINAL_ENVIRONMENT_VERDICTS.set(validation, verdict);
    setImmediate(() => TERMINAL_ENVIRONMENT_VERDICTS.delete(validation));
    return verdict;
  } catch {
    return false;
  }
}

/**
 * Confirm the project walk and every recorded input outside it. A plugin tree
 * always validates its full source/build state before ordinary-path metadata
 * reuse is considered, because parent metadata cannot prove descendant state.
 */
function environmentChanged(
  validation: TtscFailedGenerationValidation,
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  refreshProcessClockReference(validation.cached.projectRoot, filesystem);
  const identities = envelopeDerivation(validation.cached).identityContext;
  const current = collectProjectInputSnapshot(
    validation.cached.projectRoot,
    identities,
    filesystem,
    {
      hashes: validation.projectInputHashes,
      signatures: validation.cached.inputSignatures ?? {},
    },
    { policy: validation.cached.membershipPolicy },
  );
  if (
    validation.projectWalkComplete !==
      walkSnapshotComplete(current, validation.declaredInputs) ||
    validation.projectWalkFailures !==
      projectWalkFailureFingerprint(
        current,
        validation.declaredInputs,
        validation.cached.projectRoot,
        identities,
      ) ||
    !sameHashes(
      validation.projectInputHashes,
      current.hashes,
      validation.declaredInputs,
    ) ||
    !sameProjectDirectories(
      validation.cached.projectDirectories ?? [],
      current.projectDirectories,
    )
  ) {
    return true;
  }
  for (const [input, recorded] of validation.inputStates) {
    if (recorded.tree) {
      // A plugin source that could not be read then moved once it can be.
      // The async delivery owner prepares native authority before confirmation.
      const prepared = usesPreparedPluginBuildEnvironments(validation.cached.result)
        ? { environment: PluginBuildEnvironmentReadings.cached(input) }
        : undefined;
      if (
        recorded.state === MISSING_INPUT_STATE
          ? pluginSourceState(input, prepared) !== null
          : !pluginSourceHolds(input, recorded.state, filesystem, prepared)
      )
        return true;
      continue;
    }
    const evidence = inputMetadataEvidence(input, filesystem);
    if (
      recorded.signature !== undefined &&
      evidence?.separable === true &&
      evidence.signature === recorded.signature
    ) {
      continue;
    }
    if (failedGenerationInputState(input, filesystem) !== recorded.state)
      return true;
  }
  return false;
}
