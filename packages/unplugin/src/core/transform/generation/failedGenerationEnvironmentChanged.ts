import { envelopeDerivation } from "../envelope/envelopeDerivation";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { hashText } from "../utils/hashText";
import { sameHashes } from "../validation/sameHashes";
import { sameProjectDirectories } from "../validation/sameProjectDirectories";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";
import type { TtscFailedGenerationValidation } from "./TtscFailedGenerationValidation";
import { failedGenerationInputState } from "./failedGenerationInputState";
import { projectWalkFailureFingerprint } from "./projectWalkFailureFingerprint";

/**
 * Whether a terminal proof failure's observed environment actually changed.
 *
 * This is deliberately a confirmation test: inability to re-probe retains the
 * old verdict instead of turning every module request into another compile.
 * Cache lifecycle reset remains the unconditional recovery boundary.
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
    if (
      expectedSourceHash !== undefined &&
      expectedSourceHash !== currentSourceHash
    ) {
      return true;
    }
    const current = collectProjectInputSnapshot(
      validation.cached.projectRoot,
      identities,
      props.filesystem,
      undefined,
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
      if (failedGenerationInputState(input, props.filesystem) !== recorded) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
