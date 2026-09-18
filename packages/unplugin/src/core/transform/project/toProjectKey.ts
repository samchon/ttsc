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
