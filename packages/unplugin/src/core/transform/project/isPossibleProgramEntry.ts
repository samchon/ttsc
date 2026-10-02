import type fs from "node:fs";

import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";
import { isPossibleProgramFileName } from "./isPossibleProgramFileName";

/**
 * Whether this entry could enter the program, and so whether its appearance or
 * removal is a membership change.
 *
 * A directory always could, since it can hold sources. A file could only if it
 * carries an extension the resolved configuration admits, which is what makes a
 * bundle emitted beside the sources invisible to a project that compiles no
 * JavaScript.
 *
 * @evidence contracts/common.md#principled-implementation Regular files use admitted extensions; non-file entries remain conservatively possible because topology can expose future source inputs.
 * @evidence contracts/common.md#clear-and-simple-design The Dirent wrapper delegates filename policy to the single helper also used by callers without an entry object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Admitted extensions come from the resolved policy rather than fixture-specific emitted-file names.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains future directory membership and why unadmitted emitted JavaScript does not invalidate a TypeScript-only program.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Tests a Dirent's kind and its name's extension against the policy; no path is parsed.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isPossibleProgramEntry(
  entry: fs.Dirent,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return entry.isFile() ? isPossibleProgramFileName(entry.name, policy) : true;
}
