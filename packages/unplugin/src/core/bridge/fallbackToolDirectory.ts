import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";
import { fallbackRecordStorage } from "./fallbackRecordStorage";
import { fallbackToolDirectoryLocation } from "./fallbackToolDirectoryLocation";

/**
 * Where a host's project records live when its own tool directory
 * (`hostToolDirectory`) cannot be written, or `undefined` when private native
 * storage is unavailable (samchon/ttsc#1480).
 *
 * A module handed to a build host without its project's record depends on its
 * own bytes alone: a watching session cannot tell the host that a type the
 * module's output consulted changed, and a persistent cache restores it
 * whatever its types did. A read-only checkout, a restricted sandbox, or a file
 * occupying an ignored cache path can leave the root unwritable, so the record
 * then lives below this user's own directory under the system temporary
 * directory (`userStateDirectory`), one directory per host root.
 *
 * The place is the same for a host root in every process, since a persistent
 * cache that recorded a record's path must find it at its next start, and the
 * build start's proof and a watching session's bridge look there as well as
 * below the root. It is spelled in its long form, which webpack and Rspack
 * require of a watched directory on Windows. A host that accepts no record
 * outside its root, Turbopack, or none it cannot relate to its root, Farm on
 * another drive, does not take it (`hostToolDirectory`). The returned spelling
 * has passed the private storage probe.
 *
 * @param root The host's root, as `hostToolDirectory` names it.
 * @evidence contracts/common.md#principled-implementation
 *   A stable directory under private native state is returned only after probing
 *   its managed ancestry and available access.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The location helper owns naming and the shared storage probe owns qualification.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fallback handles actual unwritable roots using a product-owned user
 *   directory, not an arbitrary globally writable or fixture-specific location.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain stable paths, Windows long spelling and hosts
 *   that cannot accept the fallback, following documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation The validated user state boundary obtains a private native directory and long Windows spelling; native root resolution determines naming, while adapters separately reject fallback locations their host cannot watch.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A stable name lookup precedes a bounded native path and permission walk.
 * @evidence contracts/performance.md#reuse-equivalent-work The naming helper reuses a cached address while the qualification observes current storage on every call.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The probe retains no observation or native handle; the naming helper owns its address memo.
 */
export function fallbackToolDirectory(root: string): string | undefined {
  const directory = fallbackToolDirectoryLocation(root);
  return directory !== undefined &&
    fallbackRecordStorage(
      path.join(directory, PROJECT_RECORD_DIRECTORY),
      false,
    ) === true
    ? directory
    : undefined;
}
