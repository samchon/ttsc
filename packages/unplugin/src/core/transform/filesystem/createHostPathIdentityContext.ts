import {
  type FilesystemPathIdentityContext,
  createFilesystemPathIdentityContext,
} from "ttsc/path-identity";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "./DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "./TtscTransformFilesystemOperations";

/**
 * Create the path-identity resolver for one filesystem view.
 *
 * Identity decides when two spellings name one file: case folding on
 * case-insensitive volumes, and physical targets behind links. It must be
 * answered by the same operations that capture and validate a generation, so
 * the resolver is built from them, and realpath failures resolve to the lexical
 * spelling instead of throwing.
 */
export function createHostPathIdentityContext(
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): FilesystemPathIdentityContext {
  return createFilesystemPathIdentityContext({
    caseSensitive: filesystem.caseSensitive,
    lstat: filesystem.lstat,
    platform: filesystem.platform,
    readdir: (directory) =>
      filesystem.readdir(directory).map((entry) => entry.name),
    realpath: filesystem.realpath,
    throwOnRealpathError: false,
  });
}
