import path from "node:path";

import type { TtscProjectSpellings } from "./TtscProjectSpellings";
import { pathIsWithin } from "./pathIsWithin";

/**
 * The path of a file below the project, under whichever of the project root's
 * two spellings contains it, or `undefined` when neither does.
 *
 * An empty string names the root itself. A file spelled under the physical root
 * and one spelled under the named root are both the project's, so a containment
 * decided against one spelling alone refused every input the compiler reported
 * for a project reached through a link.
 *
 * @param file The absolute path to place.
 * @param project The project root's two spellings.
 */
export function relativeToProject(
  file: string,
  project: TtscProjectSpellings,
): string | undefined {
  const absolute = path.resolve(file);
  for (const root of project.physical === project.spelling
    ? [project.spelling]
    : [project.spelling, project.physical]) {
    if (pathIsWithin(absolute, root)) return path.relative(root, absolute);
  }
  return undefined;
}
