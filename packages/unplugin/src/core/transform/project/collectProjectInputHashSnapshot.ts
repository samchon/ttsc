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
