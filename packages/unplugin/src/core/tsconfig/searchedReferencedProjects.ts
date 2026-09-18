import path from "node:path";

import { readProjectSelectionEntry } from "./readProjectSelectionEntry";

/**
 * Every project reachable through a config's `references`, in the order
 * default-project selection searches them, excluding the config itself
 * (samchon/ttsc#1397).
 *
 * The out-of-program report names them, so a module left untransformed in a
 * solution layout is not told to join the solution config, where adding an
 * `include` would break the `tsc -b` graph the layout exists for.
 */
export function searchedReferencedProjects(tsconfig: string): string[] {
  const root = path.resolve(tsconfig);
  const visited = new Set<string>([root]);
  const output: string[] = [];
  const visit = (config: string): void => {
    for (const reference of readProjectSelectionEntry(config).references) {
      const key = path.resolve(reference);
      if (visited.has(key)) continue;
      visited.add(key);
      output.push(key);
      visit(key);
    }
  };
  visit(root);
  return output;
}
