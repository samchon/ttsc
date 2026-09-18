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
