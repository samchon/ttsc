import type path from "node:path";

import type { TtscProjectTreeDiscoveryFilesystem } from "./TtscProjectTreeDiscoveryFilesystem";
import { canonicalProjectPath } from "./canonicalProjectPath";

/**
 * Resolve the physical identity of one directory reached by project-tree
 * discovery, or `undefined` when the filesystem view cannot resolve it.
 *
 * The identity is what makes linked traversal cycle-safe: a junction or symlink
 * back to an ancestor has the same physical identity as that ancestor. An
 * unresolvable identity is reported as absent rather than guessed, so the
 * caller can mark the traversal incomplete instead of claiming a full project
 * map.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The filesystem's realpath supplies physical spelling for the branch cycle
 *   guard; unresolvable identity returns undefined instead of a guessed target.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This operation separates physical observation from lexical traversal and
 *   delegates volume-root key formatting to canonicalProjectPath.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The supplied realpath operation observes actual directory identity under
 *   its filesystem view. The selected path API normalizes native root syntax
 *   without folding child names by OS default.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No native name case is inferred from the OS and missing identity does not
 *   authorize traversal through an unproven link cycle.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the cycle guard and absence consequence, giving the
 *   reason for the undefined result without claiming successful enumeration.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function projectDirectoryIdentity(
  directory: string,
  filesystem: TtscProjectTreeDiscoveryFilesystem,
  paths: typeof path.posix | typeof path.win32,
): string | undefined {
  if (filesystem.realpath === undefined) return undefined;
  try {
    return canonicalProjectPath(
      paths.resolve(filesystem.realpath(directory)),
      filesystem.platform,
    );
  } catch {
    return undefined;
  }
}
