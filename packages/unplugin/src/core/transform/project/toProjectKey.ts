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
 * within the compiler's path protocol. Literal backslashes are interpreted as
 * separators by that protocol rather than encoded as POSIX filename characters.
 *
 * @evidence contracts/common.md#principled-implementation The supplied native identity context decides containment and address equivalence; inside-root identities become relative keys while outside-root identities retain their full address.
 * @evidence contracts/common.md#clear-and-simple-design The operation separates native identity from slash protocol encoding and delegates each to its existing helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native case and link policy are not replaced with a universal lowercase rule or substring-only containment.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies both key namespaces and explains why equivalent spellings share a key under the filesystem's actual identity policy.
 * @evidence contracts/portability.md#os-neutral-implementation The existing filesystem identity context owns directory case capabilities, links and root containment; forward slashes are applied only to the compiler hash-key protocol after native identity is established.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Root and file identity plus containment share one resolver transaction;
 *   memoized identities avoid repeated native observations inside isWithin.
 *   Normalization and key slicing scale with their path spelling lengths.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A supplied identity context shares its path and case observations within
 *   the caller's filesystem transaction. An omitted context is fresh, so
 *   unrelated generations do not inherit historical native answers.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A supplied transaction remains caller-owned. The default context is
 *   local to this call and is released on return or throw, with entries driven
 *   by these two paths and their observed ancestors rather than project history.
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
