import type { FilesystemPathIdentityContext } from "ttsc/path-identity";

import { createHostPathIdentityContext } from "./createHostPathIdentityContext";

/**
 * Build a comparison key for a path without changing the spelling handed to a
 * filesystem or bundler. Windows is case-insensitive; macOS is probed per
 * existing filesystem location so case-sensitive volumes keep distinct paths.
 */
export function pathIdentityKey(
  file: string,
  identities: FilesystemPathIdentityContext = createHostPathIdentityContext(),
): string {
  return identities.resolve(file).key;
}
