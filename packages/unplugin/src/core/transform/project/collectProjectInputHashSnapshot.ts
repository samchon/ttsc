import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import type { TtscProjectInputHashSnapshot } from "./TtscProjectInputHashSnapshot";
import { collectProjectInputSnapshot } from "./collectProjectInputSnapshot";

/**
 * Hash the project walk and retain whether every attempted directory and file
 * was observed coherently. Cache-key hosts must reject an incomplete set.
 *
 * @evidence contracts/common.md#principled-implementation File-read and directory-enumeration completeness are jointly required before the hashes represent a reusable snapshot.
 * @evidence contracts/common.md#clear-and-simple-design The wrapper projects the detailed snapshot into the hash-plus-completeness shape needed by cache-key consumers rather than implementing another walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A readable subset cannot count as a complete program when enumeration or attribution failed.
 * @evidence contracts/common.md#meaningful-documentation The native comment explicitly requires cache-key hosts to reject incomplete observations, distinguishing this API from the hash-only convenience wrapper.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Delegates to collectProjectInputSnapshot, which reads through the supplied filesystem and identity context; this wrapper only reports completeness.
 */
export function collectProjectInputHashSnapshot(
  projectRoot: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy?: ITtscProjectMembershipPolicy,
): TtscProjectInputHashSnapshot {
  const snapshot = collectProjectInputSnapshot(
    projectRoot,
    identities,
    filesystem,
    undefined,
    {
      policy,
    },
  );
  return {
    complete: snapshot.complete && snapshot.directoryComplete,
    hashes: snapshot.hashes,
  };
}
