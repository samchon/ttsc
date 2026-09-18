import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * Whether any lexical component above an input is a symbolic link or junction.
 *
 * A recursive observer follows the component to its current physical target.
 * Retargeting it can therefore move the input without producing an event on the
 * old target. Keep those spellings on metadata/realpath validation. The memo
 * makes this one lstat per distinct directory component for the generation,
 * rather than one walk per graph input.
 */
export function pathTraversesSymbolicLink(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
  memo: Map<string, boolean>,
): boolean {
  const visited: string[] = [];
  let current = path.dirname(path.resolve(input));
  let linked = false;
  for (;;) {
    const known = memo.get(current);
    if (known !== undefined) {
      linked = known;
      break;
    }
    visited.push(current);
    try {
      if (filesystem.lstat(current).isSymbolicLink()) {
        linked = true;
        break;
      }
    } catch {
      // A missing component is not a link. Its nearest existing ancestor will
      // still be inspected before the walk reaches the volume root.
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const directory of visited) memo.set(directory, linked);
  return linked;
}
