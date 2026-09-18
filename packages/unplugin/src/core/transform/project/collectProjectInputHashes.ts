import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { collectProjectInputHashSnapshot } from "./collectProjectInputHashSnapshot";

/**
 * Hash every input file under `projectRoot` (the same walk universe
 * `matchesCachedSource` validates against), keyed by project-relative slash
 * path. Exported so hosts without a per-build boundary (`@ttsc/metro`) can fold
 * the identical input universe into their own cache fingerprints.
 */
export function collectProjectInputHashes(
  projectRoot: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
  policy?: ITtscProjectMembershipPolicy,
): Record<string, string> {
  return collectProjectInputHashSnapshot(
    projectRoot,
    identities,
    filesystem,
    policy,
  ).hashes;
}
