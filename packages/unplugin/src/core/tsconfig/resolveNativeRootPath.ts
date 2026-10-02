import fs from "node:fs";

import { resolveRealPath } from "./resolveRealPath";

/**
 * Resolve the physical root spelling native watchers report.
 *
 * Native realpath expands Windows short names; an unavailable native result
 * delegates to the regular best-effort resolver.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node's native realpath gives watcher-compatible physical spelling; the
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
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
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
