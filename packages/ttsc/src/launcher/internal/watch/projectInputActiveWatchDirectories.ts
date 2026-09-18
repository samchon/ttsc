import path from "node:path";

import { createProjectInputPathIdentityContext } from "../../../internal/pathIdentity/createProjectInputPathIdentityContext";

/**
 * Removes recursive roots already covered by an ancestor without rewriting the
 * declaration-specific roots retained by WatchTopology.
 */
export function projectInputActiveWatchDirectories(
  directories: Iterable<string>,
  identities = createProjectInputPathIdentityContext(),
): string[] {
  const unique = new Map<string, string>();
  for (const directory of directories) {
    // Coverage is decided on physical identity so two spellings of one
    // directory cannot both survive, but the surviving entry keeps the
    // caller's spelling: this function selects roots, it does not rename them.
    const identity = identities.resolve(directory);
    if (!unique.has(identity.key)) unique.set(identity.key, directory);
  }
  return [...unique]
    .filter(([key]) => {
      let ancestor = path.dirname(key);
      while (ancestor !== key) {
        if (unique.has(ancestor)) return false;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) break;
        ancestor = parent;
      }
      return true;
    })
    .map(([, directory]) => directory);
}
