import path from "node:path";

import type { ILinkedPluginProject } from "./ILinkedPluginProject";

/** Report whether the derived inputs contain the type-only sibling. */
export function watchesTypeSibling(
  watched: readonly string[],
  project: ILinkedPluginProject,
): boolean {
  return watched.includes(path.resolve(project.types));
}
