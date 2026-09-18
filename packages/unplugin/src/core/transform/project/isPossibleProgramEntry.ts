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
 */
export function isPossibleProgramEntry(
  entry: fs.Dirent,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return entry.isFile() ? isPossibleProgramFileName(entry.name, policy) : true;
}
