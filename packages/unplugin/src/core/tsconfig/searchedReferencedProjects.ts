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
 *
 * @evidence contracts/common.md#principled-implementation
 *   Depth-first declaration-order traversal with a visited set returns each
 *   reachable config once while excluding the starting solution itself.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The operation collects the reference order; entry reading and content-valid
 *   memoization remain with readProjectSelectionEntry.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native path.resolve normalizes referenced addresses; lexical spelling is
 *   retained and no platform-wide case folding collapses distinct configs.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It derives alternatives from real references instead of guessing conventional
 *   project filenames or recommending an include that changes solution ownership.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains order, root exclusion and why diagnostics must name
 *   the referenced projects rather than instructing users to alter the solution.
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
