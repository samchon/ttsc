import path from "node:path";

import { fallbackToolDirectory } from "../bridge/fallbackToolDirectory";

/**
 * The fallback tool directory Farm accepts for a root, or `undefined` when it
 * accepts none (samchon/ttsc#1480).
 *
 * Farm computes every watch file's path relative to its root and fails on one
 * it cannot relate, such as a file on another Windows drive, and its watcher
 * refuses an extra file below any `node_modules` (`hostToolDirectory`). The
 * fallback below this user's validated state directory (`fallbackToolDirectory`)
 * qualifies where it shares the root's drive and lies below no `node_modules`,
 * and Farm's records live below the root alone otherwise.
 *
 * @param root Farm's configured root.
 *
 * @evidence contracts/common.md#principled-implementation A fallback is usable only when native relative-path semantics relate it to the Farm root and none of its path components is node_modules, matching the host's watch-file restrictions.
 * @evidence contracts/common.md#clear-and-simple-design The adapter filters the shared user-state fallback provider with two host restrictions instead of creating another record location policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No drive letter or user directory is hardcoded; rejection follows the host's actual path and watcher capabilities.
 * @evidence contracts/common.md#meaningful-documentation The native comment names both host restrictions and explains why the root's own directory remains the alternative.
 * @evidence contracts/portability.md#os-neutral-implementation Containment is decided with path.relative and path.isAbsolute, so a fallback on another Windows drive is refused without comparing drive letters, and node_modules is found as a path segment split on the platform's separator.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Native relative/isAbsolute processing follows root/fallback text, then
 *   split/includes scans its path components and allocates their array. Cold
 *   fallback naming additionally retains native user-state trust setup and
 *   root hashing; a cached name does not certify current writability.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Filters one current root/fallback pair. Naming reuse belongs to the shared
 *   fallback provider; host acceptance and writer capability are separate checks.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function farmRecordFallback(root: string): string | undefined {
  const fallback = fallbackToolDirectory(root);
  if (fallback === undefined) return undefined;
  if (path.isAbsolute(path.relative(root, fallback))) return undefined;
  return fallback.split(path.sep).includes("node_modules")
    ? undefined
    : fallback;
}
