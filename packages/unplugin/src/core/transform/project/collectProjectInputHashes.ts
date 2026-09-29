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
 *
 * This convenience view discards completeness. A consumer deciding reuse must
 * use `collectProjectInputHashSnapshot` and check its flag instead.
 *
 * @evidence contracts/common.md#principled-implementation The helper projects the shared project snapshot's hashes without changing enumeration semantics; this hash-only result deliberately does not certify completeness.
 * @evidence contracts/common.md#clear-and-simple-design One delegated call exposes the convenience view while the richer snapshot API retains the evidence required for reuse decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No separate traversal or fabricated marker hides errors; callers needing coherent proof are explicitly directed to the completeness-bearing API.
 * @evidence contracts/common.md#meaningful-documentation Native prose names the shared walk and warns that this projection drops completeness, so its return type cannot be mistaken for a reuse certificate.
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
