import fs from "node:fs";

import { resolveRealPath } from "./resolveRealPath";

/**
 * Obtain a native realpath spelling for the project-root aliases.
 *
 * Native realpath expands Windows short names; an unavailable native result
 * delegates to the regular best-effort resolver. If both observations fail,
 * the input spelling survives; no returned string certifies how a watcher
 * will name later events or their child paths.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node's native realpath supplies an observed root alias; the
 *   regular resolver supplies an explicit best-effort fallback.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This helper owns the native-versus-regular choice; rootSpellings owns how
 *   those representations are applied without following child links.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native realpath supplies actual physical spelling and Windows short-name
 *   expansion; the supported regular resolver is the explicit fallback when
 *   that native observation is unavailable.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The fallback does not fabricate an expanded path or patch watcher methods.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Separate paragraphs state the watcher purpose, short-name distinction and
 *   fallback rather than equating every returned spelling with native proof.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One native realpath attempt precedes a regular attempt only on failure.
 *   Both retain native component/link traversal and path-text cost; the wrapper
 *   adds no tree scan or collection, and total failure returns the input.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This one-location observation coordinates no cross-request work. Policy
 *   and selection readers own their observation transaction and invalidation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function resolveNativeRootPath(location: string): string {
  try {
    return fs.realpathSync.native(location);
  } catch {
    return resolveRealPath(location);
  }
}
