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
 *
 * @evidence contracts/common.md#principled-implementation Identity resolution uses the same lstat, listings, realpath, platform, and directory-case view as generation capture and validation, keeping equivalence within one observed filesystem.
 * @evidence contracts/common.md#clear-and-simple-design The adapter supplies the shared resolver's existing capability interface rather than implementing another realpath or case-folding algorithm.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed realpath retains lexical spelling rather than fabricating physical identity, and no foreign filesystem methods are replaced.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains filesystem-view consistency and conservative failure semantics before the operation table wiring.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral identity follows actual directory case capability and native aliases through the supplied view, without assuming all Windows directories insensitive or all POSIX volumes sensitive.
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
