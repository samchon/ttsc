import { refreshScratchClockReference } from "../clock/refreshScratchClockReference";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { hostInputStateHash } from "../inputs/hostInputStateHash";
import { inputMetadataEvidence } from "../inputs/inputMetadataEvidence";
import { pluginSourceHolds } from "../inputs/pluginSourceHolds";
import { pluginSourceState } from "../inputs/pluginSourceState";
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
 * probe directory was released with it, so the reference is minted in scratch
 * storage outside the project (`refreshScratchClockReference`).
 *
 * A write made in the same turn as a confirmation is seen from the next turn
 * on. Every host delivers a changed module from a later turn, after its own
 * watcher has reported the change.
 */
export function failedGenerationEnvironmentChanged(
  validation: TtscFailedGenerationValidation,
  props: {
    currentFile: string;
    currentSource: string;
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

/** Confirm the project walk and every recorded input outside it. */
function environmentChanged(
  validation: TtscFailedGenerationValidation,
  filesystem: TtscTransformFilesystemOperations,
): boolean {
  refreshScratchClockReference(validation.cached.projectRoot, filesystem);
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
    const evidence = inputMetadataEvidence(input, filesystem);
    if (
      recorded.signature !== undefined &&
      evidence?.separable === true &&
      evidence.signature === recorded.signature
    ) {
      continue;
    }
    if (recorded.tree) {
      // A plugin source that could not be read then moved once it can be.
      if (
        recorded.state === MISSING_INPUT_STATE
          ? pluginSourceState(input) !== null
          : !pluginSourceHolds(input, recorded.state, filesystem)
      )
        return true;
      continue;
    }
    if (failedGenerationInputState(input, filesystem) !== recorded.state)
      return true;
  }
  return false;
}
