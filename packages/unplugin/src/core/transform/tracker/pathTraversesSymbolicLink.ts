import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pathIsWithin } from "../filesystem/pathIsWithin";

/**
 * Whether a lexical component between an input and the directory watched for it
 * is a symbolic link or junction.
 *
 * A recursive observer follows the component to its current physical target.
 * Retargeting it can therefore move the input without producing an event on the
 * old target. Keep those spellings on metadata/realpath validation. The memo
 * makes this one lstat per distinct directory component for the generation,
 * rather than one walk per graph input.
 *
 * The watched directory itself and its ancestors are not components of this
 * kind: a delivery re-checks the watched directory's identity before it reads
 * the tracker (`verifyLocations`), so retargeting a link at or above it
 * withdraws the tracker rather than moving an input silently. Every macOS
 * temporary directory lies below such a link (`/var/…` to `/private/var/…`),
 * and a linked workspace is one anywhere; examined all the way up, no input of
 * such a project was ever covered, and every delivery proved each of them by
 * reading (samchon/ttsc#1459).
 *
 * @param root The watched directory the input lies below, when it does; the
 *   walk stops before it. Absent, or with an input outside it, every component
 *   up to the volume root is examined.
 */
export function pathTraversesSymbolicLink(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
  memo: Map<string, boolean>,
  root?: string,
): boolean {
  const visited: string[] = [];
  let current = path.dirname(path.resolve(input));
  const stop =
    root !== undefined && pathIsWithin(current, path.resolve(root))
      ? path.resolve(root)
      : undefined;
  let linked = false;
  for (;;) {
    if (current === stop) break;
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
