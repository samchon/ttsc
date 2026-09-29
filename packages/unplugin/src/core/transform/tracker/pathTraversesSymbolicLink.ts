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
 * @evidence contracts/common.md#principled-implementation
 *   Lexical lstat detects components whose retargeting escapes the watched
 *   physical target; the watched root itself is verified by native identity.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One ancestor walk separates component-link risk from root replacement;
 *   tracker construction owns the memo and watched-root choice.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Linked components stay on metadata validation instead of being certified
 *   from quiet old targets; workspace-root aliases are not blanket exclusions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs and the root parameter explain the boundary distinction
 *   and memo reason under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral code uses injected lstat and the view's explicit path grammar;
 *   native symbolic
 *   links and junctions are observations, not OS-wide casing assumptions.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Ancestor work is linear in newly inspected components; memoized suffixes
 *   avoid repeated traversal for inputs sharing ancestors.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The generation constructor shares component verdicts under its watched-root
 *   boundary: internal inputs share one root, while existing external inputs
 *   stop at their parent and missing external inputs stop at the existing ancestor.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The constructor owns the generation-local memo; this helper owns only its
 *   temporary visited array and acquires no handle or persistent cache.
 */
export function pathTraversesSymbolicLink(
  input: string,
  filesystem: TtscTransformFilesystemOperations,
  memo: Map<string, boolean>,
  root?: string,
): boolean {
  const paths =
    (filesystem.platform ?? process.platform) === "win32"
      ? path.win32
      : path.posix;
  const visited: string[] = [];
  let current = paths.dirname(paths.resolve(input));
  const stop =
    root !== undefined &&
    pathIsWithin(current, paths.resolve(root), filesystem.platform)
      ? paths.resolve(root)
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
    const parent = paths.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const directory of visited) memo.set(directory, linked);
  return linked;
}
