import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { normalizePath } from "../filesystem/normalizePath";
import { pathIdentityKey } from "../filesystem/pathIdentityKey";

/**
 * Return the key a file is recorded under in a generation's project hashes.
 *
 * Inside the project root the key is the root-relative path. Outside it, the
 * key is the file's full identity. Both use forward slashes and the
 * filesystem's identity rules, so two spellings of one file map to one key
 * while two distinct files never share one.
 *
 * @evidence contracts/common.md#principled-implementation The supplied native identity context decides containment and address equivalence; inside-root identities become relative keys while outside-root identities retain their full address.
 * @evidence contracts/common.md#clear-and-simple-design The operation separates native identity from slash protocol encoding and delegates each to its existing helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native case and link policy are not replaced with a universal lowercase rule or substring-only containment.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies both key namespaces and explains why equivalent spellings share a key under the filesystem's actual identity policy.
 * @evidence contracts/portability.md#os-neutral-implementation The existing filesystem identity context owns directory case capabilities, links and root containment; forward slashes are applied only to the compiler hash-key protocol after native identity is established.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function toProjectKey(
  root: string,
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  const rootKey = pathIdentityKey(root, identities);
  const fileKey = pathIdentityKey(file, identities);
  if (!identities.isWithin(root, file)) {
    return normalizePath(fileKey);
  }
  return normalizePath(fileKey.slice(rootKey.length).replace(/^[/\\]+/, ""));
}
