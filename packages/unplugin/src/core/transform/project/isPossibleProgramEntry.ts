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
 */
export function isPossibleProgramEntry(
  entry: fs.Dirent,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return entry.isFile() ? isPossibleProgramFileName(entry.name, policy) : true;
}
